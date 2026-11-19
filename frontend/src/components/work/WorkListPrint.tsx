import React, { useMemo, useState } from 'react';
import { formatDate } from '../../lib/dates';
import { buildFileName, fileDate } from '../../lib/print';
import { formatStatusLabel } from '../../lib/statusConfig';
import { Work } from '../../types';
import { PrintDocument } from '../common/PrintDocument';
import { PrintHeader } from '../common/PrintHeader';

interface WorkListPrintProps {
  /** Works as currently shown (already filtered and sorted) */
  works: Work[];
  /** Plain description of the active filters; empty when none are set */
  filterSummary: string;
  onClose: () => void;
}

const COUNT_CHOICES = [10, 25, 50, 100];

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** Printable list of work entries: the filtered ones, or the latest N when nothing is filtered. */
export const WorkListPrint: React.FC<WorkListPrintProps> = ({ works, filterSummary, onClose }) => {
  const filtered = Boolean(filterSummary);
  const [count, setCount] = useState<number | 'all'>(filtered || works.length <= 25 ? 'all' : 25);
  const [custom, setCustom] = useState('');
  const [showStatus, setShowStatus] = useState(true);
  const [showEnd, setShowEnd] = useState(true);

  // Without filters, "latest" means the most recent start dates
  const rows = useMemo(() => {
    if (filtered || count === 'all') return works;
    const latest = [...works].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return latest.slice(0, count);
  }, [works, filtered, count]);

  const total = rows.reduce((s, w) => s + Number(w.contractorAmount || 0), 0);
  const th = 'border border-slate-300 bg-slate-100 px-2 py-1.5 text-left font-semibold';
  const td = 'border border-slate-300 px-2 py-1.5 align-top';

  const controls = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
      {filtered ? (
        <span>
          Printing <b className="text-slate-900">{works.length}</b> work{works.length === 1 ? '' : 's'} matching the filters.
        </span>
      ) : (
        <span className="flex flex-wrap items-center gap-1.5">
          Latest
          {COUNT_CHOICES.filter((n) => n < works.length).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setCount(n);
                setCustom('');
              }}
              className={`rounded-md px-2 py-1 font-medium ring-1 ring-inset ${
                count === n ? 'bg-blue-50 text-blue-700 ring-blue-300' : 'bg-white ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCount('all');
              setCustom('');
            }}
            className={`rounded-md px-2 py-1 font-medium ring-1 ring-inset ${
              count === 'all' ? 'bg-blue-50 text-blue-700 ring-blue-300' : 'bg-white ring-slate-300 hover:bg-slate-50'
            }`}
          >
            All {works.length}
          </button>
          <input
            type="number"
            min={1}
            max={works.length}
            value={custom}
            placeholder="Other"
            onChange={(e) => {
              setCustom(e.target.value);
              const n = Math.floor(Number(e.target.value));
              if (n > 0) setCount(Math.min(n, works.length));
            }}
            className="form-input !w-20 !py-1 text-xs"
          />
        </span>
      )}
      <label className="inline-flex items-center gap-1.5">
        <input type="checkbox" checked={showStatus} onChange={(e) => setShowStatus(e.target.checked)} />
        Status
      </label>
      <label className="inline-flex items-center gap-1.5">
        <input type="checkbox" checked={showEnd} onChange={(e) => setShowEnd(e.target.checked)} />
        End date
      </label>
    </div>
  );

  return (
    <PrintDocument
      title="Work Entry List"
      subtitle={`${rows.length} work${rows.length === 1 ? '' : 's'} · ${money(total)} contract value`}
      fileName={() => buildFileName('WorkList', fileDate())}
      onClose={onClose}
      controls={controls}
    >
      <PrintHeader
        title="WORK ENTRY LIST"
        date={new Date().toISOString()}
        subtitle={filterSummary || (count === 'all' ? 'All work entries' : `Latest ${rows.length} work entries`)}
      />

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={`${th} w-8 text-center`}>#</th>
            <th className={th}>Work Code</th>
            <th className={th}>Job Title</th>
            <th className={th}>Site</th>
            <th className={`${th} text-right`}>Contract (₹)</th>
            <th className={th}>Start Date</th>
            {showEnd && <th className={th}>End Date</th>}
            {showStatus && <th className={th}>Status</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6 + Number(showEnd) + Number(showStatus)} className={`${td} py-6 text-center italic text-slate-500`}>
                No work entries to print.
              </td>
            </tr>
          ) : (
            rows.map((w, i) => (
              <tr key={w.id}>
                <td className={`${td} text-center text-slate-500`}>{i + 1}</td>
                <td className={`${td} whitespace-nowrap font-mono font-semibold`}>{w.workCode}</td>
                <td className={td}>{w.name}</td>
                <td className={td}>
                  {w.workSite
                    ? `${w.workSite.siteCode ? `${w.workSite.siteCode} · ` : ''}${w.workSite.name}`
                    : '—'}
                </td>
                <td className={`${td} whitespace-nowrap text-right font-mono`}>
                  {Number(w.contractorAmount) > 0 ? Number(w.contractorAmount).toLocaleString('en-IN') : '—'}
                </td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(w.date)}</td>
                {showEnd && <td className={`${td} whitespace-nowrap`}>{w.endDate ? formatDate(w.endDate) : '—'}</td>}
                {showStatus && <td className={td}>{formatStatusLabel(w.status)}</td>}
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="font-bold">
              <td className={`${td} bg-slate-50 text-right`} colSpan={4}>
                Total contract value
              </td>
              <td className={`${td} whitespace-nowrap bg-slate-50 text-right font-mono`}>
                {total.toLocaleString('en-IN')}
              </td>
              <td className={`${td} bg-slate-50`} colSpan={1 + Number(showEnd) + Number(showStatus)} />
            </tr>
          </tfoot>
        )}
      </table>
    </PrintDocument>
  );
};
