import React, { useMemo, useState } from 'react';
import { buildFileName, fileDate } from '../../lib/print';
import { formatDate, todayISO } from '../../lib/dates';
import { CalendarRange, Filter, Layers, MapPin, Hash, ArrowLeftRight, CreditCard, RotateCcw } from 'lucide-react';
import { getAllPaymentModes } from '../../lib/expenseConfig';
import {
  cashTotals,
  matchesStatusFilter,
  statusLabel,
  txnStatus,
  StatusFilter,
  STATUS_FILTERS,
} from '../../lib/payments';
import { Expense } from '../../types';
import { PrintHeader } from '../common/PrintHeader';
import { PrintDocument } from '../common/PrintDocument';

export interface ExpenseWorkOption {
  id: string;
  workCode: string;
  name: string;
  siteName?: string;
  siteId?: string;
  section?: string;
}

type PrintTransaction = Expense & { isDailyWorkEntry?: boolean };
type PeriodMode = 'all' | 'day' | 'range' | 'month' | 'year';
type FlowMode = '' | 'income_received' | 'income_to_get' | 'expense' | 'daily_logs';

interface ExpensePrintViewProps {
  /** Every transaction; the print view applies its own filters */
  transactions: PrintTransaction[];
  works: ExpenseWorkOption[];
  /** Filters active on the page, used as the starting point */
  initial?: { startDate?: string; endDate?: string; type?: string; workId?: string; status?: string; mode?: string };
  onClose: () => void;
}

const today = () => todayISO();
const toDay = (d: string) => new Date(d).toISOString().slice(0, 10);
const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d: string) =>
  formatDate(d);

const FLOW_LABELS: Record<FlowMode, string> = {
  '': 'All transactions',
  income_received: 'Incoming (received)',
  income_to_get: 'To get (receivable)',
  expense: 'Outgoing (expenses)',
  daily_logs: 'Daily work logs',
};

