import React, { useState, useEffect } from 'react';
import { formatDate, todayISO, weekdayOf } from '../lib/dates';
import { DetailPageSkeleton } from '../components/common/Skeleton';
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  CalendarDays,
  MapPin,
  Printer,
  Edit2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Users,
  Plus,
  Trash2,
  Receipt,
  Layers,
  Wrench,
  FileText,
  IndianRupee,
  Wallet,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Clock,
  CreditCard,
} from 'lucide-react';
import { Work, DailyWorkDetail } from '../types';
import { api } from '../lib/api';
import { StatusBadge } from '../components/common/Badges';
import { StatCard } from '../components/common/StatCard';
import { DailyWorkDetailModal } from '../components/work/DailyWorkDetailModal';
import { StatusChangeModal } from '../components/work/StatusChangeModal';
import { WorkTransactions, WorkTransactionTotals } from '../components/work/WorkTransactions';
import {
  dayPending,
  memberMode,
  memberStatus,
  otherItemMode,
  otherItemStatus,
  otherSummary,
  wagesMode,
  wagesSummary,
  RowStatus,
} from '../lib/payments';
import { confirmDelete } from '../components/common/ConfirmHost';

interface WorkDetailPageProps {
  workId: string;
  onBack: () => void;
  onEditWork: (work: Work) => void;
  onOpenPolevar: (work: Work) => void;
  onPrintWork: (work: Work) => void;
  refreshTrigger?: number;
  /** Daily log to open in the edit popup once the work has loaded */
  openLogId?: string | null;
  onLogOpened?: () => void;
}

