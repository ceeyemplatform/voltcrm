import { SHEET_PAYLOAD_VERSION } from './sheet-builder';

/**
 * Google Apps Script pasted into the user's spreadsheet. It receives the payload from
 * buildSheetPayload, writes every tab, draws the Polevar sheets and turns codes into links.
 */
export const APPS_SCRIPT_TEMPLATE = `/**
 * VoltCRM - Google Sheets Cloud Sync (version ${SHEET_PAYLOAD_VERSION})
 * Paste this script into Extensions -> Apps Script inside your Google Spreadsheet.
 * Click Deploy -> New deployment -> Select type: Web app -> Access: Anyone -> Deploy.
 * Copy the generated Web app URL and paste it into VoltCRM Cloud Sync Settings.
 * When updating an existing script: Deploy -> Manage deployments -> Edit -> Version: New version -> Deploy.
 */

var SCRIPT_VERSION = ${SHEET_PAYLOAD_VERSION};

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (!payload.tabs) throw new Error('This data needs a newer VoltCRM script');
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    payload.tabs.forEach(function (t) { writeTab(ss, t); });
    if (payload.polevar) writePolevar(ss, payload.polevar);
    payload.tabs.forEach(function (t) { addLinks(ss, t); });

    // Tabs in a fixed order: sites first, then everything that links to them
    var order = payload.tabs.map(function (t) { return t.name; });
    if (payload.polevar) order.splice(5, 0, payload.polevar.name);
    order.forEach(function (name, i) {
      var sh = ss.getSheetByName(name);
      if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
    });

    (payload.removeTabs || []).concat(['Sheet1']).forEach(function (name) {
      var sh = ss.getSheetByName(name);
      if (sh && ss.getSheets().length > 1 && order.indexOf(name) === -1) ss.deleteSheet(sh);
    });
    ss.setActiveSheet(ss.getSheets()[0]);

    return reply({ status: 'success', version: SCRIPT_VERSION, message: 'VoltCRM synced at ' + new Date().toISOString() });
  } catch (err) {
    return reply({ status: 'error', version: SCRIPT_VERSION, message: String(err) });
  }
}

function doGet() {
  return reply({ status: 'online', version: SCRIPT_VERSION, message: 'VoltCRM Google Sheets sync is active.' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Text that starts like a formula is stored as plain text, so typed data can never run */
function safe(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' && /^[=+\\-@]/.test(v)) return "'" + v;
  return v;
}

function freshSheet(ss, name) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getFilter()) sh.getFilter().remove();
  sh.getBandings().forEach(function (b) { b.remove(); });
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear();
  sh.setFrozenRows(0);
  sh.setFrozenColumns(0);
  return sh;
}

function ensureSize(sh, rows, cols) {
  if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(), rows - sh.getMaxRows());
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
}

function writeTab(ss, t) {
  var sh = freshSheet(ss, t.name);
  var width = t.headers.length;
  var height = t.rows.length + 1;
  ensureSize(sh, height + 1, width);

  sh.getRange(1, 1, 1, width).setValues([t.headers])
    .setBackground(t.color).setFontColor('#ffffff').setFontWeight('bold').setFontSize(10)
    .setWrap(true).setVerticalAlignment('middle').setHorizontalAlignment('center');
  sh.setRowHeight(1, 34);
  sh.setFrozenRows(1);

  if (t.rows.length) {
    var rows = t.rows.map(function (r) { return r.map(safe); });
    sh.getRange(2, 1, rows.length, width).setValues(rows).setFontSize(9).setVerticalAlignment('top');
    (t.money || []).forEach(function (c) {
      sh.getRange(2, c + 1, rows.length, 1).setNumberFormat('#,##0.00');
    });
    var band = sh.getRange(1, 1, height, width).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
    band.setHeaderRowColor(t.color);
  }

  sh.getRange(1, 1, Math.max(height, 2), width).createFilter();
  sh.autoResizeColumns(1, width);
  for (var c = 1; c <= width; c++) {
    if (sh.getColumnWidth(c) > 340) {
      sh.setColumnWidth(c, 340);
      sh.getRange(2, c, Math.max(t.rows.length, 1), 1).setWrap(true);
    } else if (sh.getColumnWidth(c) < 70) {
      sh.setColumnWidth(c, 70);
    }
  }
}

/** Codes become links to the matching row (first column) of another tab */
function addLinks(ss, t) {
  if (!t.links || !t.rows.length) return;
  var sh = ss.getSheetByName(t.name);
  t.links.forEach(function (l) {
    var target = ss.getSheetByName(l.sheet);
    if (!target || target.getLastRow() < 2) return;
    var keys = target.getRange(2, 1, target.getLastRow() - 1, 1).getValues();
    var rowOf = {};
    keys.forEach(function (k, i) {
      var key = String(k[0]);
      if (key && !(key in rowOf)) rowOf[key] = i + 2;
    });
    var gid = target.getSheetId();
    var cells = t.rows.map(function (r) {
      var key = r[l.col] === null || r[l.col] === undefined ? '' : String(r[l.col]);
      if (key && rowOf[key]) {
        return ['=HYPERLINK("#gid=' + gid + '&range=A' + rowOf[key] + '","' + key.replace(/"/g, '""') + '")'];
      }
      return [safe(r[l.col])];
    });
    sh.getRange(2, l.col + 1, cells.length, 1).setValues(cells).setFontColor('#1d4ed8').setFontWeight('bold');
  });
}

/** Each work's Polevar sheet as a block: S.No, location, then grouped item columns and totals */
function writePolevar(ss, p) {
  var sh = freshSheet(ss, p.name);
  if (!p.blocks.length) {
    sh.getRange(1, 1).setValue('No Polevar sheets yet.');
    return;
  }
  var widest = 2;
  var needRows = 0;
  p.blocks.forEach(function (b) {
    var n = 2;
    b.groups.forEach(function (g) { n += g.cols.length; });
    widest = Math.max(widest, n);
    needRows += b.rows.length + 8;
  });
  ensureSize(sh, needRows + 1, widest);

  var row = 1;
  p.blocks.forEach(function (b) {
    var nCols = 2;
    b.groups.forEach(function (g) { nCols += g.cols.length; });
    var start = row;

    sh.getRange(row, 1, 1, nCols).merge().setValue(safe(b.title))
      .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center')
      .setBackground('#1e293b').setFontColor('#ffffff');
    row++;
    sh.getRange(row, 1, 1, nCols).merge().setValue(safe(b.subtitle))
      .setFontSize(9).setHorizontalAlignment('center').setFontColor('#475569').setBackground('#f8fafc');
    row++;

    sh.getRange(row, 1, 2, 1).merge().setValue('S.No');
    sh.getRange(row, 2, 2, 1).merge().setValue('LOCATION');
    sh.getRange(row, 1, 2, 2).setFontWeight('bold').setHorizontalAlignment('center')
      .setVerticalAlignment('middle').setBackground('#f1f5f9');
    var col = 3;
    b.groups.forEach(function (g) {
      var head = sh.getRange(row, col, 1, g.cols.length);
      if (g.cols.length > 1) head.merge();
      head.setValue(g.name).setBackground(g.color).setFontWeight('bold').setHorizontalAlignment('center');
      sh.getRange(row + 1, col, 1, g.cols.length).setValues([g.cols.map(safe)])
        .setBackground(g.color).setFontWeight('bold').setFontSize(8).setWrap(true)
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
      col += g.cols.length;
    });
    sh.setRowHeight(row + 1, 48);
    row += 2;

    if (b.rows.length) {
      sh.getRange(row, 1, b.rows.length, nCols).setValues(b.rows.map(function (r) { return r.map(safe); }))
        .setFontSize(9).setHorizontalAlignment('center');
      sh.getRange(row, 2, b.rows.length, 1).setHorizontalAlignment('left').setFontWeight('bold');
      row += b.rows.length;
    }
    sh.getRange(row, 1, 1, nCols).setValues([b.totals.map(safe)])
      .setFontWeight('bold').setBackground('#e2e8f0').setHorizontalAlignment('center');

    sh.getRange(start + 2, 1, row - start - 1, nCols)
      .setBorder(true, true, true, true, true, true, '#94a3b8', SpreadsheetApp.BorderStyle.SOLID);
    row += 3;
  });

  sh.setColumnWidth(1, 48);
  sh.setColumnWidth(2, 140);
  for (var c = 3; c <= widest; c++) sh.setColumnWidth(c, 78);
}
`;