export const ExpensePrintView: React.FC<ExpensePrintViewProps> = ({
  transactions,
  works,
  initial,
  onClose,
}) => {
  const [period, setPeriod] = useState<PeriodMode>(
    initial?.startDate || initial?.endDate ? 'range' : 'month'
  );
  const [day, setDay] = useState(today());
  const [from, setFrom] = useState(initial?.startDate || '');
  const [to, setTo] = useState(initial?.endDate || '');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [flow, setFlow] = useState<FlowMode>((initial?.type as FlowMode) || '');
  const [section, setSection] = useState('');
  const [siteId, setSiteId] = useState('');
  const [workId, setWorkId] = useState(initial?.workId || '');
  const [mode, setMode] = useState(initial?.mode || '');
  const [status, setStatus] = useState<StatusFilter>((initial?.status as StatusFilter) || '');

  const modeOf = (t: PrintTransaction) =>
    t.paymentMode && t.paymentMode !== 'Daily Log Wages' ? t.paymentMode : '';
  const paymentModes = useMemo(() => {
    const used = transactions.flatMap((t) => modeOf(t).split(' / ')).filter(Boolean);
    const known = getAllPaymentModes(used);
    return known;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const hasFilters = Boolean(period !== 'all' || flow || status || section || siteId || workId || mode);
  const clearFilters = () => {
    setPeriod('all');
    setFlow('');
    setSection('');
    setSiteId('');
    setWorkId('');
    setMode('');
    setStatus('');
  };

  const workById = useMemo(() => new Map(works.map((w) => [w.id, w])), [works]);
  const workByCode = useMemo(() => new Map(works.map((w) => [w.workCode, w])), [works]);
  const workOf = (t: PrintTransaction) =>
    (t.workId && workById.get(t.workId)) || (t.workCode && workByCode.get(t.workCode)) || undefined;

  const sections = useMemo(
    () => Array.from(new Set(works.map((w) => w.section).filter(Boolean) as string[])).sort(),
    [works]
  );
  const sites = useMemo(() => {
    const map = new Map<string, string>();
    works
      .filter((w) => !section || w.section === section)
      .forEach((w) => w.siteId && map.set(w.siteId, w.siteName || 'Unnamed site'));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [works, section]);
  const workChoices = useMemo(
    () =>
      works.filter(
        (w) => (!section || w.section === section) && (!siteId || w.siteId === siteId)
      ),
    [works, section, siteId]
  );
  const years = useMemo(() => {
    const set = new Set(transactions.map((t) => new Date(t.date).getFullYear()));
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [transactions]);

  const rows = useMemo(() => {
    return transactions
      .filter((t) => {
        const d = toDay(t.date);
        if (period === 'day' && d !== day) return false;
        if (period === 'range' && ((from && d < from) || (to && d > to))) return false;
        if (period === 'month' && d.slice(0, 7) !== month) return false;
        if (period === 'year' && d.slice(0, 4) !== year) return false;

        if (flow === 'income_received' && !(t.type === 'income' && !t.isFlagged)) return false;
        if (flow === 'income_to_get' && !(t.type === 'income' && t.isFlagged)) return false;
        if (flow === 'expense' && t.type !== 'expense') return false;
        if (flow === 'daily_logs' && !t.isDailyWorkEntry) return false;
        if (mode && !modeOf(t).split(' / ').includes(mode)) return false;
        if (!matchesStatusFilter(t, status)) return false;

        if (section || siteId || workId) {
          const w = workOf(t);
          if (!w) return false;
          if (section && w.section !== section) return false;
          if (siteId && w.siteId !== siteId) return false;
          if (workId && w.id !== workId) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, period, day, from, to, month, year, flow, mode, status, section, siteId, workId, workById, workByCode]);

  const totals = useMemo(() => {
    const t = cashTotals(rows);
    return { received: t.received, toGet: t.toGet, outgoing: t.outflow, pendingOut: t.pendingOut, paidOut: t.paidOut, net: t.net };
  }, [rows]);

  const periodLabel = (() => {
    switch (period) {
      case 'day':
        return fmtDate(day);
      case 'range':
        return from || to
          ? `${from ? fmtDate(from) : 'Beginning'} – ${to ? fmtDate(to) : 'Today'}`
          : 'All dates';
      case 'month':
        return new Date(`${month}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      case 'year':
        return `Year ${year}`;
      default:
        return 'All dates';
    }
  })();

  const selectedWork = workId ? workById.get(workId) : undefined;
  const scopeParts = [
    section && `Section: ${section}`,
    siteId && `Site: ${sites.find((s) => s.id === siteId)?.name || ''}`,
    selectedWork && `Work: ${selectedWork.workCode} – ${selectedWork.name}`,
    flow && FLOW_LABELS[flow],
    mode && `Mode: ${paymentModes.find((m) => m.id === mode)?.label || mode}`,
    status && `Status: ${STATUS_FILTERS.find(([id]) => id === status)?.[1]}`,
  ].filter(Boolean);

  const ControlLabel: React.FC<{ icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }> = ({
    icon: Icon,
    children,
  }) => (
    <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      {children}
    </span>
  );

  const controls = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="lg:col-span-2">
        <ControlLabel icon={CalendarRange}>Period</ControlLabel>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodMode)}
            className="form-input !w-auto"
          >
            <option value="day">Single day</option>
            <option value="range">From – To</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="all">All dates</option>
          </select>
          {period === 'day' && (
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="form-input" />
          )}
          {period === 'month' && (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="form-input" />
          )}
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
        <ControlLabel icon={ArrowLeftRight}>Type</ControlLabel>
        <select value={flow} onChange={(e) => setFlow(e.target.value as FlowMode)} className="form-input">
          {(Object.keys(FLOW_LABELS) as FlowMode[]).map((k) => (
            <option key={k} value={k}>
              {FLOW_LABELS[k]}
            </option>
          ))}
        </select>
      </label>

      <label>
        <ControlLabel icon={CreditCard}>Payment mode</ControlLabel>
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="form-input">
          <option value="">All modes</option>
          {paymentModes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <ControlLabel icon={Filter}>Status</ControlLabel>
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="form-input">
          {STATUS_FILTERS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <ControlLabel icon={Layers}>Section</ControlLabel>
        <select
          value={section}
          onChange={(e) => {
            setSection(e.target.value);
            setSiteId('');
            setWorkId('');
          }}
          className="form-input"
        >
          <option value="">All sections</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label>
        <ControlLabel icon={MapPin}>Work site</ControlLabel>
        <select
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value);
            setWorkId('');
          }}
          className="form-input"
        >
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <ControlLabel icon={Hash}>Work code / name</ControlLabel>
        <select value={workId} onChange={(e) => setWorkId(e.target.value)} className="form-input">
          <option value="">All works</option>
          {workChoices.map((w) => (
            <option key={w.id} value={w.id}>
              {w.workCode} · {w.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end">
        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasFilters}
          className="btn-secondary w-full disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4 text-slate-500" />
          Clear filters
        </button>
      </div>
    </div>
  );

  return (
    <PrintDocument
      title="Print Expense Statement"
      fileName={() => buildFileName(
        'Expense Statement',
        selectedWork?.workCode,
        periodLabel.replace(/\//g, '-'),
        fileDate()
      )}
      subtitle={`${rows.length} transactions · ${periodLabel}`}
      onClose={onClose}
      controls={controls}
    >
      <PrintHeader title="EXPENSE STATEMENT" date={new Date().toISOString()} />

      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Period</p>
          <p className="text-sm font-semibold text-slate-900">{periodLabel}</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-600">
          <Filter className="h-3.5 w-3.5 text-slate-400 no-print" />
          {scopeParts.length ? scopeParts.join(' · ') : 'All works, sites and sections'}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-5 overflow-hidden rounded-lg border border-slate-300 text-xs">
        {[
          { label: 'Incoming (received)', value: totals.received, cls: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'To get', value: totals.toGet, cls: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Paid out', value: totals.paidOut, cls: 'text-rose-700', bg: 'bg-rose-50' },
          { label: 'Pending to pay', value: totals.pendingOut, cls: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Net cash', value: totals.net, cls: totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700', bg: 'bg-white' },
        ].map((c, i) => (
          <div key={c.label} className={`p-3 ${c.bg} ${i ? 'border-l border-slate-300' : ''}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={`mt-1 font-mono text-base font-bold ${c.cls}`}>{money(c.value)}</p>
          </div>
        ))}
      </div>

      <table className="w-full border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-y border-slate-400 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-700">
            <th className="w-8 px-2 py-2 text-center">#</th>
            <th className="w-20 px-2 py-2">Date</th>
            <th className="px-2 py-2">Work</th>
            <th className="px-2 py-2">Category / Details</th>
            <th className="px-2 py-2">Party</th>
            <th className="w-16 px-2 py-2">Mode</th>
            <th className="w-16 px-2 py-2">Status</th>
            <th className="w-20 bg-emerald-100 px-2 py-2 text-right text-emerald-800">In (₹)</th>
            <th className="w-20 bg-rose-100 px-2 py-2 text-right text-rose-800">Out (₹)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-2 py-6 text-center italic text-slate-500">
                No transactions for the selected options.
              </td>
            </tr>
          ) : (
            rows.map((t, idx) => {
              const w = workOf(t);
              const isIn = t.type === 'income';
              return (
                <tr key={t.id} className="border-b border-slate-300 align-top">
                  <td className="px-2 py-1.5 text-center text-slate-400">{idx + 1}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{fmtDate(t.date)}</td>
                  <td className="px-2 py-1.5">
                    {t.workCode ? (
                      <>
                        <span className="font-mono font-semibold">{t.workCode}</span>
                        <div className="text-[10px] text-slate-500">
                          {[t.workName, w?.siteName].filter(Boolean).join(' · ')}
                        </div>
                      </>
                    ) : (
                      <span className="italic text-slate-400">General</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{t.category}</span>
                    {t.remarks && <div className="text-[10px] text-slate-500">{t.remarks}</div>}
                  </td>
                  <td className="px-2 py-1.5">{t.personName || '—'}</td>
                  <td className="px-2 py-1.5">{modeOf(t)}</td>
                  <td
                    className={`px-2 py-1.5 font-medium ${
                      txnStatus(t) === 'paid' ? 'text-emerald-700' : txnStatus(t) ? 'text-amber-700' : 'text-slate-400'
                    }`}
                  >
                    {txnStatus(t) ? statusLabel(t, txnStatus(t)) : ''}
                  </td>
                  <td className="bg-emerald-50 px-2 py-1.5 text-right font-mono text-emerald-700">
                    {isIn ? Number(t.amount || 0).toLocaleString('en-IN') : ''}
                  </td>
                  <td className="bg-rose-50 px-2 py-1.5 text-right font-mono text-rose-700">
                    {!isIn ? Number(t.amount || 0).toLocaleString('en-IN') : ''}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-400 font-semibold">
              <td colSpan={7} className="px-2 py-2 text-right uppercase text-[10px] tracking-wide">
                Total
              </td>
              <td className="bg-emerald-100 px-2 py-2 text-right font-mono text-emerald-800">
                {(totals.received + totals.toGet).toLocaleString('en-IN')}
              </td>
              <td className="bg-rose-100 px-2 py-2 text-right font-mono text-rose-800">
                {totals.outgoing.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      <div className="mt-14 grid grid-cols-2 text-xs">
        <div>
          <div className="w-44 border-b border-dashed border-slate-400" />
          <p className="mt-1 text-slate-600">Prepared by</p>
        </div>
        <div className="flex flex-col items-end">
          <div className="w-44 border-b border-dashed border-slate-400" />
          <p className="mt-1 text-slate-600">Approved by</p>
        </div>
      </div>
    </PrintDocument>
  );
};
