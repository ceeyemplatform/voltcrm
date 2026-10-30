import React from 'react';
import { formatDate } from '../../lib/dates';
import { Zap } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { CompanySettings } from '../../types';

interface PrintHeaderProps {
  title: string;
  subtitle?: string;
  referenceNo?: string;
  date?: string;
  /** PAN number shown with the company's registration details */
  pan?: string | null;
  /** Unsaved details to show instead of the saved ones (settings preview) */
  preview?: CompanySettings;
}

export const PrintHeader: React.FC<PrintHeaderProps> = ({
  title,
  subtitle,
  referenceNo,
  date,
  pan,
  preview,
}) => {
  const saved = useCompany().company;
  const company = preview || saved;
  const regLine = [
    company.regNo && `Reg. No: ${company.regNo}`,
    company.gstin && `GSTIN: ${company.gstin}`,
    pan && `PAN: ${pan}`,
    company.phone && `Contact: ${company.phone}`,
    company.email && `Email: ${company.email}`,
  ]
    .filter(Boolean)
    .join(' | ');
  return (
    <div className="mb-6 border-b-2 border-slate-900 pb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          {company.logo ? (
            <img src={company.logo} alt="" className="h-12 max-w-[120px] flex-shrink-0 object-contain" />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
              <Zap className="h-7 w-7 fill-white" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
              {company.companyName || 'Company name'}
            </h1>
            {company.tagline && (
              <p className="text-xs text-slate-600 font-medium tracking-wide">{company.tagline}</p>
            )}
            {company.address && <p className="text-[11px] text-slate-500">{company.address}</p>}
            {regLine && <p className="text-[11px] text-slate-500">{regLine}</p>}
          </div>
        </div>

        <div className="text-right">
          <span className="inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded bg-slate-900 text-white">
            {title}
          </span>
          {referenceNo && (
            <p className="text-xs font-mono font-bold text-slate-800 mt-1.5">
              Ref: {referenceNo}
            </p>
          )}
          {date && (
            <p className="text-xs text-slate-500 mt-0.5">
              Date: {formatDate(date)}
            </p>
          )}
        </div>
      </div>
      {subtitle && (
        <div className="mt-2 text-xs text-slate-600 italic">
          {subtitle}
        </div>
      )}
    </div>
  );
};
