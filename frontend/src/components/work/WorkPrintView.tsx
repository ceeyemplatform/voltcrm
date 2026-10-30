import React, { useEffect, useMemo, useState } from 'react';
import { buildFileName, fileDate } from '../../lib/print';
import { formatDate, todayISO } from '../../lib/dates';
import { CalendarRange, RotateCcw, Filter, CreditCard, UserRound, Eye, ArrowLeftRight } from 'lucide-react';
import { Work, DailyWorkDetail, Expense } from '../../types';
import { api } from '../../lib/api';
import { getAllPaymentModes } from '../../lib/expenseConfig';
import { PrintHeader } from '../common/PrintHeader';
import { PrintDocument } from '../common/PrintDocument';
import { Skeleton } from '../common/Skeleton';
import {
  cashTotals,
  matchesStatusFilter,
  memberMode,
  memberStatus,
  otherTotal,
  statusLabel,
  txnStatus,
  StatusFilter,
  STATUS_FILTERS,
  wagesTotal,
} from '../../lib/payments';

interface WorkPrintViewProps {
  work: Work;
  onClose: () => void;
}

type StatementRow = Expense & { isDailyWorkEntry?: boolean };
type PeriodMode = 'all' | 'day' | 'range' | 'month' | 'year';
type TypeMode = '' | 'income' | 'expense' | 'wages' | 'site' | 'other';

const TYPE_LABELS: Record<TypeMode, string> = {
  '': 'All transactions',
  income: 'Income (payments in)',
  expense: 'All outgoing',
  wages: 'Daily wages',
  site: 'Daily site expenses',
  other: 'Other expenses',
};

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const num = (n: number) => Number(n || 0).toLocaleString('en-IN');
const todayStr = () => todayISO();
const dayKey = (d: string) => new Date(d).toISOString().slice(0, 10);
const fmtDate = (d?: string) =>
  d ? formatDate(d) : '—';
const modesOf = (t: Expense) =>
  (t.paymentMode && t.paymentMode !== 'Daily Log Wages' ? t.paymentMode : '').split(' / ').filter(Boolean);

const Label: React.FC<{ icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }> = ({
  icon: Icon,
  children,
}) => (
  <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
    <Icon className="h-3.5 w-3.5 text-slate-400" />
    {children}
  </span>
);

