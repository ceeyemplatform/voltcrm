import React from 'react';
import { PrintHeader } from '../common/PrintHeader';

interface QuotationHeaderProps {
  quotationNo?: string;
  date?: string;
  pan?: string | null;
  clientName?: string;
  address?: string | null;
}

/** Company header and "issued to" block at the top of every quotation (print and editor preview). */
export const QuotationHeader: React.FC<QuotationHeaderProps> = ({ quotationNo, date, pan, clientName, address }) => (
  <>
    <PrintHeader title="QUOTATION" referenceNo={quotationNo} date={date} pan={pan} />

    {/* Client & Work Site Billing Info */}
    <div className="mb-6 grid grid-cols-2 gap-6 border-b border-slate-300 pb-5 text-xs">
      <div>
        <span className="font-bold uppercase tracking-wider text-slate-400 block text-[10px] mb-1">
          QUOTATION ISSUED TO:
        </span>
        <p className="text-sm font-bold text-slate-900">{clientName || <span className="text-slate-400">Client name</span>}</p>
        {address && <p className="text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{address}</p>}
      </div>
      <div className="text-right">
        <p className="text-slate-500 text-[11px] mt-2">Quotation Validity: 30 Days from date of issue</p>
      </div>
    </div>
  </>
);
