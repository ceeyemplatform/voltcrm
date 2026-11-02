import {
  memberMode,
  memberStatus,
  otherSummary,
  otherTotal,
  statusText,
  wagesMode,
  wagesSummary,
  wagesTotal,
} from '../common/payment-status';

// Turns everything saved in VoltCRM into the tabs of the Google Sheet. Records are tied together
// by codes (Site Code, Work Code, Labour Code, Day Ref, Quotation No) and the Apps Script turns
// those codes into links that jump to the matching row in the other tab.

/** Bumped when the payload shape changes; the Apps Script must report at least this version */
export const SHEET_PAYLOAD_VERSION = 2;

export const TAB = {
  sites: 'Work Sites',
  works: 'Work Orders',
  days: 'Daily Work',
  workers: 'Daily Workers',
  labour: 'Labour',
  polevar: 'Polevar',
  quotations: 'Quotations',
  quoteItems: 'Quotation Items',
  expenses: 'Expenses',
} as const;

/** Tabs written by the previous version of the sync, removed so the sheet isn't duplicated */
const OLD_TABS = ['Daily Logs', 'Labour Directory', 'Polevar Sheet'];

interface LinkSpec {
  /** Column (0-based) holding the code to link */
  col: number;
  /** Tab whose first column holds the same code */
  sheet: string;
}

interface SheetTab {
  name: string;
  color: string;
  headers: string[];
  rows: (string | number)[][];
  links?: LinkSpec[];
  /** Columns (0-based) shown as money */
  money?: number[];
}

interface PolevarBlock {
  title: string;
  subtitle: string;
  groups: { name: string; color: string; cols: string[] }[];
  rows: (string | number)[][];
  totals: (string | number)[];
}