export const WorkPrintView: React.FC<WorkPrintViewProps> = ({ work: initialWork, onClose }) => {
  // List rows can be partial (e.g. no daily logs); fetch the full record for printing
  const [work, setWork] = useState<Work>(initialWork);
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (same shape as the expense statement)
  const [period, setPeriod] = useState<PeriodMode>('all');
  const [day, setDay] = useState(todayStr());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [type, setType] = useState<TypeMode>('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [mode, setMode] = useState('');
  const [worker, setWorker] = useState('');
  const [showLogs, setShowLogs] = useState(true);
  const [showStatement, setShowStatement] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.works.get(initialWork.id).then((full) => active && setWork(full)),
      // Same rows as the expense tracker: daily wages, daily site expenses and transactions for this work
      api.expenses.summary({ workId: initialWork.id }).then((d) => active && setRows(d.items)),
    ])
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [initialWork.id]);

  const inPeriod = (date: string) => {
    const k = dayKey(date);
    if (period === 'day') return k === day;
    if (period === 'range') return (!from || k >= from) && (!to || k <= to);
    if (period === 'month') return k.slice(0, 7) === month;
    if (period === 'year') return k.slice(0, 4) === year;
    return true;
  };

  const allLogs = useMemo(
    () =>
      [...(Array.isArray(work.dailyDetails) ? work.dailyDetails : [])].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [work.dailyDetails]
  );

  const workerNames = useMemo(
    () => Array.from(new Set(allLogs.flatMap((d) => (d.labourMembers || []).map((m) => m.name)).filter(Boolean))).sort(),
    [allLogs]
  );
  const years = useMemo(() => {
    const set = new Set([...rows, ...allLogs].map((r) => new Date(r.date).getFullYear()));
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [rows, allLogs]);
  const modeOptions = getAllPaymentModes(rows.flatMap(modesOf));

  const logs = useMemo(
    () =>
      allLogs.filter((d) => inPeriod(d.date) && (!worker || (d.labourMembers || []).some((m) => m.name === worker))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allLogs, period, day, from, to, month, year, worker]
  );

  const statement = useMemo(
    () =>
      rows
        .filter((t) => {
          if (!inPeriod(t.date)) return false;
          if (type === 'income' && t.type !== 'income') return false;
          if (type === 'expense' && t.type !== 'expense') return false;
          if (type === 'wages' && t.dailyPart !== 'wages') return false;
          if (type === 'site' && t.dailyPart !== 'other') return false;
          if (type === 'other' && (t.type !== 'expense' || t.isDailyWorkEntry)) return false;
          if (!matchesStatusFilter(t, status)) return false;
          if (mode && !modesOf(t).includes(mode)) return false;
          return true;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, period, day, from, to, month, year, type, status, mode]
  );
  const totals = cashTotals(statement);

  // One worker's wages per day, used instead of the statement when a worker is picked
  const workerRows = useMemo(
    () =>
      worker
        ? logs
            .map((d) => ({ d, m: (d.labourMembers || []).find((x) => x.name === worker)! }))
            .filter(({ d, m }) => {
              const st = memberStatus(d, m);
              if (status === 'given' && st !== 'paid') return false;
              if (status === 'pending' && st !== 'pending') return false;
              if (status === 'not_set' && st) return false;
              if (status === 'received' || status === 'to_get') return false;
              if (mode && (st !== 'paid' || memberMode(d, m) !== mode)) return false;
              return true;
            })
        : [],
    [worker, logs, status, mode]
  );

  const periodLabel = (() => {
    switch (period) {
      case 'day':
        return fmtDate(day);
      case 'range':
        return from || to ? `${from ? fmtDate(from) : 'Start'} – ${to ? fmtDate(to) : 'Today'}` : 'All dates';
      case 'month':
        return new Date(`${month}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      case 'year':
        return `Year ${year}`;
      default:
        return 'Full work (all dates)';
    }
  })();
  const hasFilters = Boolean(period !== 'all' || type || status || mode || worker);
  const scope = [
    type && TYPE_LABELS[type],
    status && STATUS_FILTERS.find(([id]) => id === status)?.[1],
    mode && `Mode: ${mode}`,
    worker && `Worker: ${worker}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const clearFilters = () => {
    setPeriod('all');
    setType('');
    setStatus('');
    setMode('');
    setWorker('');
    setShowLogs(true);
    setShowStatement(true);
  };

  const controls = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="lg:col-span-2">
        <Label icon={CalendarRange}>Period</Label>
        <div className="flex gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodMode)} className="form-input !w-auto">
            <option value="all">Full work</option>
            <option value="day">Single day</option>
            <option value="range">From – To</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
          {period === 'day' && <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="form-input" />}
          {period === 'month' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="form-input" />}
          {period === 'year' && (
            <select value={year} onChange={(e) => setYear(e.target.value)} className="form-input">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
          {period === 'range' && (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="form-input" title="From" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="form-input" title="To" />
            </>
          )}
        </div>
      </label>

      <label>
        <Label icon={ArrowLeftRight}>Type</Label>
        <select value={type} onChange={(e) => setType(e.target.value as TypeMode)} className="form-input">
          {(Object.keys(TYPE_LABELS) as TypeMode[]).map((k) => (
            <option key={k} value={k}>
              {TYPE_LABELS[k]}
            </option>
          ))}
        </select>
      </label>

      <label>
        <Label icon={Filter}>Status</Label>
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="form-input">
          {STATUS_FILTERS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <Label icon={CreditCard}>Payment mode</Label>
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="form-input">
          <option value="">All modes</option>
          {modeOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <Label icon={UserRound}>Worker</Label>
        <select value={worker} onChange={(e) => setWorker(e.target.value)} className="form-input">
          <option value="">All workers</option>
          {workerNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <div>
        <Label icon={Eye}>Include</Label>
        <div className="flex items-center gap-3 py-2 text-sm text-slate-700">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showLogs} onChange={(e) => setShowLogs(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            Daily log
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showStatement} onChange={(e) => setShowStatement(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            Statement
          </label>
        </div>
      </div>

      <div className="flex items-end">
        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasFilters && showLogs && showStatement}
          className="btn-secondary w-full disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4 text-slate-500" />
          Clear filters
        </button>
      </div>
    </div>
  );

  const details: [string, React.ReactNode][] = [
    ['Work title', work.name],
    ['Work site', work.workSite?.name || '—'],
    ['Electrical section', work.electricalSection || work.workSite?.section || '—'],
    ['Type of work', work.typeOfWork || '—'],
    ['Status', work.status?.replace(/_/g, ' ')],
    // Range only when the work has an end date; otherwise just the start date
    work.endDate
      ? ['Start – end', `${fmtDate(work.date)} – ${fmtDate(work.endDate)}`]
      : ['Start date', fmtDate(work.date)],
    ['Contract amount', money(Number(work.contractorAmount || 0))],
    ['Work order (W/O)', work.workOrder ? `${work.workOrder}${work.woDate ? ` · ${fmtDate(work.woDate)}` : ''}` : '—'],
    ['GST bill no.', [work.gstMillNumber, work.gstDate && fmtDate(work.gstDate)].filter(Boolean).join(' · ') || '—'],
  ];

  const th = 'px-2 py-2 text-left';
  const td = 'px-2 py-1.5 align-top';
  const statusCls = (st?: string) =>
    st === 'paid' ? 'text-emerald-700' : st === 'pending' || st === 'partial' ? 'text-amber-700' : 'text-slate-400';

  return (
    <PrintDocument
      title={`Work Report · ${work.workCode}`}
      fileName={() => buildFileName(
        'Work Report',
        work.workCode,
        work.name,
        worker || undefined,
        period !== 'all' ? periodLabel.replace(/\//g, '-') : undefined,
        fileDate()
      )}
      subtitle={`${periodLabel}${scope ? ` · ${scope}` : ''}`}
      onClose={onClose}
      controls={controls}
    >
      <PrintHeader title="WORK REPORT" referenceNo={work.workCode} date={new Date().toISOString()} />

      <div className="mb-5 grid grid-cols-3 border-l border-t border-slate-300 text-xs">
        {details.map(([label, value]) => (
          <div key={label} className="border-b border-r border-slate-300 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <p>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Period </span>
          <span className="font-semibold text-slate-900">{periodLabel}</span>
        </p>
        <p className="text-slate-600">{scope || 'All transactions, statuses and workers'}</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* Daily log: what was done and who worked */}
          {showLogs && (
            <>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-800">
                Daily work log · {logs.length} day{logs.length === 1 ? '' : 's'}
              </h3>
              <table className="mb-7 w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-y border-slate-400 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-700">
                    <th className={`${th} w-8 text-center`}>#</th>
                    <th className={`${th} w-20`}>Date</th>
                    <th className={th}>Work done</th>
                    <th className={th}>Workers</th>
                    <th className={`${th} w-20 text-right`}>Wages</th>
                    <th className={`${th} w-24 text-right`}>Site exp.</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-6 text-center italic text-slate-500">
                        No daily logs for the selected options.
                      </td>
                    </tr>
                  ) : (
                    logs.map((d: DailyWorkDetail, idx) => {
                      const items = (d.otherExpenses || []).filter((e) => Number(e.amount || 0) > 0);
                      return (
                      <React.Fragment key={d.id || idx}>
                      <tr className={items.length ? '' : 'border-b border-slate-300'}>
                        <td className={`${td} text-center text-slate-400`}>{idx + 1}</td>
                        <td className={`${td} whitespace-nowrap`}>{fmtDate(d.date)}</td>
                        <td className={td}>
                          {d.workDone}
                          {d.remarks && <div className="text-[10px] italic text-slate-500">{d.remarks}</div>}
                        </td>
                        <td className={td}>
                          {(d.labourMembers || []).length > 0
                            ? (d.labourMembers || [])
                                .map((m) => `${m.name}${m.hoursWorked ? ` ${m.hoursWorked}h` : ''}`)
                                .join(', ')
                            : d.labourDetails || '—'}
                        </td>
                        <td className={`${td} text-right font-mono`}>{num(wagesTotal(d))}</td>
                        <td className={`${td} text-right font-mono`}>
                          {!items.length && otherTotal(d) > 0 ? num(otherTotal(d)) : ''}
                        </td>
                      </tr>
                      {/* Each site expense on its own line under the day */}
                      {items.map((e, eIdx) => (
                        <tr
                          key={e.id || eIdx}
                          className={eIdx === items.length - 1 ? 'border-b border-slate-300' : ''}
                        >
                          <td />
                          <td />
                          <td colSpan={2} className="px-2 py-1 text-slate-600">
                            <span className="text-slate-400">↳</span> Site expense: {e.description || '—'}
                          </td>
                          <td />
                          <td className="px-2 py-1 text-right font-mono">{num(Number(e.amount || 0))}</td>
                        </tr>
                      ))}
                      </React.Fragment>
                      );
                    })
                  )}
                </tbody>
                {/* Printed without the statement, the log carries its own totals */}
                {!showStatement && logs.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-400 font-semibold">
                      <td colSpan={4} className="px-2 py-2 text-right text-[10px] uppercase tracking-wide">
                        Total · {logs.length} day{logs.length === 1 ? '' : 's'}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">{num(logs.reduce((n, d) => n + wagesTotal(d), 0))}</td>
                      <td className="px-2 py-2 text-right font-mono">{num(logs.reduce((n, d) => n + otherTotal(d), 0))}</td>
                    </tr>
                    <tr className="font-semibold">
                      <td colSpan={4} className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wide">
                        Grand total (wages + site expenses)
                      </td>
                      <td colSpan={2} className="bg-rose-50 px-2 py-1.5 text-right font-mono text-rose-800">
                        {money(logs.reduce((n, d) => n + wagesTotal(d) + otherTotal(d), 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </>
          )}

          {/* Money: one worker's wages, or the full statement */}
          {showStatement && worker && (
            <>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-800">Wages · {worker}</h3>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-y border-slate-400 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-700">
                    <th className={`${th} w-8 text-center`}>#</th>
                    <th className={`${th} w-20`}>Date</th>
                    <th className={`${th} w-14 text-right`}>Hours</th>
                    <th className={`${th} w-16 text-right`}>Rate</th>
                    <th className={th}>Status</th>
                    <th className={th}>Mode</th>
                    <th className={`${th} w-20 bg-rose-100 text-right text-rose-800`}>Wage (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {workerRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-6 text-center italic text-slate-500">
                        No wages for the selected options.
                      </td>
                    </tr>
                  ) : (
                    workerRows.map(({ d, m }, idx) => {
                      const st = memberStatus(d, m);
                      return (
                        <tr key={d.id || idx} className="border-b border-slate-300">
                          <td className={`${td} text-center text-slate-400`}>{idx + 1}</td>
                          <td className={`${td} whitespace-nowrap`}>{fmtDate(d.date)}</td>
                          <td className={`${td} text-right font-mono`}>{m.hoursWorked ?? ''}</td>
                          <td className={`${td} text-right font-mono`}>{m.hourlyRate ?? ''}</td>
                          <td className={`${td} font-medium ${statusCls(st)}`}>
                            {st === 'paid' ? 'Given' : st === 'pending' ? 'Pending' : '—'}
                          </td>
                          <td className={td}>{st === 'paid' ? memberMode(d, m) : ''}</td>
                          <td className={`${td} bg-rose-50 text-right font-mono text-rose-700`}>{num(Number(m.wage || 0))}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {workerRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-400 font-semibold">
                      <td colSpan={6} className="px-2 py-2 text-right text-[10px] uppercase tracking-wide">
                        Total · pending{' '}
                        {money(
                          workerRows
                            .filter(({ d, m }) => memberStatus(d, m) === 'pending')
                            .reduce((s, { m }) => s + Number(m.wage || 0), 0)
                        )}
                      </td>
                      <td className="bg-rose-100 px-2 py-2 text-right font-mono text-rose-800">
                        {num(workerRows.reduce((s, { m }) => s + Number(m.wage || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </>
          )}

          {showStatement && !worker && (
            <>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-800">
                Statement · wages, site expenses & payments
              </h3>
              <div className="mb-4 grid grid-cols-5 overflow-hidden rounded-lg border border-slate-300 text-xs">
                {[
                  { label: 'Received', value: totals.received, cls: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: 'To get', value: totals.toGet, cls: 'text-amber-700', bg: 'bg-amber-50' },
                  { label: 'Paid out', value: totals.paidOut, cls: 'text-rose-700', bg: 'bg-rose-50' },
                  { label: 'Pending to pay', value: totals.pendingOut, cls: 'text-amber-700', bg: 'bg-amber-50' },
                  { label: 'Net cash', value: totals.net, cls: totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700', bg: 'bg-white' },
                ].map((c, i) => (
                  <div key={c.label} className={`p-2.5 ${c.bg} ${i ? 'border-l border-slate-300' : ''}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
                    <p className={`mt-0.5 font-mono text-sm font-bold ${c.cls}`}>{money(c.value)}</p>
                  </div>
                ))}
              </div>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-y border-slate-400 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-700">
                    <th className={`${th} w-8 text-center`}>#</th>
                    <th className={`${th} w-20`}>Date</th>
                    <th className={th}>Category / Details</th>
                    <th className={th}>Party</th>
                    <th className={`${th} w-16`}>Mode</th>
                    <th className={`${th} w-16`}>Status</th>
                    <th className={`${th} w-20 bg-emerald-100 text-right text-emerald-800`}>In (₹)</th>
                    <th className={`${th} w-20 bg-rose-100 text-right text-rose-800`}>Out (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-6 text-center italic text-slate-500">
                        No transactions for the selected options.
                      </td>
                    </tr>
                  ) : (
                    statement.map((t, idx) => {
                      const isIn = t.type === 'income';
                      const st = txnStatus(t);
                      return (
                        <tr key={t.id} className="border-b border-slate-300">
                          <td className={`${td} text-center text-slate-400`}>{idx + 1}</td>
                          <td className={`${td} whitespace-nowrap`}>{fmtDate(t.date)}</td>
                          <td className={td}>
                            <span className="font-medium">{t.category}</span>
                            {t.remarks && <div className="text-[10px] text-slate-500">{t.remarks}</div>}
                          </td>
                          <td className={td}>{t.personName || '—'}</td>
                          <td className={td}>{modesOf(t).join(' / ')}</td>
                          <td className={`${td} font-medium ${statusCls(st)}`}>
                            {st ? statusLabel(t, st) : ''}
                            {st === 'partial' && t.pendingAmount ? (
                              <div className="text-[9px]">₹{num(t.pendingAmount)} due</div>
                            ) : null}
                          </td>
                          <td className={`${td} bg-emerald-50 text-right font-mono text-emerald-700`}>
                            {isIn ? num(Number(t.amount || 0)) : ''}
                          </td>
                          <td className={`${td} bg-rose-50 text-right font-mono text-rose-700`}>
                            {!isIn ? num(Number(t.amount || 0)) : ''}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {statement.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-400 font-semibold">
                      <td colSpan={6} className="px-2 py-2 text-right text-[10px] uppercase tracking-wide">
                        Total
                      </td>
                      <td className="bg-emerald-100 px-2 py-2 text-right font-mono text-emerald-800">
                        {num(totals.received + totals.toGet)}
                      </td>
                      <td className="bg-rose-100 px-2 py-2 text-right font-mono text-rose-800">{num(totals.outflow)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>

              {!hasFilters && (
                <div className="ml-auto mt-5 w-64 text-xs">
                  <div className="flex justify-between border-b border-slate-300 py-1.5">
                    <span className="text-slate-600">Contract amount</span>
                    <span className="font-mono">{money(Number(work.contractorAmount || 0))}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 py-1.5">
                    <span className="text-slate-600">Total cost</span>
                    <span className="font-mono text-rose-700">{money(totals.outflow)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-semibold">
                    <span>Balance</span>
                    <span className="font-mono">{money(Number(work.contractorAmount || 0) - totals.outflow)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="mt-14 grid grid-cols-2 text-xs">
        <div>
          <div className="w-48 border-b border-dashed border-slate-400" />
          <p className="mt-1 text-slate-600">Prepared by (Contractor)</p>
        </div>
        <div className="flex flex-col items-end">
          <div className="w-48 border-b border-dashed border-slate-400" />
          <p className="mt-1 text-slate-600">Verified by (Site in-charge / JE)</p>
        </div>
      </div>
    </PrintDocument>
  );
};
