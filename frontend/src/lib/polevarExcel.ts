import type { Work, WorkPolevarData, PolevarColumn } from '../types';
import { formatDate, todayISO } from './dates';

const GROUPS: { key: PolevarColumn['category']; label: string; head: string; cell: string }[] = [
  { key: 'materials', label: 'MATERIALS', head: 'FFF6AD55', cell: 'FFFFF7ED' },
  { key: 'labour', label: 'LABOUR', head: 'FF86EFAC', cell: 'FFF0FDF4' },
  { key: 'takenBack', label: 'TAKEN BACK', head: 'FFFDBA74', cell: 'FFFFF7ED' },
];

const thin = { style: 'thin' as const, color: { argb: 'FF94A3B8' } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

/** Downloads a work's POLE VAR sheet as an Excel file laid out like the on-screen grid. */
export const downloadPolevarXlsx = async (work: Work, data: WorkPolevarData, fileName: string) => {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VoltCRM';
  wb.created = new Date();
  const ws = wb.addWorksheet('Polevar', {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    // No frozen panes: with the tall merged heading rows Excel draws the frozen area twice
    views: [{ state: 'normal', activeCell: 'A1' }],
  });

  const groups = GROUPS.map((g) => ({ ...g, cols: data.columns.filter((c) => c.category === g.key) })).filter(
    (g) => g.cols.length > 0
  );
  const columns = groups.flatMap((g) => g.cols);
  const lastCol = 2 + columns.length;

  ws.columns = [{ width: 6 }, { width: 24 }, ...columns.map(() => ({ width: 7 }))];

  // Title and work details
  ws.mergeCells(1, 1, 1, lastCol);
  const title = ws.getCell(1, 1);
  title.value = data.title || `POLE VAR of ${work.name}`;
  title.font = { bold: true, size: 14 };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, lastCol);
  ws.getCell(2, 1).value = [
    `Work Code: ${work.workCode}`,
    work.workSite?.name ? `Site: ${work.workSite.name}` : '',
    `Date: ${formatDate(todayISO())}`,
  ]
    .filter(Boolean)
    .join('     ');
  ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF475569' } };

  // Two header rows: category groups, then rotated item names
  ws.mergeCells(3, 1, 4, 1);
  ws.mergeCells(3, 2, 4, 2);
  ws.getCell(3, 1).value = 'SL No';
  ws.getCell(3, 2).value = 'Location';
  let c = 3;
  for (const g of groups) {
    ws.mergeCells(3, c, 3, c + g.cols.length - 1);
    const head = ws.getCell(3, c);
    head.value = g.label;
    for (let i = 0; i < g.cols.length; i++) {
      const top = ws.getCell(3, c + i);
      top.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.head } };
      const name = ws.getCell(4, c + i);
      name.value = g.cols[i].name;
      name.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.cell } };
      name.alignment = { textRotation: 90, horizontal: 'center', vertical: 'bottom', wrapText: true };
    }
    c += g.cols.length;
  }
  for (const r of [3, 4]) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > lastCol) return;
      cell.font = { bold: true, size: r === 3 ? 10 : 9 };
      cell.border = BORDER;
      if (r === 3 || col <= 2) cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      if (col <= 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });
  }
  ws.getRow(3).height = 20;
  ws.getRow(4).height = 110;

  // Location rows
  const firstData = 5;
  data.rows.forEach((row, idx) => {
    const r = ws.getRow(firstData + idx);
    r.getCell(1).value = idx + 1;
    r.getCell(2).value = row.location;
    columns.forEach((col, i) => {
      const v = row.values[col.id];
      r.getCell(3 + i).value = v === '' || v === undefined || v === null ? null : Number(v);
    });
    for (let col = 1; col <= lastCol; col++) {
      const cell = r.getCell(col);
      cell.border = BORDER;
      cell.alignment = { horizontal: col === 2 ? 'left' : 'center', vertical: 'middle' };
      cell.font = { size: 10, bold: col === 2 };
    }
  });

  // Totals as live SUM formulas
  const lastData = firstData + data.rows.length - 1;
  const totalRow = ws.getRow(lastData + 1);
  ws.mergeCells(lastData + 1, 1, lastData + 1, 2);
  totalRow.getCell(1).value = 'TOTAL';
  columns.forEach((col, i) => {
    const letter = ws.getColumn(3 + i).letter;
    const result = data.rows.reduce((s, row) => s + (Number(row.values[col.id]) || 0), 0);
    totalRow.getCell(3 + i).value =
      data.rows.length > 0 ? { formula: `SUM(${letter}${firstData}:${letter}${lastData})`, result } : 0;
  });
  for (let col = 1; col <= lastCol; col++) {
    const cell = totalRow.getCell(col);
    cell.border = BORDER;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
