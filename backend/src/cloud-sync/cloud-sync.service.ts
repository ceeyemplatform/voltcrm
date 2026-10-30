import {
  memberMode,
  memberStatus,
  otherSummary,
  otherTotal,
  statusText,
  wagesMode,
  wagesSummary,
} from '../common/payment-status';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


/** DD/MM/YYYY, matching the app (plain dates keep their calendar day) */
const formatDate = (value: any): string => {
  if (!value) return '';
  const iso = value instanceof Date ? value.toISOString() : String(value);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

/**
 * Sync only ever talks to Google: the webhook must be an Apps Script web app and the sheet link a
 * Google Sheets page. Anything else (internal addresses, other hosts, non-https) is refused, so
 * the server can't be used to call arbitrary URLs.
 */
const assertGoogleUrl = (value: string, kind: 'webhook' | 'sheet') => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException(`Invalid ${kind === 'webhook' ? 'Apps Script webhook' : 'Google Sheet'} URL`);
  }
  const allowedHosts = kind === 'webhook' ? ['script.google.com'] : ['docs.google.com'];
  if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname) || url.username || url.password || url.port) {
    throw new BadRequestException(
      kind === 'webhook'
        ? 'The webhook must be a Google Apps Script web app URL (https://script.google.com/...)'
        : 'The sheet link must be a Google Sheets URL (https://docs.google.com/...)',
    );
  }
  return url.toString();
};

@Injectable()
export class CloudSyncService {
  constructor(private prisma: PrismaService) {}

  async getSettings(userId: string) {
    let settings = await this.prisma.cloudSyncSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.cloudSyncSettings.create({
        data: {
          userId,
          autoSync: false,
        },
      });
    }