export const WorkDetailPage: React.FC<WorkDetailPageProps> = ({
  workId,
  onBack,
  onEditWork,
  onOpenPolevar,
  onPrintWork,
  refreshTrigger,
  openLogId,
  onLogOpened,
}) => {
  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Daily Detail modal state
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [editingDailyDetail, setEditingDailyDetail] = useState<DailyWorkDetail | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [txTotals, setTxTotals] = useState<WorkTransactionTotals>({ income: 0, expense: 0 });
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const toggleLog = (id: string) =>
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleStatusUpdate = async (workId: string, newStatus: string) => {
    const computedEndDate =
      newStatus.toUpperCase().includes('COMPLET')
        ? todayISO()
        : undefined;
    await api.works.update(workId, {
      status: newStatus,
      ...(computedEndDate ? { endDate: computedEndDate } : {}),
    });
    await loadWork(workId);
  };

  const loadWork = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.works.get(id);
      setWork(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load work order details');
    } finally {
      setLoading(false);
    }
  };

  // Load on open, when switching work, and when the parent asks for a refresh
  useEffect(() => {
    if (workId) loadWork(workId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId, refreshTrigger]);

  // Open the requested daily log (deep link from the expense tracker)
  useEffect(() => {
    if (!openLogId || !work || work.id !== workId) return;
    const entry = (Array.isArray(work.dailyDetails) ? work.dailyDetails : []).find((d) => d.id === openLogId);
    if (entry) {
      setEditingDailyDetail(entry);
      setIsDailyModalOpen(true);
    }
    onLogOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLogId, work, workId]);

  const handleDeleteDailyDetail = async (detailId: string) => {
    if (!work) return;
    if (!(await confirmDelete('Delete this daily work entry? Its workers, wages and site expenses will be removed.'))) return;
    try {
      const currentList = Array.isArray(work.dailyDetails) ? [...work.dailyDetails] : [];
      const updatedList = currentList.filter((d) => d.id !== detailId);
      await api.works.updateDailyDetails(work.id, updatedList);
      await loadWork(work.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete daily work detail');
    }
  };

  if (loading) {
    return (
      <DetailPageSkeleton />
    );
  }

  if (error || !work) {
    return (
      <div className="card mx-auto max-w-lg px-6 py-12 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <AlertCircle className="h-5 w-5" />
        </span>
        <h3 className="mt-3 text-base font-semibold text-slate-900">Work entry not found</h3>
        <p className="mt-1 text-[13px] text-slate-500">{error || 'Could not load this work record.'}</p>
        <button type="button" onClick={onBack} className="btn-secondary mt-5">
          <ArrowLeft className="h-4 w-4" />
          Back to Work Entry
        </button>
      </div>
    );
  }

  const labourTotalWage = (work.labours || []).reduce(
    (sum, l) => sum + (Number(l.wage) || 0),
    0
  );

  const dailyDetailsList = Array.isArray(work.dailyDetails) ? work.dailyDetails : [];
  const totalDailyLogsWage = dailyDetailsList.reduce(
    (sum, d) => sum + (Number(d.totalDailyWage) || 0),
    0
  );


  const otherOf = (d: DailyWorkDetail) =>
    Number(d.totalOtherExpenses ?? (d.otherExpenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const dayTotalOf = (d: DailyWorkDetail) =>
    Number(d.totalDailyCost ?? (Number(d.totalDailyWage) || 0) + otherOf(d));
  const dailyLogCost = dailyDetailsList.reduce((sum, d) => sum + dayTotalOf(d), 0);
  const totalExecutionCost = dailyLogCost + txTotals.expense;
  const contractValue = Number(work.contractorAmount || 0);
  const logsPending = dailyDetailsList.reduce((sum, d) => sum + dayPending(d), 0);
  const balance = contractValue - totalExecutionCost;
  const sortedLogs = [...dailyDetailsList].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const fmt = (d?: string) =>
    d ? formatDate(d) : '—';
  const section = work.electricalSection || work.workSite?.section;

  /** Status chip for a wage or site-expense line: green when given, amber when owed */
  const payChip = (status: RowStatus, mode: string, pending: number) => {
    if (!status) {
      return mode ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          <CreditCard className="h-3 w-3" />
          {mode}
        </span>
      ) : (
        <span className="text-[11px] text-slate-400">Status not set</span>
      );
    }
    const given = status === 'paid';
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
          given ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
        }`}
      >
        {given ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        {given ? 'Given' : status === 'partial' ? `Partly given · ₹${pending.toLocaleString('en-IN')} due` : 'Pending'}
        {mode && given ? ` · ${mode}` : ''}
      </span>
    );
  };

  const openNewLog = () => {
    setEditingDailyDetail(null);
    setIsDailyModalOpen(true);
  };

  const detailRows: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }[] = [
    { icon: MapPin, label: 'Work site', value: work.workSite?.name || 'Unassigned' },
    { icon: Layers, label: 'Section', value: section || '—' },
    { icon: Wrench, label: 'Type of work', value: work.typeOfWork || '—' },
    { icon: Calendar, label: 'Start date', value: fmt(work.date) },
    { icon: CheckCircle2, label: 'Completion', value: work.endDate ? fmt(work.endDate) : 'In progress' },
    { icon: FileText, label: 'Work order', value: work.workOrder ? `${work.workOrder}${work.woDate ? ` · ${fmt(work.woDate)}` : ''}` : '—' },
    { icon: Receipt, label: 'GST bill no.', value: work.gstMillNumber ? `${work.gstMillNumber}${work.gstDate ? ` · ${fmt(work.gstDate)}` : ''}` : '—' },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button type="button" onClick={onBack} className="btn-ghost -ml-2.5 no-print">
        <ArrowLeft className="h-4 w-4" />
        Back to Work Entry
      </button>

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end no-print">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">
              {work.workCode}
            </span>
            <StatusBadge status={work.status} onClick={() => setIsStatusModalOpen(true)} />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px] sm:leading-9">
            {work.name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              {work.workSite?.name || 'No site'}
            </span>
            {section && (
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                {section}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {fmt(work.date)} – {work.endDate ? fmt(work.endDate) : 'ongoing'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onEditWork(work)} className="btn-secondary">
            <Edit2 className="h-4 w-4 text-slate-500" />
            Edit
          </button>
          <button type="button" onClick={() => onOpenPolevar(work)} className="btn-secondary">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Polevar Sheet
          </button>
          <button type="button" onClick={() => onPrintWork(work)} className="btn-secondary">
            <Printer className="h-4 w-4 text-slate-500" />
            Print
          </button>
          <button type="button" onClick={openNewLog} className="btn-primary">
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Add Daily Work
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        <StatCard title="Contract Value" value={`₹${contractValue.toLocaleString('en-IN')}`} icon={IndianRupee} variant="blue" />
        <StatCard
          title="Execution Cost"
          value={`₹${totalExecutionCost.toLocaleString('en-IN')}`}
          subtitle={`Daily logs ₹${dailyLogCost.toLocaleString('en-IN')} · Expenses ₹${txTotals.expense.toLocaleString('en-IN')}`}
          icon={Wallet}
          variant="accent"
        />
        <StatCard
          title="Days Worked"
          value={dailyDetailsList.length}
          subtitle={`${dailyDetailsList.reduce((s, d) => s + Number(d.labourCount || d.labourMembers?.length || 0), 0)} man-days`}
          icon={CalendarDays}
          variant="purple"
        />
        <StatCard
          title="Balance"
          value={`₹${balance.toLocaleString('en-IN')}`}
          subtitle="Contract value minus cost"
          icon={balance >= 0 ? TrendingUp : TrendingDown}
          variant={balance >= 0 ? 'success' : 'danger'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-3">
        <div className="space-y-6 2xl:col-span-2">
        {/* Daily log */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-300 px-5 py-4">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                Daily Work
                {logsPending > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                    <Clock className="h-3 w-3" />
                    ₹{logsPending.toLocaleString('en-IN')} pending
                  </span>
                )}
              </h3>
              <p className="text-[13px] text-slate-500">Work done, crew and cost for each day</p>
            </div>
            {dailyDetailsList.length > 0 && (
              <button type="button" onClick={openNewLog} className="btn-ghost text-blue-600 hover:!text-blue-700">
                <Plus className="h-3.5 w-3.5" />
                Add day
              </button>
            )}
          </div>

          {sortedLogs.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <CalendarDays className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-700">No daily logs yet</p>
              <p className="mt-1 max-w-sm text-[13px] text-slate-500">
                Record each day's work, the crew on site and their wages.
              </p>
              <button type="button" onClick={openNewLog} className="btn-primary mt-4">
                <Plus className="h-4 w-4" />
                Add first daily work
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-300 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-8 px-3 py-2.5" />
                    <th className="whitespace-nowrap px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Work done</th>
                    <th className="px-3 py-2.5">Workers</th>
                    <th className="px-3 py-2.5">Wages</th>
                    <th className="px-3 py-2.5">Site expenses</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                    <th className="w-20 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {sortedLogs.map((detail, idx) => {
                    const d = new Date(detail.date);
                    const crew = detail.labourMembers || [];
                    const crewCount = Number(detail.labourCount ?? crew.length);
                    const other = otherOf(detail);
                    const ws = wagesSummary(detail);
                    const isOpen = expandedLogs.has(detail.id);
                    return (
                      <React.Fragment key={detail.id || idx}>
                        <tr
                          className={`cursor-pointer align-top transition-colors hover:bg-slate-50/70 ${isOpen ? 'bg-slate-50/70' : ''}`}
                          onClick={() => toggleLog(detail.id)}
                        >
                          <td className="px-3 py-3">
                            <ChevronRight
                              className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <span className="block font-medium text-slate-900">
                              {formatDate(detail.date)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {weekdayOf(detail.date)}
                            </span>
                          </td>
                          <td className="max-w-[240px] px-3 py-3">
                            <span className="line-clamp-2 text-slate-800">{detail.workDone}</span>
                            {detail.remarks && (
                              <span className="mt-0.5 block truncate text-xs italic text-slate-500">{detail.remarks}</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-slate-700">
                              <Users className="h-3.5 w-3.5 text-slate-400" />
                              {crewCount}
                            </span>
                            {crew.length > 0 && (
                              <span className="block max-w-[150px] truncate text-xs text-slate-500">
                                {crew.map((m) => m.name).join(', ')}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="block font-mono font-medium text-slate-900">
                              ₹{Number(detail.totalDailyWage || 0).toLocaleString('en-IN')}
                            </span>
                            <span className="mt-1 block">{payChip(ws.status, wagesMode(detail), ws.pending)}</span>
                          </td>
                          <td className="px-3 py-3">
                            {other > 0 ? (
                              <>
                                <span className="block font-mono font-medium text-slate-900">
                                  ₹{other.toLocaleString('en-IN')}
                                </span>
                                <span className="mt-1 block">
                                  {(() => {
                                    const os = otherSummary(detail);
                                    return payChip(os.status, os.mode, os.pending);
                                  })()}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold text-rose-700">
                            ₹{dayTotalOf(detail).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDailyDetail(detail);
                                  setIsDailyModalOpen(true);
                                }}
                                className="btn-icon !h-7 !w-7 hover:!bg-blue-50 hover:!text-blue-600"
                                title="Edit day"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDailyDetail(detail.id)}
                                className="btn-icon !h-7 !w-7 hover:!bg-rose-50 hover:!text-rose-600"
                                title="Delete day"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr className="bg-slate-50/70">
                            <td />
                            <td colSpan={7} className="px-3 pb-4 pt-1">
                              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                                <div className="overflow-hidden rounded-lg border border-slate-300 bg-white xl:col-span-2">
                                  <table className="w-full text-xs">
                                    <thead className="border-b border-slate-300 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-semibold">Worker</th>
                                        <th className="px-3 py-2 text-right font-semibold">Hours</th>
                                        <th className="px-3 py-2 text-right font-semibold">Rate</th>
                                        <th className="px-3 py-2 text-right font-semibold">Wage</th>
                                        <th className="px-3 py-2 text-left font-semibold">Payment</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-300">
                                      {crew.length === 0 ? (
                                        <tr>
                                          <td colSpan={5} className="px-3 py-3 text-slate-500">
                                            {detail.labourDetails || 'No workers recorded.'}
                                          </td>
                                        </tr>
                                      ) : (
                                        crew.map((m, mIdx) => {
                                          const st = memberStatus(detail, m);
                                          return (
                                            <tr key={mIdx}>
                                              <td className="px-3 py-2">
                                                <span className="flex items-center gap-1.5 font-medium text-slate-800">
                                                  <span className={`h-1.5 w-1.5 rounded-full ${m.isAdditional ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                                  {m.name}
                                                  <span className="font-normal text-slate-400">{m.isAdditional ? 'casual' : m.category || ''}</span>
                                                </span>
                                              </td>
                                              <td className="px-3 py-2 text-right font-mono text-slate-600">{m.hoursWorked ?? '—'}</td>
                                              <td className="px-3 py-2 text-right font-mono text-slate-600">
                                                {m.hourlyRate !== undefined ? `₹${m.hourlyRate}` : '—'}
                                              </td>
                                              <td className="px-3 py-2 text-right font-mono font-medium text-slate-900">
                                                ₹{Number(m.wage || 0).toLocaleString('en-IN')}
                                              </td>
                                              <td className="px-3 py-2">{payChip(st, st === 'paid' ? memberMode(detail, m) : '', 0)}</td>
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
                                  <div className="flex items-center justify-between border-b border-slate-300 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    <span>Site expenses</span>
                                    {other > 0 &&
                                      (() => {
                                        const os = otherSummary(detail);
                                        return payChip(os.status, os.mode, os.pending);
                                      })()}
                                  </div>
                                  {detail.otherExpenses && detail.otherExpenses.length > 0 ? (
                                    <ul className="divide-y divide-slate-300 text-xs">
                                      {detail.otherExpenses.map((e, eIdx) => (
                                        <li key={e.id || eIdx} className="flex items-center justify-between gap-2 px-3 py-2">
                                          <span className="space-y-0.5">
                                            <span className="block text-slate-700">{e.description}</span>
                                            {payChip(
                                              otherItemStatus(detail, e),
                                              otherItemStatus(detail, e) === 'paid' ? otherItemMode(detail, e) : '',
                                              0
                                            )}
                                          </span>
                                          <span className="font-mono font-medium text-slate-900">
                                            ₹{Number(e.amount || 0).toLocaleString('en-IN')}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="px-3 py-3 text-xs text-slate-400">None</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <WorkTransactions work={work} onTotalsChange={setTxTotals} />
        </div>

        {/* Side column */}
        <div className="grid grid-cols-1 content-start gap-6 md:grid-cols-2 2xl:grid-cols-1">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-300 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">Work Details</h3>
            </div>
            <dl className="divide-y divide-slate-300">
              {detailRows.map((row) => (
                <div key={row.label} className="flex items-start gap-3 px-5 py-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-300">
                    <row.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">{row.label}</dt>
                    <dd className="break-words text-sm font-medium text-slate-900">{row.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <div className="card p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <FileSpreadsheet className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Polevar Sheet</h3>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Materials, labour items and returns per pole location.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => onOpenPolevar(work)} className="btn-secondary mt-4 w-full">
              Open Polevar Sheet
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Daily Work Detail Modal */}
      {isDailyModalOpen && (
        <DailyWorkDetailModal
          isOpen={isDailyModalOpen}
          onClose={() => {
            setIsDailyModalOpen(false);
            setEditingDailyDetail(null);
          }}
          work={work}
          editingDetail={editingDailyDetail}
          onSaved={() => loadWork(work.id)}
          onOpenPolevar={(w) => {
            setIsDailyModalOpen(false);
            onOpenPolevar(w);
          }}
        />
      )}

      {/* Quick Status / Stage Change Modal */}
      {isStatusModalOpen && (
        <StatusChangeModal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          work={work}
          onSaveStatus={handleStatusUpdate}
        />
      )}
    </div>
  );
};
