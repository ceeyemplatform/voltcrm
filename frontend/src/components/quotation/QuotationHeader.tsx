import React from 'react';
import { formatDate } from '../../lib/dates';
import { PrintHeader } from '../common/PrintHeader';

interface QuotationHeaderProps {
  quotationNo?: string;
  date?: string;
  pan?: string | null;
  clientName?: string;
  address?: string | null;
  /** Company header above the title (a page can leave it out) */
  showCompany?: boolean;
}

/**
 * Top of a quotation: company header, then QUOTATION under the header line with the number
 * on the left and the date on the right, then who it is issued to. Used by print and editor.
 */
export const QuotationHeader: React.FC<QuotationHeaderProps> = ({
  quotationNo,
  date,
  pan,
  clientName,
  address,
  showCompany = true,
}) => (
  <>
    {showCompany && <PrintHeader pan={pan} />}

    <h2 className="mt-1 text-center text-sm font-bold uppercase tracking-[0.2em] text-black">Quotation</h2>
    <div className="mt-3 mb-5 flex items-end justify-between gap-4 text-xs">
      <p className="text-slate-700">
        Quotation No: <span className="font-mono font-bold text-black">{quotationNo || '—'}</span>
      </p>
      <p className="text-slate-700">
        Date: <span className="font-bold text-black">{date ? formatDate(date) : '—'}</span>
      </p>
    </div>

    {/* Client & Work Site Billing Info */}
    <div className="mb-6 border-b border-slate-300 pb-5 text-xs">
      <div>
        <span className="font-bold uppercase tracking-wider text-slate-400 block text-[10px] mb-1">
          QUOTATION ISSUED TO:
        </span>
        <p className="text-sm font-bold text-slate-900">{clientName || <span className="text-slate-400">Client name</span>}</p>
        {address && <p className="text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{address}</p>}
      </div>
    </div>
  </>
);

/** Whether a free text page shows the company header: written quotations' first page does unless turned off */
export const pageHasHeader = (page: { showHeader?: boolean }, index: number, isWritten: boolean) =>
  page.showHeader ?? (isWritten && index === 0);