    return settings;
  }

  async updateSettings(
    userId: string,
    dto: {
      googleSheetWebhookUrl?: string;
      googleSheetUrl?: string;
      autoSync?: boolean;
    },
  ) {
    const webhook = dto.googleSheetWebhookUrl?.trim() ? assertGoogleUrl(dto.googleSheetWebhookUrl.trim(), 'webhook') : null;
    const sheet = dto.googleSheetUrl?.trim() ? assertGoogleUrl(dto.googleSheetUrl.trim(), 'sheet') : null;
    return this.prisma.cloudSyncSettings.upsert({
      where: { userId },
      create: {
        userId,
        googleSheetWebhookUrl: webhook,
        googleSheetUrl: sheet,
        autoSync: Boolean(dto.autoSync),
      },
      update: {
        googleSheetWebhookUrl: webhook,
        googleSheetUrl: sheet,
        autoSync: dto.autoSync !== undefined ? Boolean(dto.autoSync) : undefined,
      },
    });
  }

  async pushToGoogleSheet(userId: string, webhookUrlOverride?: string) {
    const settings = await this.getSettings(userId);
    const rawWebhookUrl = webhookUrlOverride?.trim() || settings.googleSheetWebhookUrl;

    if (!rawWebhookUrl) {
      throw new BadRequestException(
        'Google Sheets Webhook URL is not configured. Please paste your Google Apps Script Webhook URL.',
      );
    }

    const targetWebhookUrl = assertGoogleUrl(rawWebhookUrl, 'webhook');

    // 1. Fetch complete data for this user
    const [works, workSites, labours, quotations, expenses] = await Promise.all([
      this.prisma.work.findMany({
        where: { userId },
        include: {
          workSite: true,
          labours: true,
          materials: true,
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.workSite.findMany({
        where: { userId },
        include: {
          _count: {
            select: { works: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.labour.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      }),
      this.prisma.quotation.findMany({
        where: { userId },
        include: {
          workSite: true,
          items: true,
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.expense.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      }),
    ]);

    // 2. Prepare Work Orders Sheet Rows
    const workOrdersHeaders = [
      'Work Code',
      'Job Title',
      'Site Name',
      'Section',
      'Type of Work',
      'Start Date',
      'End Date',
      'Status',
      'Contract Amount (₹)',
      'Work Order No',
      'WO Date',
      'GST Bill No',
      'GST Date',
      'Assigned Labours Count',
      'Daily Logs Count',
    ];

    const workOrdersRows = works.map((w) => {
      const dailyDetailsCount = Array.isArray(w.dailyDetails) ? w.dailyDetails.length : 0;
      return [
        w.workCode,
        w.name,
        w.workSite?.name || 'Unassigned',
        w.electricalSection || 'General',
        w.typeOfWork || 'General',
        w.date ? formatDate(w.date) : '',
        w.endDate
          ? formatDate(w.endDate)
          : w.status === 'COMPLETED'
          ? (w.date ? formatDate(w.date) : '')
          : 'In Progress',
        w.status,
        Number(w.contractorAmount || 0),
        w.workOrder || '',
        w.woDate ? formatDate(w.woDate) : '',
        w.gstMillNumber || '',
        w.gstDate ? formatDate(w.gstDate) : '',
        w.labours?.length || 0,
        dailyDetailsCount,
      ];
    });

    // 3. Prepare Daily Logs Sheet Rows (Consolidated across all works)
    const dailyLogsHeaders = [
      'Work Code',
      'Job Title',
      'Site Name',
      'Log Date',
      'Work Done Description',
      'Labour Count',
      'Total Daily Wage (₹)',
      'Workforce Details',
      'Materials Used',
      'Remarks',
      'Wages Payment Mode',
      'Wages Status',
      'Wages Pending (₹)',
      'Other Expenses (₹)',
      'Other Expenses Mode',
      'Other Expenses Status',
    ];

    const dailyLogsRows: any[] = [];
    works.forEach((w) => {
      if (Array.isArray(w.dailyDetails)) {
        w.dailyDetails.forEach((log: any) => {
          let labourDetailsStr = log.labourDetails || '';
          if (Array.isArray(log.labourMembers) && log.labourMembers.length > 0) {
            labourDetailsStr = log.labourMembers
              .map((m: any) => {
                const st = statusText('expense', memberStatus(log, m));
                const md = st === 'Given' ? memberMode(log, m) : '';
                return `${m.name} (₹${m.wage}${st ? `, ${st}` : ''}${md ? ` by ${md}` : ''})`;
              })
              .join(', ');
          }
          dailyLogsRows.push([
            w.workCode,
            w.name,
            w.workSite?.name || 'Unassigned',
            log.date ? formatDate(log.date) : '',
            log.workDone || '',
            log.labourCount || (Array.isArray(log.labourMembers) ? log.labourMembers.length : 0),
            Number(log.totalDailyWage || 0),
            labourDetailsStr,
            log.materialsUsed || '',
            log.remarks || '',
            wagesMode(log),
            statusText('expense', wagesSummary(log).status),
            wagesSummary(log).pending,
            otherTotal(log),
            otherTotal(log) > 0 ? otherSummary(log).mode : '',
            otherTotal(log) > 0 ? statusText('expense', otherSummary(log).status) : '',
          ]);
        });
      }
    });

    // 4. Prepare Labour Directory Rows
    const labourHeaders = [
      'Labour Name',
      'Category / Trade',
      'Contact Phone',
      'Address',
      'Daily Wage (₹)',
      'Hourly Rate (₹)',
    ];

    const labourRows = labours.map((l) => [
      l.name,
      l.category || 'General',
      l.contact || '',
      l.address || '',
      Number(l.dailyWage || 0),
      Number(l.hourlyRate || 0),
    ]);

    // 5. Prepare Work Sites Rows
    const workSitesHeaders = [
      'Site Name',
      'Section / Feeder',
      'Address',
      'Contact',
      'Total Works',
      'Note / Details',
    ];

    const workSitesRows = workSites.map((s) => [
      s.name,
      s.section || '',
      s.address || '',
      s.contact || '',
      s._count?.works || 0,
      s.note || '',
    ]);

    // 6. Prepare Polevar Sheet Rows
    const polevarHeaders = [
      'Work Code',
      'Job Title',
      'Site Name',
      'Date',
      'Material Name',
      'Quantity Issued',
      'Quantity Used',
      'Variance',
      'Remarks',
    ];

    const polevarRows: any[] = [];
    works.forEach((w) => {
      // If structured materials exist in w.materials
      if (w.materials && w.materials.length > 0) {
        w.materials.forEach((m) => {
          polevarRows.push([
            w.workCode,
            w.name,
            w.workSite?.name || 'Unassigned',
            w.date ? formatDate(w.date) : '',
            m.materialName,
            Number(m.quantityIssued || 0),
            Number(m.quantityUsed || 0),
            Number(m.variance || 0),
            m.remarks || '',
          ]);
        });
      }

      // If matrix polevarData exists
      const pData: any = w.polevarData;
      if (pData && Array.isArray(pData.columns) && Array.isArray(pData.rows)) {
        pData.rows.forEach((r: any) => {
          pData.columns.forEach((c: any) => {
            const val = r.values?.[c.id];
            if (val !== undefined && val !== '' && Number(val) > 0) {
              polevarRows.push([
                w.workCode,
                w.name,
                `${w.workSite?.name || 'Site'} (${r.location || 'Loc'})`,
                w.date ? formatDate(w.date) : '',
                c.name,
                Number(val),
                Number(val),
                0,
                `Polevar matrix - ${r.location}`,
              ]);
            }
          });
        });
      }
    });

    // 7. Prepare Quotations Rows
    const quotationsHeaders = [
      'Quotation No',
      'Date',
      'Client Name',
      'Site Name',
      'Subtotal (₹)',
      'GST %',
      'Total (₹)',
      'Items Count',
    ];
    const quotationsRows = quotations.map((q) => [
      q.quotationNo,
      q.date ? formatDate(q.date) : '',
      q.clientName,
      q.workSite?.name || '',
      Number(q.subtotal || 0),
      Number(q.gstPercent || 0),
      Number(q.total || 0),
      q.items?.length || 0,
    ]);

    // 8. Prepare Expenses Rows
    const expensesHeaders = [
      'Date',
      'Type',
      'Category',
      'Amount (₹)',
      'Status',
      'Payment Mode',
      'Party',
      'Work Code',
      'Remarks',
    ];
    const expensesRows = expenses.map((exp) => [
      exp.date ? formatDate(exp.date) : '',
      exp.type.toUpperCase(),
      exp.category,
      Number(exp.amount || 0),
      statusText(exp.type === 'income' ? 'income' : 'expense', exp.isFlagged ? 'pending' : 'paid'),
      exp.paymentMode || '',
      exp.personName || '',
      exp.workCode || '',
      exp.remarks || '',
    ]);

    // Construct unified payload
    const payload = {
      action: 'sync_all',
      syncedAt: new Date().toISOString(),
      workOrders: {
        headers: workOrdersHeaders,
        rows: workOrdersRows,
      },
      dailyLogs: {
        headers: dailyLogsHeaders,
        rows: dailyLogsRows,
      },
      labours: {
        headers: labourHeaders,
        rows: labourRows,
      },
      workSites: {
        headers: workSitesHeaders,
        rows: workSitesRows,
      },
      polevar: {
        headers: polevarHeaders,
        rows: polevarRows,
      },
      quotations: {
        headers: quotationsHeaders,
        rows: quotationsRows,
      },
      expenses: {
        headers: expensesHeaders,
        rows: expensesRows,
      },
    };

    try {
      const response = await fetch(targetWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      // Apps Script redirects to script.googleusercontent.com; refuse redirects anywhere else
      const finalHost = new URL(response.url || targetWebhookUrl).hostname;
      if (!['script.google.com', 'script.googleusercontent.com'].includes(finalHost)) {
        throw new Error('Google Sheets webhook redirected to an unexpected address');
      }
      if (!response.ok && response.status !== 302) {
        // The remote reply is not passed back to the browser
        throw new Error(`Google Sheets responded with status ${response.status}`);
      }

      // Record successful sync timestamp
      const updatedSettings = await this.prisma.cloudSyncSettings.update({
        where: { userId },
        data: {
          lastSyncedAt: new Date(),
        },
      });

      return {
        success: true,
        lastSyncedAt: updatedSettings.lastSyncedAt,
        summary: {
          totalWorks: works.length,
          totalDailyLogs: dailyLogsRows.length,
          totalLabours: labours.length,
          totalSites: workSites.length,
          totalPolevarRows: polevarRows.length,
          totalQuotations: quotations.length,
          totalExpenses: expenses.length,
        },
      };
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Failed to sync with Google Sheet: ${err.message}`,
      );
    }
  }

  getGoogleAppsScriptTemplate() {
    return `/**
 * ElecCRM - Google Sheets Cloud Sync Engine
 * Paste this script into Extensions -> Apps Script inside your Google Spreadsheet.
 * Click Deploy -> New deployment -> Select type: Web app -> Access: Anyone -> Deploy.
 * Copy the generated Web app URL and paste it into ElecCRM Cloud Sync Settings.
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Helper to format, clear, and populate each tab
    function updateSheet(sheetName, headers, rows, headerColor) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }
      sheet.clear();

      // Write Headers
      if (headers && headers.length > 0) {
        sheet.appendRow(headers);
        var headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setBackground(headerColor || "#1e293b");
        headerRange.setFontColor("#ffffff");
        headerRange.setFontWeight("bold");
        headerRange.setFontSize(10);
        headerRange.setHorizontalAlignment("center");
        headerRange.setWrap(true);
      }

      // Write Data Rows
      if (rows && rows.length > 0) {
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
        sheet.getRange(2, 1, rows.length, rows[0].length).setFontSize(9);
      }

      // Format header row height and freeze header
      sheet.setRowHeight(1, 28);
      sheet.setFrozenRows(1);

      // Auto-fit column widths
      for (var col = 1; col <= headers.length; col++) {
        sheet.autoResizeColumn(col);
      }
    }

    // Populate each business module tab
    if (payload.workOrders) {
      updateSheet("Work Orders", payload.workOrders.headers, payload.workOrders.rows, "#0f172a");
    }
    if (payload.dailyLogs) {
      updateSheet("Daily Logs", payload.dailyLogs.headers, payload.dailyLogs.rows, "#047857");
    }
    if (payload.labours) {
      updateSheet("Labour Directory", payload.labours.headers, payload.labours.rows, "#1d4ed8");
    }
    if (payload.workSites) {
      updateSheet("Work Sites", payload.workSites.headers, payload.workSites.rows, "#6d28d9");
    }
    if (payload.polevar) {
      updateSheet("Polevar Sheet", payload.polevar.headers, payload.polevar.rows, "#b45309");
    }
    if (payload.quotations) {
      updateSheet("Quotations", payload.quotations.headers, payload.quotations.rows, "#0e7490");
    }
    if (payload.expenses) {
      updateSheet("Expenses", payload.expenses.headers, payload.expenses.rows, "#be123c");
    }

    // Delete default empty Sheet1 if other tabs exist
    var defaultSheet = ss.getSheetByName("Sheet1");
    if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
      ss.deleteSheet(defaultSheet);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "ElecCRM synced successfully at " + new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "ElecCRM Google Sheets Sync Endpoint is active."
  })).setMimeType(ContentService.MimeType.JSON);
}
`;
  }
}

