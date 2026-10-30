import { createPortal } from 'react-dom';
import React, { useEffect, useRef, useState } from 'react';
import { buildFileName, fileDate, printWithFileName, usePrintIsolation } from '../../lib/print';
import { formatDate } from '../../lib/dates';
import { TableRowsSkeleton } from '../common/Skeleton';
import {
  X,
  Plus,
  Trash2,
  Save,
  Printer,
  Download,
  Check,
  AlertCircle,
  HelpCircle,
  Edit2,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { Work, WorkPolevarData, PolevarColumn, PolevarLocationRow } from '../../types';
import { api } from '../../lib/api';
import { downloadPolevarXlsx } from '../../lib/polevarExcel';
import { confirmDelete } from '../common/ConfirmHost';

interface WorkPolevarModalProps {
  isOpen: boolean;
  onClose: () => void;
  work: Work;
  onUpdated?: () => void;
  /** Start the PDF download as soon as the sheet has loaded (print icon in the reports list) */
  autoPrint?: boolean;
}

export const WorkPolevarModal: React.FC<WorkPolevarModalProps> = ({
  isOpen,
  onClose,
  work,
  onUpdated,
  autoPrint = false,
}) => {
  // While open, printing outputs only this popup
  usePrintIsolation(isOpen);
  const [data, setData] = useState<WorkPolevarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Column adder state
  const [isAddingCol, setIsAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColCategory, setNewColCategory] = useState<'materials' | 'labour' | 'takenBack'>('materials');

  // Column rename / edit state
  const [editingCol, setEditingCol] = useState<PolevarColumn | null>(null);
  const [editColName, setEditColName] = useState('');
  const [editColCategory, setEditColCategory] = useState<'materials' | 'labour' | 'takenBack'>('materials');

  const handleOpenEditCol = (col: PolevarColumn) => {
    setEditingCol(col);
    setEditColName(col.name);
    setEditColCategory(col.category);
  };

  const handleSaveColEdit = () => {
    if (!data || !editingCol || !editColName.trim()) return;
    const updatedCols = data.columns.map((c) =>
      c.id === editingCol.id
        ? { ...c, name: editColName.trim(), category: editColCategory }
        : c
    );
    setData({ ...data, columns: updatedCols });
    setEditingCol(null);
    setSaveSuccess(false);
  };

  useEffect(() => {
    if (isOpen && work.id) {
      loadPolevar();
    }
  }, [isOpen, work.id]);

  const loadPolevar = async () => {
    setLoading(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const res = await api.works.getPolevar(work.id);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Polevar report');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const materialsCols = data?.columns.filter((c) => c.category === 'materials') || [];
  const labourCols = data?.columns.filter((c) => c.category === 'labour') || [];
  const takenBackCols = data?.columns.filter((c) => c.category === 'takenBack') || [];

  const handleCellChange = (rowId: string, colId: string, value: string) => {
    if (!data) return;
    const numValue: number | '' = value.trim() === '' ? '' : (isNaN(Number(value)) ? 0 : Number(value));
    const updatedRows = data.rows.map((r) => {
      if (r.id === rowId) {
        return {
          ...r,
          values: {
            ...r.values,
            [colId]: numValue,
          },
        };
      }
      return r;
    });
    setData({ ...data, rows: updatedRows });
    setSaveSuccess(false);
  };

  const handleLocationChange = (rowId: string, value: string) => {
    if (!data) return;
    const updatedRows = data.rows.map((r) => {
      if (r.id === rowId) {
        return { ...r, location: value };
      }
      return r;
    });
    setData({ ...data, rows: updatedRows });
    setSaveSuccess(false);
  };

  const handleAddRow = () => {
    if (!data) return;
    const newIndex = data.rows.length + 1;
    const newRow: PolevarLocationRow = {
      id: `row_${Date.now()}`,
      location: `PU ${newIndex}`,
      values: {},
    };
    setData({ ...data, rows: [...data.rows, newRow] });
    setSaveSuccess(false);
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!data) return;
    if (data.rows.length <= 1) {
      alert('At least one location row is required.');
      return;
    }
    if (!(await confirmDelete('Delete this location row and its quantities?'))) return;
    setData({ ...data, rows: data.rows.filter((r) => r.id !== rowId) });
    setSaveSuccess(false);
  };

  const handleAddColumn = () => {
    if (!data || !newColName.trim()) return;
    const newCol: PolevarColumn = {
      id: `col_${Date.now()}`,
      name: newColName.trim(),
      category: newColCategory,
    };
    setData({
      ...data,
      columns: [...data.columns, newCol],
    });
    setNewColName('');
    setIsAddingCol(false);
    setSaveSuccess(false);
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!data) return;
    if (await confirmDelete('Delete this column from the report?')) {
      setData({
        ...data,
        columns: data.columns.filter((c) => c.id !== colId),
      });
      setSaveSuccess(false);
    }
  };

  // Compute total for each column
  const getColumnTotal = (colId: string): number => {
    if (!data) return 0;
    return data.rows.reduce((sum, r) => {
      const val = Number(r.values[colId]);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      await api.works.updatePolevar(work.id, data);
      setSaveSuccess(true);
      if (onUpdated) onUpdated();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save Polevar report');
    } finally {
      setSaving(false);
    }
  };

  const pdfRef = useRef<HTMLDivElement>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const handlePrint = async () => {
    if (!pdfRef.current) return;
    setSavingPdf(true);
    try {
      printWithFileName(buildFileName('Polevar', work.workCode, work.name, fileDate()), { landscape: true });
    } finally {
      setSavingPdf(false);
    }
  };

  const autoPrinted = useRef(false);
  useEffect(() => {
    if (!autoPrint || autoPrinted.current || loading || !data) return;
    autoPrinted.current = true;
    // Let the grid paint before the browser's Save as PDF window opens
    const t = setTimeout(
      () => printWithFileName(buildFileName('Polevar', work.workCode, work.name, fileDate()), { landscape: true }),
      300
    );
    return () => clearTimeout(t);
  }, [autoPrint, loading, data, work.workCode, work.name]);

  const [exportingXlsx, setExportingXlsx] = useState(false);
  const handleExportXlsx = async () => {
    if (!data) return;
    setExportingXlsx(true);
    try {
      await downloadPolevarXlsx(work, data, buildFileName('Polevar', work.workCode, work.name, fileDate()));
    } catch (err: any) {
      setError(err?.message || 'Failed to create the Excel file');
    } finally {
      setExportingXlsx(false);
    }
  };

  return createPortal(
    <div className="print-doc fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-[96vw] max-h-[96vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-300 print-container">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-50/90 px-5 py-3 no-print">
          <div className="flex items-center space-x-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white text-sm shadow-xs">
              PV
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  POLE VAR REPORT
                </h3>
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full border border-blue-200">
                  {work.workCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Work: <span className="text-slate-800 font-bold">{work.name}</span>
                {work.workSite?.name ? ` • Site: ${work.workSite.name}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAddRow}
              className="btn-secondary"
            >
              <Plus className="h-3.5 w-3.5 text-amber-600" />
              <span>Add Location Row</span>
            </button>

            <button
              onClick={() => setIsAddingCol(!isAddingCol)}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-600" />
              <span>Add Column</span>
            </button>

            <button
              type="button"
              onClick={handleExportXlsx}
              disabled={!data || exportingXlsx}
              className="btn-secondary"
            >
              {exportingXlsx ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              )}
              <span>{exportingXlsx ? 'Creating Excel…' : 'Download Excel'}</span>
            </button>


            <button
              onClick={handleSave}
              disabled={saving}
              className={`inline-flex items-center space-x-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-xs transition cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {saveSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Report'}</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Column Adder Toolbar (Toggleable) */}
        {isAddingCol && (
          <div className="flex flex-wrap items-center gap-3 bg-amber-50/80 border-b border-amber-200 px-5 py-2.5 text-xs no-print">
            <span className="font-bold text-amber-900">Add New Column:</span>
            <input
              type="text"
              autoFocus
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              placeholder="Item name (e.g. 11kV Pin Insulator)"
              className="rounded border border-amber-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500/20 w-56"
            />
            <select
              value={newColCategory}
              onChange={(e) => setNewColCategory(e.target.value as any)}
              className="rounded border border-amber-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none"
            >
              <option value="materials">Materials (Golden)</option>
              <option value="labour">Labour (Green)</option>
              <option value="takenBack">Taken Back (Peach)</option>
            </select>
            <button
              type="button"
              onClick={handleAddColumn}
              className="btn-primary"
            >
              Add to Grid
            </button>
            <button
              type="button"
              onClick={() => setIsAddingCol(false)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 text-xs text-rose-700 flex items-center justify-between no-print">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="underline font-semibold">
              Dismiss
            </button>
          </div>
        )}

        {/* Main Grid View */}
        <div ref={pdfRef} className="flex-1 overflow-auto p-4 bg-slate-100/50">
          {loading ? (
            <div className="card overflow-hidden">
              <table className="w-full">
                <tbody className="divide-y divide-slate-300">
                  <TableRowsSkeleton rows={8} columns={7} />
                </tbody>
              </table>
            </div>
          ) : !data ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Unable to load Polevar data.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-xs border border-slate-300 overflow-hidden">
              {/* Sheet Title Bar (Matching Excel Sheet) */}
              <div className="border-b-2 border-slate-800 bg-white px-4 py-2 flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-bold tracking-wide text-slate-900 uppercase">
                  POLE VAR of {work.name}
                </h2>
                <div className="text-[11px] font-semibold text-slate-500 space-x-3">
                  <span>Work Order: <strong className="text-slate-800">{work.workOrder || work.workCode}</strong></span>
                  <span>Date: <strong className="text-slate-800">{formatDate(work.date)}</strong></span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs text-slate-800 border-slate-400">
                  <thead>
                    {/* Header Level 1: Category Groups */}
                    <tr className="border-b border-slate-400 text-center font-bold">
                      <th
                        rowSpan={2}
                        className="border-r border-b border-slate-400 bg-slate-100 p-2 text-center w-12 sticky left-0 z-20 font-bold"
                      >
                        SL No:
                      </th>
                      <th
                        rowSpan={2}
                        className="border-r border-b border-slate-400 bg-slate-100 p-2 text-center min-w-[110px] sticky left-12 z-20 font-bold"
                      >
                        Location
                      </th>

                      {/* Materials Category */}
                      {materialsCols.length > 0 && (
                        <th
                          colSpan={materialsCols.length}
                          className="border-r border-b border-slate-400 bg-[#f6b26b] text-slate-950 py-1.5 px-3 uppercase tracking-wider text-xs font-bold shadow-2xs"
                        >
                          Materials
                        </th>
                      )}

                      {/* Labour Category */}
                      {labourCols.length > 0 && (
                        <th
                          colSpan={labourCols.length}
                          className="border-r border-b border-slate-400 bg-[#93c47d] text-slate-950 py-1.5 px-3 uppercase tracking-wider text-xs font-bold shadow-2xs"
                        >
                          Labour
                        </th>
                      )}

                      {/* Taken Back Category */}
                      {takenBackCols.length > 0 && (
                        <th
                          colSpan={takenBackCols.length}
                          className="border-b border-slate-400 bg-[#f9cb9c] text-slate-950 py-1.5 px-3 uppercase tracking-wider text-xs font-bold shadow-2xs"
                        >
                          Taken Back
                        </th>
                      )}
                    </tr>

                    {/* Header Level 2: Sub-columns (Rotated/Vertical Header Text) */}
                    <tr className="border-b-2 border-slate-800 bg-slate-50 font-bold text-slate-900">
                      {/* Materials Subcolumns */}
                      {materialsCols.map((col) => (
                        <th
                          key={col.id}
                          className="border-r border-slate-300 p-1 w-11 min-w-[44px] max-w-[48px] align-bottom text-center bg-amber-50/50 group relative hover:bg-amber-100/60 transition cursor-pointer"
                          onClick={() => handleOpenEditCol(col)}
                          title={`Click to rename: ${col.name}`}
                        >
                          <div className="h-36 flex items-end justify-center pb-2">
                            <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-bold text-slate-800 whitespace-nowrap tracking-tight uppercase group-hover:text-blue-700">
                              {col.name}
                            </span>
                          </div>
                          <div className="absolute top-1 right-0.5 flex flex-col items-center space-y-0.5 opacity-0 group-hover:opacity-100 no-print transition">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditCol(col);
                              }}
                              title={`Rename column: ${col.name}`}
                              className="p-1 rounded bg-white/90 text-blue-600 hover:text-blue-800 shadow-2xs hover:bg-white"
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteColumn(col.id);
                              }}
                              title={`Delete column: ${col.name}`}
                              className="p-1 rounded bg-white/90 text-rose-500 hover:text-rose-700 shadow-2xs hover:bg-white"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </th>
                      ))}

                      {/* Labour Subcolumns */}
                      {labourCols.map((col) => (
                        <th
                          key={col.id}
                          className="border-r border-slate-300 p-1 w-11 min-w-[44px] max-w-[48px] align-bottom text-center bg-emerald-50/50 group relative hover:bg-emerald-100/60 transition cursor-pointer"
                          onClick={() => handleOpenEditCol(col)}
                          title={`Click to rename: ${col.name}`}
                        >
                          <div className="h-36 flex items-end justify-center pb-2">
                            <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-bold text-slate-800 whitespace-nowrap tracking-tight uppercase group-hover:text-blue-700">
                              {col.name}
                            </span>
                          </div>
                          <div className="absolute top-1 right-0.5 flex flex-col items-center space-y-0.5 opacity-0 group-hover:opacity-100 no-print transition">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditCol(col);
                              }}
                              title={`Rename column: ${col.name}`}
                              className="p-1 rounded bg-white/90 text-blue-600 hover:text-blue-800 shadow-2xs hover:bg-white"
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteColumn(col.id);
                              }}
                              title={`Delete column: ${col.name}`}
                              className="p-1 rounded bg-white/90 text-rose-500 hover:text-rose-700 shadow-2xs hover:bg-white"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </th>
                      ))}

                      {/* Taken Back Subcolumns */}
                      {takenBackCols.map((col) => (
                        <th
                          key={col.id}
                          className="border-r border-slate-300 p-1 w-11 min-w-[44px] max-w-[48px] align-bottom text-center bg-orange-50/50 group relative hover:bg-orange-100/60 transition cursor-pointer"
                          onClick={() => handleOpenEditCol(col)}
                          title={`Click to rename: ${col.name}`}
                        >
                          <div className="h-36 flex items-end justify-center pb-2">
                            <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-bold text-slate-800 whitespace-nowrap tracking-tight uppercase group-hover:text-blue-700">
                              {col.name}
                            </span>
                          </div>
                          <div className="absolute top-1 right-0.5 flex flex-col items-center space-y-0.5 opacity-0 group-hover:opacity-100 no-print transition">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditCol(col);
                              }}
                              title={`Rename column: ${col.name}`}
                              className="p-1 rounded bg-white/90 text-blue-600 hover:text-blue-800 shadow-2xs hover:bg-white"
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteColumn(col.id);
                              }}
                              title={`Delete column: ${col.name}`}
                              className="p-1 rounded bg-white/90 text-rose-500 hover:text-rose-700 shadow-2xs hover:bg-white"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {data.rows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className="hover:bg-amber-50/30 transition-colors border-b border-slate-300"
                      >
                        {/* SL No */}
                        <td className="border-r border-slate-300 bg-slate-50 text-center font-bold text-slate-600 p-1 sticky left-0 z-10">
                          {idx + 1}
                        </td>

                        {/* Location */}
                        <td className="border-r border-slate-400 bg-white p-1 sticky left-12 z-10 group">
                          <div className="flex items-center space-x-1">
                            <input
                              type="text"
                              value={row.location}
                              onChange={(e) =>
                                handleLocationChange(row.id, e.target.value)
                              }
                              placeholder="e.g. PU 6/L5"
                              className="w-full text-center font-bold text-slate-900 bg-transparent border-0 focus:ring-1 focus:ring-blue-500/20 rounded px-1 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              title="Delete row"
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 no-print pr-1"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        {/* Column Cells */}
                        {data.columns.map((col) => {
                          const val = row.values[col.id];
                          return (
                            <td
                              key={col.id}
                              className="border-r border-slate-300 p-0 text-center"
                            >
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={val === undefined ? '' : val}
                                onChange={(e) =>
                                  handleCellChange(row.id, col.id, e.target.value)
                                }
                                className="w-full h-8 text-center font-mono font-medium text-slate-900 bg-transparent border-0 focus:bg-amber-50 focus:ring-1 focus:ring-blue-500/20 rounded-none text-xs p-0 m-0"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>

                  {/* Table Footer: Total Row */}
                  <tfoot>
                    <tr className="border-t-2 border-slate-800 bg-slate-100 font-bold text-slate-950">
                      <td className="border-r border-slate-400 p-2 text-center sticky left-0 z-10 bg-slate-100"></td>
                      <td className="border-r border-slate-400 p-2 text-center font-bold text-sm uppercase tracking-wider sticky left-12 z-10 bg-slate-100">
                        Total
                      </td>

                      {data.columns.map((col) => {
                        const total = getColumnTotal(col.id);
                        return (
                          <td
                            key={col.id}
                            className="border-r border-slate-400 p-1.5 text-center font-mono font-bold text-xs text-slate-950 bg-slate-100"
                          >
                            {total}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Quick Guidance Footer (Hidden in print) */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 no-print">
            <div className="flex items-center space-x-2">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              <span>
                Click on any cell to edit numbers directly. The <strong>Total</strong> row updates in real time.
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span>Yellow: Materials</span>
              <span>Green: Labour</span>
              <span>Peach: Taken Back</span>
            </div>
          </div>
        </div>

        {/* Column Rename Modal */}
        {editingCol && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 no-print">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 p-5 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                <div className="flex items-center space-x-2">
                  <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Edit2 className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Column Name</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCol(null)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="form-label">
                    Column / Item Name *
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={editColName}
                    onChange={(e) => setEditColName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveColEdit();
                      } else if (e.key === 'Escape') {
                        setEditingCol(null);
                      }
                    }}
                    className="form-input font-semibold"
                    placeholder="e.g. 9M POLE, ACSR CONDUCTOR"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Category Section
                  </label>
                  <select
                    value={editColCategory}
                    onChange={(e: any) => setEditColCategory(e.target.value)}
                    className="form-input font-semibold"
                  >
                    <option value="materials">Materials (Orange)</option>
                    <option value="labour">Labour (Green)</option>
                    <option value="takenBack">Taken Back (Peach)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-300">
                <button
                  type="button"
                  onClick={() => setEditingCol(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveColEdit}
                  disabled={!editColName.trim()}
                  className="btn-primary"
                >
                  Update Column
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
