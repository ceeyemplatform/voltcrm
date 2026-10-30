import { createPortal } from 'react-dom';
import React, { useRef, useState } from 'react';
import { buildFileName, fileDate, printWithFileName, usePrintIsolation } from '../../lib/print';
import { Printer, X, Download, Loader2 } from 'lucide-react';
import { Quotation } from '../../types';
import { QuotationHeader } from './QuotationHeader';
import { PdfButton } from '../common/PdfButton';
import { isRichTextEmpty, sanitizeRichText } from '../../lib/richText';
import { useCompany } from '../../context/CompanyContext';

interface QuotationPrintViewProps {
  quotation: Quotation;
  onClose: () => void;
}

export const QuotationPrintView: React.FC<QuotationPrintViewProps> = ({
  quotation,
  onClose,
}) => {
  // While open, printing outputs only this popup
  usePrintIsolation();
  const { company } = useCompany();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const handlePrint = async () => {
    if (!pdfRef.current) return;
    setSavingPdf(true);
    try {
      printWithFileName(buildFileName('Quotation', quotation.quotationNo, quotation.clientName));
    } finally {
      setSavingPdf(false);
    }
  };

  const gstAmount = (quotation.subtotal * quotation.gstPercent) / 100;
  const isWritten = quotation.kind === 'WRITTEN';
  const pages = (Array.isArray(quotation.pages) ? quotation.pages : []).filter((p) => !isRichTextEmpty(p.html));

  /** Free text pages; each one after the first page of the document starts a new sheet */
  const renderPages = (startOnNewSheet: boolean) =>
    pages.map((p, idx) => (
      <div
        key={p.id || idx}
        className={`rich-page ${
          startOnNewSheet || idx > 0 ? 'print-page-break mt-8 border-t border-dashed border-slate-300 pt-8 print:mt-0 print:border-0 print:pt-0' : ''
        }`}
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(p.html) }}
      />
    ));

  // Company header and client block, shared by priced and written quotations
  const docHeader = (
    <QuotationHeader
      quotationNo={quotation.quotationNo}
      date={quotation.date}
      pan={quotation.pan}
      clientName={quotation.clientName}
      address={quotation.address || quotation.workSite?.address}
    />
  );

  const totalSupply = (quotation.items || []).reduce((sum, item) => {
    if (item.itemType === 'LABOUR') return sum;
    const sRate =
      item.supplyRate !== undefined
        ? Number(item.supplyRate)
        : item.itemType === 'SUPPLY'
        ? Number(item.rate || 0)
        : Number(item.rate || 0) - Number(item.labourRate || 0);
    return sum + Number(item.qty || 0) * sRate;
  }, 0);

  const totalLabour = (quotation.items || []).reduce((sum, item) => {
    if (item.itemType === 'SUPPLY') return sum;
    const lRate =
      item.labourRate !== undefined
        ? Number(item.labourRate)
        : item.itemType === 'LABOUR'
        ? Number(item.rate || 0)
        : 0;
    return sum + Number(item.qty || 0) * lRate;
  }, 0);

  return createPortal(
    <div className="print-doc fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden print-container my-auto">
        {/* Floating action bar */}
        <div className="flex items-center justify-between border-b border-slate-300 bg-slate-50 px-6 py-3 no-print">
          <div className="text-xs font-semibold text-slate-700">
            Quotation: {quotation.quotationNo}
          </div>
          <div className="flex items-center space-x-2">
            <PdfButton fileName={() => buildFileName('Quotation', quotation.quotationNo, quotation.clientName, fileDate())} />
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable View */}
        <div ref={pdfRef} className="max-h-[85vh] overflow-y-auto">
          {isWritten ? (
            <>
              <div className="print-fit-wide p-8 pb-0">{docHeader}</div>
              <div className="mx-auto max-w-[794px] px-8 pb-8">{renderPages(false)}</div>
            </>
          ) : (
          <>
          <div className="print-fit-wide p-8">
          {docHeader}

          {/* Line Items Table */}
          <div className="mb-6 overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-300">
              <thead className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 w-10 text-center">#</th>
                  <th className="p-2 border-r border-slate-300 min-w-[200px]">Items</th>
                  <th className="p-2 border-r border-slate-300 text-center w-28">Scope</th>
                  <th className="p-2 border-r border-slate-300 text-center w-16">Unit</th>
                  <th className="p-2 border-r border-slate-300 text-right w-16">Qty</th>
                  <th className="p-2 border-r border-slate-300 text-right w-24">Supply (₹)</th>
                  <th className="p-2 border-r border-slate-300 text-right w-24">Labour (₹)</th>
                  <th className="p-2 border-r border-slate-300 text-right w-24">Unit Rate (₹)</th>
                  <th className="p-2 text-right w-28">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {(!quotation.items || quotation.items.length === 0) ? (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-slate-500 italic">
                      No items specified.
                    </td>
                  </tr>
                ) : (
                  quotation.items.map((item, idx) => {
                    const itemType = item.itemType || 'BOTH';
                    const supplyRate =
                      itemType === 'LABOUR'
                        ? null
                        : item.supplyRate !== undefined
                        ? Number(item.supplyRate)
                        : itemType === 'SUPPLY'
                        ? Number(item.rate || 0)
                        : Number(item.rate || 0) - Number(item.labourRate || 0);

                    const labourRate =
                      itemType === 'SUPPLY'
                        ? null
                        : item.labourRate !== undefined
                        ? Number(item.labourRate)
                        : itemType === 'LABOUR'
                        ? Number(item.rate || 0)
                        : 0;

                    return (
                      <tr key={idx}>
                        <td className="p-2 border-r border-slate-300 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-300 font-medium text-slate-900">
                          {item.description}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-center">
                          {itemType === 'BOTH' && (
                            <span className="inline-block text-[9px] px-1.5 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Supply & Labour
                            </span>
                          )}
                          {itemType === 'SUPPLY' && (
                            <span className="inline-block text-[9px] px-1.5 py-0.5 rounded font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Supply
                            </span>
                          )}
                          {itemType === 'LABOUR' && (
                            <span className="inline-block text-[9px] px-1.5 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Labour
                            </span>
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-center text-slate-600">
                          {item.unit || '-'}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono text-slate-800">
                          {item.qty}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono text-slate-700">
                          {supplyRate !== null ? `₹${supplyRate.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono text-slate-700">
                          {labourRate !== null ? `₹${labourRate.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-right font-mono text-slate-800 font-semibold">
                          ₹{Number(item.rate || 0).toLocaleString()}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          ₹{Number(item.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="flex justify-end mb-6">
            <div className="w-80 border border-slate-300 bg-slate-50/70 p-3 rounded text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Supply Component Value:</span>
                <span className="font-mono font-semibold text-slate-800">
                  ₹{totalSupply.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Labour / Erection Component:</span>
                <span className="font-mono font-semibold text-slate-800">
                  ₹{totalLabour.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-700 font-semibold pt-1 border-t border-slate-300">
                <span>Subtotal (Excl. GST):</span>
                <span className="font-mono font-bold text-slate-900">
                  ₹{quotation.subtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST ({quotation.gstPercent}%):</span>
                <span className="font-mono font-semibold text-slate-800">
                  ₹{gstAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-950 pt-2 border-t border-slate-300">
                <span>Total Quotation Value:</span>
                <span className="font-mono text-amber-900">
                  ₹{quotation.total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="border-t border-slate-300 pt-4 text-[11px] text-slate-600 space-y-1">
            <h4 className="font-bold uppercase tracking-wider text-slate-800 text-[10px]">
              Terms & Conditions:
            </h4>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-500">
              <li>50% advance along with work order, 40% against progressive running bills, 10% on completion.</li>
              <li>Civil work, trenching, power supply during execution to be provided by client unless explicitly quoted.</li>
              <li>Electrical safety approvals and statutory liaisoning charges as per actual state electricity board tariff.</li>
              <li>Materials supplied strictly meet IS standards and carry standard manufacturer warranty.</li>
            </ol>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 pt-10 text-xs border-t border-slate-300 mt-6">
            <div>
              <p className="font-semibold text-slate-800">Client Acceptance:</p>
              <div className="h-12 border-b border-dashed border-slate-300 w-44 mt-2" />
              <p className="text-[10px] text-slate-400 mt-1">
                Authorized Signatory & Seal
              </p>
            </div>
            <div className="text-right flex flex-col items-end">
              <p className="font-semibold text-slate-800">
                For {company.signatoryName || company.companyName || 'the company'}:
              </p>
              <div className="h-12 border-b border-dashed border-slate-300 w-44 mt-2" />
              <p className="text-[10px] text-slate-400 mt-1">
                Authorized Signatory
              </p>
            </div>
          </div>
          </div>

          {/* Extra free text pages, each on its own A4 sheet */}
          {pages.length > 0 && <div className="mx-auto max-w-[794px] px-8 pb-8">{renderPages(true)}</div>}
          </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
