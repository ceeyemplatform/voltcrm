import { createPortal } from 'react-dom';
import React, { useRef, useState } from 'react';
import { buildFileName, fileDate, printWithFileName, usePrintIsolation } from '../../lib/print';
import { Printer, X, Download, Loader2 } from 'lucide-react';
import { PolevarRow, PolevarReportResponse } from '../../types';
import { PrintHeader } from '../common/PrintHeader';

interface PolevarPrintViewProps {
  report: PolevarReportResponse;
  filters: {
    startDate?: string;
    endDate?: string;
    workCode?: string;
    workSiteId?: string;
  };
  onClose: () => void;
}

export const PolevarPrintView: React.FC<PolevarPrintViewProps> = ({
  report,
  filters,
  onClose,
}) => {
  // While open, printing outputs only this popup
  usePrintIsolation();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const handlePrint = async () => {
    if (!pdfRef.current) return;
    setSavingPdf(true);
    try {
      printWithFileName(buildFileName('Polevar Report', filters.workCode, fileDate()));
    } finally {
      setSavingPdf(false);
    }
  };

  const filterSummary = [
    filters.workCode ? `Work Code: ${filters.workCode}` : null,
    filters.startDate || filters.endDate
      ? `Date: ${filters.startDate || 'Initial'} to ${
          filters.endDate || 'Current'
        }`
      : 'All Works',
  ]
    .filter(Boolean)
    .join(' | ');

  return createPortal(
    <div className="print-doc fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden print-container my-auto">
        <div className="flex items-center justify-between border-b border-slate-300 bg-slate-50 px-6 py-3 no-print">
          <div className="text-xs font-semibold text-slate-700">
            Polevar Consolidated Material Report
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              disabled={savingPdf}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-[#0066FF] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-600 transition cursor-pointer"
            >
              {savingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span>{savingPdf ? 'Saving PDF…' : 'Download PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div ref={pdfRef} className="p-8 max-h-[85vh] overflow-y-auto">
          <PrintHeader
            title="CONSOLIDATED POLEVAR & MATERIAL AUDIT REPORT"
            subtitle={`Material consumption audit across all works: ${filterSummary}`}
          />

          {/* Metric cards */}
          <div className="mb-6 grid grid-cols-4 gap-4 text-xs">
            <div className="border border-slate-300 bg-slate-50/70 p-3 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-slate-500">
                Material Items
              </span>
              <p className="mt-1 text-base font-black text-slate-900 font-mono">
                {report.summary.totalRows}
              </p>
            </div>
            <div className="border border-slate-300 bg-slate-50/70 p-3 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-slate-500">
                Total Units Issued
              </span>
              <p className="mt-1 text-base font-black text-slate-900 font-mono">
                {report.summary.totalIssued.toLocaleString()}
              </p>
            </div>
            <div className="border border-slate-300 bg-slate-50/70 p-3 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-slate-500">
                Total Units Used
              </span>
              <p className="mt-1 text-base font-black text-slate-900 font-mono">
                {report.summary.totalUsed.toLocaleString()}
              </p>
            </div>
            <div className="border border-amber-200 bg-amber-50/50 p-3 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-amber-900">
                Net Variance (Surplus)
              </span>
              <p className="mt-1 text-base font-black text-amber-900 font-mono">
                {report.summary.totalVariance > 0
                  ? `+${report.summary.totalVariance.toLocaleString()}`
                  : report.summary.totalVariance.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="mb-6">
            <table className="w-full text-left text-xs border border-slate-300">
              <thead className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 w-10 text-center">#</th>
                  <th className="p-2 border-r border-slate-300 w-24">Work Code</th>
                  <th className="p-2 border-r border-slate-300">Work Title & Site</th>
                  <th className="p-2 border-r border-slate-300">Material Name</th>
                  <th className="p-2 border-r border-slate-300 text-right w-20">Issued</th>
                  <th className="p-2 border-r border-slate-300 text-right w-20">Used</th>
                  <th className="p-2 border-r border-slate-300 text-right w-20">Variance</th>
                  <th className="p-2">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-500 italic">
                      No material records logged matching criteria.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="p-2 border-r border-slate-300 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-300 font-mono font-bold text-slate-900">
                        {row.workCode}
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <span className="font-semibold text-slate-800 block">
                          {row.workName}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Site: {row.workSiteName}
                        </span>
                      </td>
                      <td className="p-2 border-r border-slate-300 font-medium text-slate-900">
                        {row.materialName}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono">
                        {row.quantityIssued}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono">
                        {row.quantityUsed}
                      </td>
                      <td
                        className={`p-2 border-r border-slate-300 text-right font-mono font-bold ${
                          row.variance > 0
                            ? 'text-emerald-700'
                            : row.variance < 0
                            ? 'text-rose-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {row.variance > 0 ? `+${row.variance}` : row.variance}
                      </td>
                      <td className="p-2 text-slate-600">
                        {row.remarks || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 pt-8 text-xs border-t border-slate-300 mt-6">
            <div>
              <p className="font-semibold text-slate-800">Materials Incharge:</p>
              <div className="h-10 border-b border-dashed border-slate-300 w-44 mt-2" />
            </div>
            <div className="text-right flex flex-col items-end">
              <p className="font-semibold text-slate-800">
                Senior Electrical Engineer / Store Officer
              </p>
              <div className="h-10 border-b border-dashed border-slate-300 w-44 mt-2" />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