/** DD/MM/YYYY, matching the app (plain dates keep their calendar day) */
export const formatDate = (value: any): string => {
  if (!value) return '';
  const iso = value instanceof Date ? value.toISOString() : String(value);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

const num = (v: any) => Number(v || 0);
const sum = <T>(list: T[], pick: (x: T) => number) => list.reduce((s, x) => s + pick(x), 0);

/** Plain text of a written quotation page (sheets have no rich text from HTML) */
const htmlToText = (html: string) =>
  String(html || '')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const SCOPE_LABEL: Record<string, string> = { BOTH: 'Supply & Labour', SUPPLY: 'Supply only', LABOUR: 'Labour only' };
const POLEVAR_GROUPS: { key: string; name: string; color: string }[] = [
  { key: 'materials', name: 'MATERIALS', color: '#fef3c7' },
  { key: 'labour', name: 'LABOUR', color: '#dbeafe' },
  { key: 'takenBack', name: 'TAKEN BACK', color: '#fee2e2' },
];

export interface SheetSource {
  works: any[];
  sites: any[];
  labours: any[];
  quotations: any[];
  /** Manual income/expense records */
  expenses: any[];
  /** Expense Tracker rows: manual records plus daily wages and site expense items */
  ledger: any[];
}

export const buildSheetPayload = (src: SheetSource) => {
  const siteById = new Map(src.sites.map((s) => [s.id, s]));
  const labourById = new Map(src.labours.map((l) => [l.id, l]));
  const workById = new Map(src.works.map((w) => [w.id, w]));
  const siteCodeOfWork = (w: any) => (w?.workSiteId ? siteById.get(w.workSiteId)?.siteCode || '' : '');

  // Days in date order per work, each with a stable reference like "WRK-12-D3"
  const dayRef = new Map<string, string>();
  const daysOf = (w: any): any[] =>
    (Array.isArray(w.dailyDetails) ? [...w.dailyDetails] : []).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  for (const w of src.works) daysOf(w).forEach((d, i) => dayRef.set(`${w.id}:${d.id}`, `${w.workCode}-D${i + 1}`));

  const manualByWork = (workId: string, type: 'income' | 'expense') =>
    src.expenses.filter((e) => e.workId === workId && e.type === type);
  const dayCostOf = (w: any) => sum(daysOf(w), (d) => wagesTotal(d) + otherTotal(d));

  // ---------- Work Orders ----------
  const workRows = src.works.map((w) => {
    const days = daysOf(w);
    const wages = sum(days, wagesTotal);
    const siteExp = sum(days, otherTotal);
    const otherExp = sum(manualByWork(w.id, 'expense'), (e) => num(e.amount));
    const income = manualByWork(w.id, 'income');
    const received = sum(income.filter((e) => !e.isFlagged), (e) => num(e.amount));
    const toGet = sum(income.filter((e) => e.isFlagged), (e) => num(e.amount));
    const wagesPending = sum(days, (d) => wagesSummary(d).pending);
    const site = w.workSiteId ? siteById.get(w.workSiteId) : null;
    return [
      w.workCode,
      site?.siteCode || '',
      site?.name || 'Unassigned',
      w.name,
      w.electricalSection || site?.section || '',
      w.typeOfWork || '',
      String(w.status || '').replace(/_/g, ' '),
      formatDate(w.date),
      formatDate(w.endDate),
      num(w.contractorAmount),
      w.workOrder || '',
      formatDate(w.woDate),
      w.gstMillNumber || '',
      formatDate(w.gstDate),
      days.length,
      wages,
      siteExp,
      otherExp,
      wages + siteExp + otherExp,
      received,
      toGet,
      wagesPending,
    ];
  });

  // ---------- Work Sites ----------
  const siteRows = src.sites.map((s) => {
    const works = src.works.filter((w) => w.workSiteId === s.id);
    const spent = sum(works, (w) => dayCostOf(w) + sum(manualByWork(w.id, 'expense'), (e) => num(e.amount)));
    const income = works.flatMap((w) => manualByWork(w.id, 'income'));
    return [
      s.siteCode || '',
      s.name,
      s.section || '',
      s.address || '',
      s.contact || '',
      works.length,
      works.map((w) => w.workCode).join(', '),
      spent,
      sum(income.filter((e) => !e.isFlagged), (e) => num(e.amount)),
      sum(income.filter((e) => e.isFlagged), (e) => num(e.amount)),
      s.note || '',
    ];
  });

  // ---------- Daily Work and Daily Workers ----------
  const dayRows: (string | number)[][] = [];
  const workerRows: (string | number)[][] = [];
  const earned = new Map<string, { days: Set<string>; total: number; given: number; pending: number }>();

  for (const w of src.works) {
    for (const d of daysOf(w)) {
      const ref = dayRef.get(`${w.id}:${d.id}`) || '';
      const members: any[] = Array.isArray(d.labourMembers) ? d.labourMembers : [];
      const ws = wagesSummary(d);
      const os = otherSummary(d);
      const other = otherTotal(d);
      dayRows.push([
        ref,
        formatDate(d.date),
        w.workCode,
        siteCodeOfWork(w),
        d.workDone || '',
        members.length || num(d.labourCount),
        members.filter((m) => !m.isAdditional).length,
        members.filter((m) => m.isAdditional).length || num(d.additionalMembersCount),
        wagesTotal(d),
        statusText('expense', ws.status),
        ws.pending,
        wagesMode(d),
        other,
        other > 0 ? statusText('expense', os.status) : '',
        os.pending,
        wagesTotal(d) + other,
        d.remarks || '',
      ]);

      for (const m of members) {
        const st = memberStatus(d, m);
        const labour = m.labourId ? labourById.get(m.labourId) : null;
        workerRows.push([
          ref,
          formatDate(d.date),
          w.workCode,
          labour?.labourCode || '',
          m.name || '',
          m.isAdditional ? 'Casual' : 'Permanent',
          m.category || labour?.category || '',
          num(m.hoursWorked),
          num(m.hourlyRate),
          num(m.wage),
          statusText('expense', st),
          st === 'paid' ? memberMode(d, m) : '',
        ]);
        if (m.labourId) {
          const e = earned.get(m.labourId) || { days: new Set<string>(), total: 0, given: 0, pending: 0 };
          e.days.add(ref);
          e.total += num(m.wage);
          if (st === 'paid') e.given += num(m.wage);
          if (st === 'pending') e.pending += num(m.wage);
          earned.set(m.labourId, e);
        }
      }
    }
  }

  // ---------- Labour ----------
  const labourRows = src.labours.map((l) => {
    const e = earned.get(l.id);
    return [
      l.labourCode || '',
      l.name,
      l.category || '',
      l.contact || '',
      l.address || '',
      num(l.hourlyRate),
      num(l.dailyWage),
      e?.days.size || 0,
      e?.total || 0,
      e?.given || 0,
      e?.pending || 0,
    ];
  });

  // ---------- Polevar (laid out like the paper sheet) ----------
  const polevarBlocks: PolevarBlock[] = [];
  for (const w of src.works) {
    const p: any = w.polevarData;
    if (!p || !Array.isArray(p.columns) || !Array.isArray(p.rows) || p.rows.length === 0) continue;
    const groups = POLEVAR_GROUPS.map((g) => ({
      ...g,
      columns: p.columns.filter((c: any) => c.category === g.key),
    })).filter((g) => g.columns.length > 0);
    const cols = groups.flatMap((g) => g.columns);
    const site = w.workSiteId ? siteById.get(w.workSiteId) : null;
    const cell = (v: any) => (v === '' || v === undefined || v === null ? '' : num(v));
    polevarBlocks.push({
      title: p.title || `POLE VAR of ${w.name}`,
      subtitle: [`Work: ${w.workCode}`, site ? `Site: ${site.siteCode || ''} ${site.name}`.trim() : '', formatDate(w.date)]
        .filter(Boolean)
        .join('   ·   '),
      groups: groups.map((g) => ({ name: g.name, color: g.color, cols: g.columns.map((c: any) => c.name) })),
      rows: p.rows.map((r: any, i: number) => [i + 1, r.location || '', ...cols.map((c: any) => cell(r.values?.[c.id]))]),
      totals: ['', 'TOTAL', ...cols.map((c: any) => sum(p.rows, (r: any) => num(r.values?.[c.id])))],
    });
  }

  // ---------- Quotations and their items ----------
  const quoteRows = src.quotations.map((q) => {
    const items: any[] = q.items || [];
    const supply = sum(items, (i) => (i.itemType === 'LABOUR' ? 0 : num(i.qty) * num(i.supplyRate)));
    const labour = sum(items, (i) => (i.itemType === 'SUPPLY' ? 0 : num(i.qty) * num(i.labourRate)));
    const written = q.kind === 'WRITTEN';
    const pages: any[] = Array.isArray(q.pages) ? q.pages : [];
    return [
      q.quotationNo,
      formatDate(q.date),
      written ? 'Written' : 'Priced',
      q.clientName,
      q.workSite?.siteCode || '',
      q.address || q.workSite?.address || '',
      q.pan || '',
      written ? 0 : items.length,
      supply,
      labour,
      num(q.subtotal),
      num(q.gstPercent),
      (num(q.subtotal) * num(q.gstPercent)) / 100,
      num(q.total),
      pages.length,
      // Google Sheets cells hold at most 50,000 characters
      pages.map((pg) => htmlToText(pg.html)).filter(Boolean).join('\n\n— page —\n\n').slice(0, 45000),
    ];
  });

  const quoteItemRows = src.quotations.flatMap((q) =>
    (q.items || []).map((i: any, idx: number) => [
      q.quotationNo,
      idx + 1,
      i.description,
      SCOPE_LABEL[i.itemType || 'BOTH'] || i.itemType,
      i.unit || '',
      num(i.qty),
      i.itemType === 'LABOUR' ? '' : num(i.supplyRate),
      i.itemType === 'SUPPLY' ? '' : num(i.labourRate),
      num(i.rate),
      num(i.amount),
    ]),
  );

  // ---------- Expenses (same list as the Expense Tracker; site expenses item by item) ----------
  const expenseRows = src.ledger.map((t) => {
    const w = t.workId ? workById.get(t.workId) : null;
    const source = !t.dailyId ? 'Manual entry' : t.dailyPart === 'wages' ? 'Daily work · wages' : 'Daily work · site expense';
    const mode = t.paymentMode && t.paymentMode !== 'Daily Log Wages' ? t.paymentMode : '';
    return [
      formatDate(t.date),
      t.type === 'income' ? 'Income' : 'Expense',
      source,
      t.category || '',
      t.remarks || '',
      t.personName || '',
      t.workCode || '',
      siteCodeOfWork(w),
      t.dailyId ? dayRef.get(`${t.workId}:${t.dailyId}`) || '' : '',
      num(t.amount),
      statusText(t.type === 'income' ? 'income' : 'expense', t.paymentStatus),
      num(t.pendingAmount),
      mode,
    ];
  });

  const tabs: SheetTab[] = [
    {
      name: TAB.sites,
      color: '#6d28d9',
      headers: ['Site Code', 'Site Name', 'Section', 'Address', 'Contact', 'Works', 'Work Codes', 'Total Spent (₹)', 'Received (₹)', 'To Get (₹)', 'Note'],
      rows: siteRows,
      money: [7, 8, 9],
    },
    {
      name: TAB.works,
      color: '#0f172a',
      headers: [
        'Work Code', 'Site Code', 'Site Name', 'Job Title', 'Section', 'Type of Work', 'Status', 'Start Date', 'End Date',
        'Contract Amount (₹)', 'W/O No', 'W/O Date', 'GST Bill No', 'GST Date', 'Days Worked', 'Wages (₹)',
        'Site Expenses (₹)', 'Other Expenses (₹)', 'Total Cost (₹)', 'Received (₹)', 'To Get (₹)', 'Wages Pending (₹)',
      ],
      rows: workRows,
      links: [{ col: 1, sheet: TAB.sites }],
      money: [9, 15, 16, 17, 18, 19, 20, 21],
    },
    {
      name: TAB.days,
      color: '#047857',
      headers: [
        'Day Ref', 'Date', 'Work Code', 'Site Code', 'Work Done', 'Crew', 'Permanent', 'Casual', 'Wages (₹)', 'Wages Status',
        'Wages Pending (₹)', 'Wages Mode', 'Site Expenses (₹)', 'Site Expenses Status', 'Site Expenses Pending (₹)',
        'Day Total (₹)', 'Remarks',
      ],
      rows: dayRows,
      links: [
        { col: 2, sheet: TAB.works },
        { col: 3, sheet: TAB.sites },
      ],
      money: [8, 10, 12, 14, 15],
    },
    {
      name: TAB.workers,
      color: '#0f766e',
      headers: ['Day Ref', 'Date', 'Work Code', 'Labour Code', 'Worker', 'Type', 'Trade', 'Hours', 'Rate / hr (₹)', 'Wage (₹)', 'Status', 'Mode'],
      rows: workerRows,
      links: [
        { col: 0, sheet: TAB.days },
        { col: 2, sheet: TAB.works },
        { col: 3, sheet: TAB.labour },
      ],
      money: [8, 9],
    },
    {
      name: TAB.labour,
      color: '#1d4ed8',
      headers: ['Labour Code', 'Name', 'Trade', 'Contact', 'Address', 'Hourly Rate (₹)', 'Daily Wage (₹)', 'Days Worked', 'Total Earned (₹)', 'Given (₹)', 'Pending (₹)'],
      rows: labourRows,
      money: [5, 6, 8, 9, 10],
    },
    {
      name: TAB.quotations,
      color: '#0e7490',
      headers: [
        'Quotation No', 'Date', 'Kind', 'Client', 'Site Code', 'Address', 'PAN', 'Items', 'Supply (₹)', 'Labour (₹)',
        'Subtotal (₹)', 'GST %', 'GST (₹)', 'Total (₹)', 'Pages', 'Written Text',
      ],
      rows: quoteRows,
      links: [{ col: 4, sheet: TAB.sites }],
      money: [8, 9, 10, 12, 13],
    },
    {
      name: TAB.quoteItems,
      color: '#155e75',
      headers: ['Quotation No', 'Line', 'Product / Work', 'Scope', 'Unit', 'Qty', 'Supply Rate (₹)', 'Labour Rate (₹)', 'Unit Rate (₹)', 'Amount (₹)'],
      rows: quoteItemRows,
      links: [{ col: 0, sheet: TAB.quotations }],
      money: [6, 7, 8, 9],
    },
    {
      name: TAB.expenses,
      color: '#be123c',
      headers: ['Date', 'Type', 'Source', 'Category', 'Details', 'Party', 'Work Code', 'Site Code', 'Day Ref', 'Amount (₹)', 'Status', 'Pending (₹)', 'Mode'],
      rows: expenseRows,
      links: [
        { col: 6, sheet: TAB.works },
        { col: 7, sheet: TAB.sites },
        { col: 8, sheet: TAB.days },
      ],
      money: [9, 11],
    },
  ];

  return {
    payload: {
      action: 'sync_all',
      version: SHEET_PAYLOAD_VERSION,
      syncedAt: new Date().toISOString(),
      tabs,
      polevar: { name: TAB.polevar, color: '#b45309', blocks: polevarBlocks },
      removeTabs: OLD_TABS,
    },
    counts: {
      totalWorks: workRows.length,
      totalDailyLogs: dayRows.length,
      totalLabours: labourRows.length,
      totalSites: siteRows.length,
      totalPolevarRows: polevarBlocks.length,
      totalQuotations: quoteRows.length,
      totalExpenses: expenseRows.length,
    },
  };
};
