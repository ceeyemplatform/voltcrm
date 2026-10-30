import React, { useState, useEffect, useMemo } from 'react';
import { todayISO } from '../../lib/dates';
import {
  X,
  Calendar,
  Clock,
  Users,
  Boxes,
  FileText,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  UserCheck,
  UserPlus,
  Coins,
  Search,
  FileSpreadsheet,
  Receipt,
  ChevronRight,
  ChevronLeft,
  Check,
  CheckCheck,
  XCircle,
  IndianRupee,
  MessageSquare,
  Loader2,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { Work, DailyWorkDetail, Labour, DailyLabourMember, DailyOtherExpense, PayStatus } from '../../types';
import { memberMode, memberStatus, otherItemMode, otherItemStatus } from '../../lib/payments';
import { api } from '../../lib/api';
import { ModeSelect } from '../common/ModeSelect';
import { confirmDelete } from '../common/ConfirmHost';

interface DailyWorkDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  work: Work | null;
  onSaved: () => void;
  initialDate?: string;
  editingDetail?: DailyWorkDetail | null;
  onOpenPolevar?: (work: Work) => void;
}

interface PermanentWorkerItem {
  id: string;
  name: string;
  category?: string;
  hourlyRate: number;
  hoursWorked: number;
  wage: number;
  selected: boolean;
  paymentStatus?: PayStatus;
  paymentMode?: string;
}

interface AdditionalWorkerItem {
  id: string;
  name: string;
  hourlyRate: number;
  hoursWorked: number;
  wage: number;
  paymentStatus?: PayStatus;
  paymentMode?: string;
}

/** The shared value when every item agrees, otherwise undefined */
const commonValue = <T,>(values: T[]): T | undefined =>
  values.length > 0 && values.every((v) => v === values[0]) ? values[0] : undefined;

/** Given / Pending switch plus, once given, how it was paid. */
const PaymentControl: React.FC<{
  status?: PayStatus;
  mode?: string;
  onStatus: (v: PayStatus | undefined) => void;
  onMode: (v: string) => void;
  size?: 'sm' | 'md';
}> = ({ status, mode, onStatus, onMode, size = 'sm' }) => (
  <div className="inline-flex flex-wrap items-center gap-1.5">
    <StatusToggle value={status} onChange={onStatus} size={size} />
    {status === 'paid' && <ModeSelect value={mode} onChange={onMode} size={size} />}
  </div>
);

/** Optional Given / Pending switch; clicking the active option clears it. */
const StatusToggle: React.FC<{
  value?: PayStatus;
  onChange: (v: PayStatus | undefined) => void;
  size?: 'sm' | 'md';
}> = ({ value, onChange, size = 'sm' }) => {
  const opts: [PayStatus, string, React.ComponentType<{ className?: string }>, string][] = [
    ['paid', 'Given', CheckCircle2, 'bg-emerald-50 text-emerald-700 ring-emerald-300'],
    ['pending', 'Pending', Clock, 'bg-amber-50 text-amber-700 ring-amber-300'],
  ];
  return (
    <div className="inline-flex gap-1">
      {opts.map(([id, label, Icon, active]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(value === id ? undefined : id)}
          title={value === id ? `${label} (click to clear)` : `Mark ${label.toLowerCase()}`}
          className={`inline-flex items-center gap-1 rounded-md font-medium ring-1 ring-inset transition ${
            size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
          } ${value === id ? active : 'bg-white text-slate-400 ring-slate-300 hover:text-slate-700'}`}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>
  );
};

interface OtherExpenseItem {
  id: string;
  description: string;
  amount: number;
  paymentStatus?: PayStatus;
  paymentMode?: string;
}

export const DailyWorkDetailModal: React.FC<DailyWorkDetailModalProps> = ({
  isOpen,
  onClose,
  work,
  onSaved,
  initialDate,
  editingDetail,
  onOpenPolevar,
}) => {
  const [date, setDate] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [remarks, setRemarks] = useState('');

  // Permanent members state & search
  const [permanentWorkers, setPermanentWorkers] = useState<PermanentWorkerItem[]>([]);
  const [permanentSearch, setPermanentSearch] = useState('');
  const [loadingPermanent, setLoadingPermanent] = useState(false);

  // Additional members state
  const [additionalCount, setAdditionalCount] = useState<number>(0);
  const [defaultAdditionalHourlyRate, setDefaultAdditionalHourlyRate] = useState<number>(65);
  const [defaultAdditionalHours, setDefaultAdditionalHours] = useState<number>(8);
  const [additionalWorkers, setAdditionalWorkers] = useState<AdditionalWorkerItem[]>([]);

  // Other Expenses state
  const [otherExpenses, setOtherExpenses] = useState<OtherExpenseItem[]>([]);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | ''>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load registered permanent labours from database
  useEffect(() => {
    if (isOpen) {
      setLoadingPermanent(true);
      api.labours
        .list()
        .then((labourList) => {
          if (editingDetail && editingDetail.labourMembers) {
            const memberMap = new Map<string, DailyLabourMember>();
            editingDetail.labourMembers
              .filter((m) => !m.isAdditional)
              .forEach((m) => {
                if (m.labourId) memberMap.set(m.labourId, m);
                else memberMap.set(m.name.toLowerCase(), m);
              });

            const items: PermanentWorkerItem[] = labourList.map((l) => {
              const matched = memberMap.get(l.id) || memberMap.get(l.name.toLowerCase());
              const defaultHourly =
                l.hourlyRate && Number(l.hourlyRate) > 0
                  ? Number(l.hourlyRate)
                  : Math.round(Number(l.dailyWage || 500) / 8);
              const hourlyRate =
                matched?.hourlyRate !== undefined ? Number(matched.hourlyRate) : defaultHourly;
              const hoursWorked =
                matched?.hoursWorked !== undefined ? Number(matched.hoursWorked) : 8;
              const wage =
                matched?.wage !== undefined
                  ? Number(matched.wage)
                  : Math.round(hourlyRate * hoursWorked);
              return {
                id: l.id,
                name: l.name,
                category: l.category,
                hourlyRate,
                hoursWorked,
                wage,
                selected: Boolean(matched),
                paymentStatus: matched ? memberStatus(editingDetail, matched) : undefined,
                paymentMode:
                  matched && memberStatus(editingDetail, matched) === 'paid'
                    ? memberMode(editingDetail, matched) || undefined
                    : undefined,
              };
            });
            setPermanentWorkers(items);
          } else {
            // New entry: populate available workers with their default hourly rate & 8h shift
            const items: PermanentWorkerItem[] = labourList.map((l) => {
              const hourlyRate =
                l.hourlyRate && Number(l.hourlyRate) > 0
                  ? Number(l.hourlyRate)
                  : Math.round(Number(l.dailyWage || 500) / 8);
              const hoursWorked = 8;
              return {
                id: l.id,
                name: l.name,
                category: l.category,
                hourlyRate,
                hoursWorked,
                wage: Math.round(hourlyRate * hoursWorked),
                selected: false,
              };
            });
            setPermanentWorkers(items);
          }
        })
        .catch(() => {
          setPermanentWorkers([]);
        })
        .finally(() => {
          setLoadingPermanent(false);
        });
    }
  }, [isOpen, editingDetail]);

  // Initialize general form fields & additional workers & other expenses
  useEffect(() => {
    if (isOpen) {
      setPermanentSearch('');
      setNewExpenseDesc('');
      setNewExpenseAmount('');
      if (editingDetail) {
        setDate(editingDetail.date);
        setWorkDone(editingDetail.workDone || '');
        setRemarks(editingDetail.remarks || '');

        // Populate additional workers from editingDetail
        const addMembers = (editingDetail.labourMembers || []).filter((m) => m.isAdditional);
        if (addMembers.length > 0) {
          setAdditionalCount(addMembers.length);
          setAdditionalWorkers(
            addMembers.map((m, idx) => {
              const hourlyRate = m.hourlyRate !== undefined ? Number(m.hourlyRate) : 65;
              const hoursWorked = m.hoursWorked !== undefined ? Number(m.hoursWorked) : 8;
              const wage =
                m.wage !== undefined ? Number(m.wage) : Math.round(hourlyRate * hoursWorked);
              return {
                id: m.id || `add_${idx}`,
                name: m.name,
                hourlyRate,
                hoursWorked,
                wage,
                paymentStatus: memberStatus(editingDetail, m),
                paymentMode:
                  memberStatus(editingDetail, m) === 'paid' ? memberMode(editingDetail, m) || undefined : undefined,
              };
            })
          );
        } else {
          setAdditionalCount(editingDetail.additionalMembersCount || 0);
          setAdditionalWorkers([]);
        }

        // Populate other expenses from editingDetail
        if (Array.isArray(editingDetail.otherExpenses) && editingDetail.otherExpenses.length > 0) {
          setOtherExpenses(
            editingDetail.otherExpenses.map((e) => {
              const paymentStatus = otherItemStatus(editingDetail, e);
              return {
                ...e,
                paymentStatus,
                paymentMode: paymentStatus === 'paid' ? otherItemMode(editingDetail, e) || undefined : undefined,
              };
            })
          );
        } else {
          setOtherExpenses([]);
        }
      } else {
        // New logs start on today's date unless a specific day was asked for
        const defaultDate = initialDate ? initialDate.split('T')[0] : todayISO();

        setDate(defaultDate);
        setWorkDone('');
        setRemarks('');
        setAdditionalCount(0);
        setAdditionalWorkers([]);
        setOtherExpenses([]);
      }
      setError(null);
    }
  }, [isOpen, editingDetail, initialDate, work]);

  // Handle changes to the additional members count
  const handleAdditionalCountChange = (countVal: number | '') => {
    const num = countVal === '' ? 0 : Math.max(0, Math.min(50, countVal));
    setAdditionalCount(num);

    setAdditionalWorkers((prev) => {
      const next: AdditionalWorkerItem[] = [];
      for (let i = 0; i < num; i++) {
        if (prev[i]) {
          next.push(prev[i]);
        } else {
          const letter =
            String.fromCharCode(65 + (i % 26)) +
            (i >= 26 ? String(Math.floor(i / 26) + 1) : '');
          next.push({
            id: `add_${i}_${Date.now()}`,
            name: `Member ${letter}`,
            hourlyRate: defaultAdditionalHourlyRate,
            hoursWorked: defaultAdditionalHours,
            wage: Math.round(defaultAdditionalHourlyRate * defaultAdditionalHours),
          });
        }
      }
      return next;
    });
  };

  const handleUpdateAdditionalWorker = (
    index: number,
    field: 'name' | 'hourlyRate' | 'hoursWorked',
    value: any
  ) => {
    setAdditionalWorkers((prev) => {
      const next = [...prev];
      if (next[index]) {
        const current = { ...next[index], [field]: value };
        if (field === 'hourlyRate' || field === 'hoursWorked') {
          current.wage = Math.round(
            Number(current.hourlyRate || 0) * Number(current.hoursWorked || 0)
          );
        }
        next[index] = current;
      }
      return next;
    });
  };

  const handleApplyDefaultsToAllAdditional = (rate: number, hrs: number) => {
    setDefaultAdditionalHourlyRate(rate);
    setDefaultAdditionalHours(hrs);
    setAdditionalWorkers((prev) =>
      prev.map((item) => ({
        ...item,
        hourlyRate: rate,
        hoursWorked: hrs,
        wage: Math.round(rate * hrs),
      }))
    );
  };

  const togglePermanentWorker = (id: string) => {
    setPermanentWorkers((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const updatePermanentHours = (id: string, hours: number) => {
    setPermanentWorkers((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const hrs = Math.max(0, hours);
        return {
          ...item,
          hoursWorked: hrs,
          wage: Math.round(hrs * (Number(item.hourlyRate) || 0)),
        };
      })
    );
  };

  const updatePermanentHourlyRate = (id: string, rate: number) => {
    setPermanentWorkers((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const r = Math.max(0, rate);
        return {
          ...item,
          hourlyRate: r,
          wage: Math.round((Number(item.hoursWorked) || 0) * r),
        };
      })
    );
  };

  const setPermanentPayment = (id: string | null, patch: { paymentStatus?: PayStatus; paymentMode?: string }) => {
    setPermanentWorkers((prev) =>
      prev.map((w) => (id === null ? w.selected : w.id === id) ? { ...w, ...patch } : w)
    );
  };

  const setAdditionalPayment = (index: number | null, patch: { paymentStatus?: PayStatus; paymentMode?: string }) => {
    setAdditionalWorkers((prev) => prev.map((w, i) => (index === null || i === index ? { ...w, ...patch } : w)));
  };

  /** Applies one status to every worker on this day (undefined clears) */
  const setAllWageStatus = (st: PayStatus | undefined) => {
    setPermanentWorkers((prev) => prev.map((w) => (w.selected ? { ...w, paymentStatus: st } : w)));
    setAdditionalWorkers((prev) => prev.map((w) => ({ ...w, paymentStatus: st })));
  };

  const selectAllPermanent = () => {
    setPermanentWorkers((prev) => prev.map((item) => ({ ...item, selected: true })));
  };

  const deselectAllPermanent = () => {
    setPermanentWorkers((prev) => prev.map((item) => ({ ...item, selected: false })));
  };

  // Other expenses handlers
  const handleAddOtherExpense = () => {
    if (!newExpenseDesc.trim() || Number(newExpenseAmount) <= 0) return;
    setOtherExpenses((prev) => [
      ...prev,
      {
        id: `exp_${Date.now()}_${Math.random()}`,
        description: newExpenseDesc.trim(),
        amount: Number(newExpenseAmount),
      },
    ]);
    setNewExpenseDesc('');
    setNewExpenseAmount('');
  };

  const setOtherPayment = (id: string | null, patch: { paymentStatus?: PayStatus; paymentMode?: string }) => {
    setOtherExpenses((prev) => prev.map((e) => (id === null || e.id === id ? { ...e, ...patch } : e)));
  };

  const handleRemoveOtherExpense = (id: string) => {
    setOtherExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  // Filter permanent workforce based on search input
  const filteredPermanentWorkers = useMemo(() => {
    if (!permanentSearch.trim()) return permanentWorkers;
    const q = permanentSearch.toLowerCase().trim();
    return permanentWorkers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.category && w.category.toLowerCase().includes(q))
    );
  }, [permanentWorkers, permanentSearch]);

  // Calculations for live totals
  const selectedPermanentList = useMemo(
    () => permanentWorkers.filter((w) => w.selected),
    [permanentWorkers]
  );

  const permanentCount = selectedPermanentList.length;
  const permanentWagesTotal = selectedPermanentList.reduce((sum, w) => sum + (Number(w.wage) || 0), 0);

  const additionalMembersList = additionalWorkers;
  const additionalWagesTotal = additionalMembersList.reduce((sum, w) => sum + (Number(w.wage) || 0), 0);

  const totalCrewCount = permanentCount + additionalMembersList.length;
  const totalLabourWages = permanentWagesTotal + additionalWagesTotal;
  const totalOtherExpenses = otherExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const grandTotalDailyCost = totalLabourWages + totalOtherExpenses;

  const crewStatuses = [
    ...selectedPermanentList.map((w) => w.paymentStatus),
    ...additionalMembersList.map((w) => w.paymentStatus),
  ];
  const allWageStatus =
    crewStatuses.length > 0 && crewStatuses.every((st) => st === crewStatuses[0]) ? crewStatuses[0] : undefined;
  const wagePendingTotal =
    selectedPermanentList.filter((w) => w.paymentStatus === 'pending').reduce((sum, w) => sum + Number(w.wage || 0), 0) +
    additionalMembersList.filter((w) => w.paymentStatus === 'pending').reduce((sum, w) => sum + Number(w.wage || 0), 0);

  if (!isOpen || !work) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError('Please select a date');
      return;
    }
    if (!workDone.trim()) {
      setError('Please describe the work done on this date');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Build structured labour members array with hours worked & hourly rate
      const labourMembers: DailyLabourMember[] = [
        ...selectedPermanentList.map((p) => ({
          labourId: p.id,
          name: p.name,
          category: p.category || 'Permanent Labour',
          hourlyRate: Number(p.hourlyRate || 0),
          hoursWorked: Number(p.hoursWorked || 0),
          wage: Number(p.wage || 0),
          isAdditional: false,
          paymentStatus: p.paymentStatus,
          paymentMode: p.paymentStatus === 'paid' ? p.paymentMode || undefined : undefined,
        })),
        ...additionalMembersList.map((a) => ({
          name: a.name.trim() || 'Additional Member',
          category: 'Additional Member',
          hourlyRate: Number(a.hourlyRate || 0),
          hoursWorked: Number(a.hoursWorked || 0),
          wage: Number(a.wage || 0),
          isAdditional: true,
          paymentStatus: a.paymentStatus,
          paymentMode: a.paymentStatus === 'paid' ? a.paymentMode || undefined : undefined,
        })),
      ];

      // Formatted summary description string
      const permanentNames = selectedPermanentList.map((p) => p.name).join(', ');
      const additionalNames = additionalMembersList.map((a) => a.name).join(', ');
      let labourDetailsStr = '';
      if (permanentCount > 0 && additionalMembersList.length > 0) {
        labourDetailsStr = `${permanentCount} Permanent (${permanentNames}) + ${additionalMembersList.length} Casual (${additionalNames}) • Wages: ₹${totalLabourWages.toLocaleString()}`;
      } else if (permanentCount > 0) {
        labourDetailsStr = `${permanentCount} Permanent (${permanentNames}) • Wages: ₹${totalLabourWages.toLocaleString()}`;
      } else if (additionalMembersList.length > 0) {
        labourDetailsStr = `${additionalMembersList.length} Casual (${additionalNames}) • Wages: ₹${totalLabourWages.toLocaleString()}`;
      } else {
        labourDetailsStr = 'No workforce logged';
      }

      const currentList: DailyWorkDetail[] = Array.isArray(work.dailyDetails)
        ? [...work.dailyDetails]
        : [];

      const detailToSave: DailyWorkDetail = {
        id: editingDetail?.id || (crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}`),
        date,
        workDone: workDone.trim(),
        labourCount: totalCrewCount,
        labourDetails: labourDetailsStr,
        labourMembers,
        additionalMembersCount: additionalMembersList.length,
        totalDailyWage: totalLabourWages,
        otherExpenses: otherExpenses.map((e) => ({
          ...e,
          paymentMode: e.paymentStatus === 'paid' ? e.paymentMode || undefined : undefined,
        })),
        totalOtherExpenses,
        totalDailyCost: grandTotalDailyCost,
        remarks: remarks.trim() || undefined,
        wagesPaymentMode: undefined,
        // Each site expense carries its own status and mode
        otherPaymentMode: undefined,
        otherPaymentStatus: undefined,
        paymentTracking: true,
        createdAt: editingDetail?.createdAt || new Date().toISOString(),
      };

      if (editingDetail) {
        const index = currentList.findIndex((d) => d.id === editingDetail.id);
        if (index !== -1) {
          currentList[index] = detailToSave;
        }
      } else {
        currentList.push(detailToSave);
      }

      // Sort chronological by date
      currentList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      await api.works.updateDailyDetails(work.id, currentList);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save daily work detail');
    } finally {
      setLoading(false);
    }
  };

  const initialsOf = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-xs sm:items-center sm:p-6">
      <div className="relative my-6 w-full max-w-3xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-300 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {editingDetail ? 'Edit Daily Work' : 'Add Daily Work'}
              </h3>
              <p className="text-xs text-slate-500">
                <span className="font-mono font-medium text-slate-700">{work.workCode}</span>
                {work.name && ` · ${work.name}`}
              </p>
            </div>
          </div>

          <button type="button" onClick={onClose} className="btn-icon" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="max-h-[calc(88vh-140px)] space-y-6 overflow-y-auto p-6">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="form-label">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Work Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="form-label">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  Work Done / Tasks Completed <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. 150m cable pulled from transformer to panel B, termination & megger test done"
                  value={workDone}
                  onChange={(e) => setWorkDone(e.target.value)}
                  className="form-input resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 1: PERMANENT WORKFORCE                                            */}
            {/* ========================================================================= */}
            <section className="space-y-3 border-t border-slate-300 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="form-section-title">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                    <UserCheck className="h-3.5 w-3.5" />
                  </span>
                  Permanent Workforce
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {selectedPermanentList.length}/{permanentWorkers.length} selected
                  </span>
                </h4>

                {permanentWorkers.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={selectAllPermanent} className="btn-ghost text-blue-600 hover:!text-blue-700">
                      <CheckCheck className="h-3.5 w-3.5" />
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllPermanent}
                      disabled={selectedPermanentList.length === 0}
                      className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {permanentWorkers.length > 0 && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or role"
                    value={permanentSearch}
                    onChange={(e) => setPermanentSearch(e.target.value)}
                    className="form-input !pl-9 !pr-9"
                  />
                  {permanentSearch && (
                    <button
                      type="button"
                      onClick={() => setPermanentSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {loadingPermanent ? (
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-11 w-40 rounded-lg" />
                  ))}
                </div>
              ) : permanentWorkers.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-500">
                  <Users className="h-4 w-4 text-slate-400" />
                  No permanent labour registered yet. Add casual workers below.
                </div>
              ) : filteredPermanentWorkers.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-500">
                  <Search className="h-4 w-4 text-slate-400" />
                  No employees match &quot;{permanentSearch}&quot;.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPermanentWorkers.map((worker) => (
                    <button
                      key={worker.id}
                      type="button"
                      onClick={() => togglePermanentWorker(worker.id)}
                      aria-pressed={worker.selected}
                      className={`group flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                        worker.selected
                          ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                          : 'border-slate-300 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition ${
                          worker.selected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                        }`}
                      >
                        {worker.selected ? <Check className="h-4 w-4" /> : initialsOf(worker.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {worker.name}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {worker.category || 'Permanent'}
                          {worker.hourlyRate ? ` · ₹${worker.hourlyRate}/hr` : ''}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* ASSIGNED WORKERS: EDIT TIME AND WAGE */}
              {selectedPermanentList.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-3 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Hours & wage · {selectedPermanentList.length} assigned
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      All:
                      <PaymentControl
                        status={commonValue(selectedPermanentList.map((w) => w.paymentStatus))}
                        mode={commonValue(selectedPermanentList.map((w) => w.paymentMode))}
                        onStatus={(st) => setPermanentPayment(null, { paymentStatus: st })}
                        onMode={(md) => setPermanentPayment(null, { paymentMode: md })}
                      />
                    </span>
                  </div>
                  <div className="max-h-56 divide-y divide-slate-300 overflow-y-auto">
                    {selectedPermanentList.map((worker) => (
                      <div
                        key={worker.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs sm:flex-nowrap"
                      >
                        <div className="min-w-[120px] space-y-1">
                          <span className="block text-sm font-medium text-slate-900">
                            {worker.name}
                            {worker.category && (
                              <span className="ml-1.5 text-[11px] font-normal text-slate-500">{worker.category}</span>
                            )}
                          </span>
                          <PaymentControl
                            status={worker.paymentStatus}
                            mode={worker.paymentMode}
                            onStatus={(st) => setPermanentPayment(worker.id, { paymentStatus: st })}
                            onMode={(md) => setPermanentPayment(worker.id, { paymentMode: md })}
                          />
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <label className="flex items-center gap-1 text-slate-400" title="Hours worked">
                            <Clock className="h-3.5 w-3.5" />
                            <input
                              type="number"
                              min="0"
                              max="24"
                              step="0.5"
                              value={worker.hoursWorked}
                              onChange={(e) =>
                                updatePermanentHours(worker.id, Number(e.target.value) || 0)
                              }
                              className="form-input !w-16 !px-2 !py-1 text-center font-mono"
                            />
                          </label>

                          <label className="flex items-center gap-1 text-slate-400" title="Rate per hour (₹)">
                            <IndianRupee className="h-3.5 w-3.5" />
                            <input
                              type="number"
                              min="0"
                              value={worker.hourlyRate}
                              onChange={(e) =>
                                updatePermanentHourlyRate(worker.id, Number(e.target.value) || 0)
                              }
                              className="form-input !w-20 !px-2 !py-1 text-right font-mono"
                            />
                            <span className="text-[11px]">/hr</span>
                          </label>

                          <span className="w-20 text-right font-mono text-sm font-semibold text-slate-900">
                            ₹{worker.wage.toLocaleString()}
                          </span>


                          <button
                            type="button"
                            onClick={async () => {
                              if (await confirmDelete(`Remove ${worker.name} from this day?`, { confirmText: 'Remove' }))
                                togglePermanentWorker(worker.id);
                            }}
                            className="btn-icon !h-7 !w-7 hover:!bg-rose-50 hover:!text-rose-600"
                            title="Remove from this day"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ========================================================================= */}
            {/* SECTION 2: CASUAL / ADDITIONAL MEMBERS                                    */}
            {/* ========================================================================= */}
            <section className="space-y-3 border-t border-slate-300 pt-5">
              <h4 className="form-section-title">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                  <UserPlus className="h-3.5 w-3.5" />
                </span>
                Casual / Additional Labour
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {additionalMembersList.length} workers
                </span>
              </h4>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="form-label">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    Worker Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={additionalCount === 0 ? '' : additionalCount}
                    onChange={(e) =>
                      handleAdditionalCountChange(
                        e.target.value === '' ? '' : parseInt(e.target.value, 10)
                      )
                    }
                    placeholder="0"
                    className="form-input font-mono"
                  />
                </div>

                <div>
                  <label className="form-label">
                    <IndianRupee className="h-3.5 w-3.5 text-slate-400" />
                    Default Rate (₹/hr)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={defaultAdditionalHourlyRate}
                    onChange={(e) =>
                      handleApplyDefaultsToAllAdditional(
                        Number(e.target.value) || 0,
                        defaultAdditionalHours
                      )
                    }
                    className="form-input font-mono"
                  />
                </div>

                <div>
                  <label className="form-label">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Default Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={defaultAdditionalHours}
                    onChange={(e) =>
                      handleApplyDefaultsToAllAdditional(
                        defaultAdditionalHourlyRate,
                        Number(e.target.value) || 0
                      )
                    }
                    className="form-input font-mono"
                  />
                </div>
              </div>

              {additionalMembersList.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-3 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {additionalMembersList.length} casual workers
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      All:
                      <PaymentControl
                        status={commonValue(additionalMembersList.map((w) => w.paymentStatus))}
                        mode={commonValue(additionalMembersList.map((w) => w.paymentMode))}
                        onStatus={(st) => setAdditionalPayment(null, { paymentStatus: st })}
                        onMode={(md) => setAdditionalPayment(null, { paymentMode: md })}
                      />
                    </span>
                  </div>
                <div className="max-h-56 divide-y divide-slate-300 overflow-y-auto">
                  {additionalMembersList.map((member, idx) => (
                    <div
                      key={member.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs sm:flex-nowrap"
                    >
                      <div className="min-w-[140px] flex-1 space-y-1">
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => handleUpdateAdditionalWorker(idx, 'name', e.target.value)}
                          placeholder={`Worker ${idx + 1}`}
                          className="form-input !border-transparent !px-1 !py-0.5 !shadow-none font-medium hover:!border-slate-300 focus:!border-blue-500"
                        />
                        <PaymentControl
                          status={member.paymentStatus}
                          mode={member.paymentMode}
                          onStatus={(st) => setAdditionalPayment(idx, { paymentStatus: st })}
                          onMode={(md) => setAdditionalPayment(idx, { paymentMode: md })}
                        />
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <label className="flex items-center gap-1 text-slate-400" title="Hours worked">
                          <Clock className="h-3.5 w-3.5" />
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.5"
                            value={member.hoursWorked}
                            onChange={(e) =>
                              handleUpdateAdditionalWorker(idx, 'hoursWorked', Number(e.target.value) || 0)
                            }
                            className="form-input !w-16 !px-2 !py-1 text-center font-mono"
                          />
                        </label>

                        <label className="flex items-center gap-1 text-slate-400" title="Rate per hour (₹)">
                          <IndianRupee className="h-3.5 w-3.5" />
                          <input
                            type="number"
                            min="0"
                            value={member.hourlyRate}
                            onChange={(e) =>
                              handleUpdateAdditionalWorker(idx, 'hourlyRate', Number(e.target.value) || 0)
                            }
                            className="form-input !w-20 !px-2 !py-1 text-right font-mono"
                          />
                          <span className="text-[11px]">/hr</span>
                        </label>

                        <span className="w-20 text-right font-mono text-sm font-semibold text-slate-900">
                          ₹{member.wage.toLocaleString()}
                        </span>

                      </div>
                    </div>
                  ))}
                </div>
                </div>
              )}
            </section>

            {/* ========================================================================= */}
            {/* SECTION 3: OTHER SITE EXPENSES                                            */}
            {/* ========================================================================= */}
            <section className="space-y-3 border-t border-slate-300 pt-5">
              <h4 className="form-section-title">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                  <Receipt className="h-3.5 w-3.5" />
                </span>
                Other Site Expenses
                <span className="text-xs font-normal text-slate-400">travel, refreshments, purchases</span>
              </h4>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Description, e.g. Auto travel & diesel"
                  value={newExpenseDesc}
                  onChange={(e) => setNewExpenseDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOtherExpense();
                    }
                  }}
                  className="form-input flex-1"
                />
                <div className="relative w-28 shrink-0">
                  <IndianRupee className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={newExpenseAmount}
                    onChange={(e) =>
                      setNewExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOtherExpense();
                      }
                    }}
                    className="form-input !pl-7 text-right font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddOtherExpense}
                  disabled={!newExpenseDesc.trim() || Number(newExpenseAmount) <= 0}
                  className="btn-secondary h-[38px] w-[38px] shrink-0 !px-0"
                  title="Add expense"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {otherExpenses.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-3 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {otherExpenses.length} item{otherExpenses.length === 1 ? '' : 's'} · ₹{totalOtherExpenses.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      All:
                      <PaymentControl
                        status={commonValue(otherExpenses.map((e) => e.paymentStatus))}
                        mode={commonValue(otherExpenses.map((e) => e.paymentMode))}
                        onStatus={(st) => setOtherPayment(null, { paymentStatus: st })}
                        onMode={(md) => setOtherPayment(null, { paymentMode: md })}
                      />
                    </span>
                  </div>
                <div className="max-h-56 divide-y divide-slate-300 overflow-y-auto">
                  {otherExpenses.map((exp) => (
                    <div key={exp.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="block truncate pr-2 font-medium text-slate-800">{exp.description}</span>
                        <PaymentControl
                          status={exp.paymentStatus}
                          mode={exp.paymentMode}
                          onStatus={(st) => setOtherPayment(exp.id, { paymentStatus: st })}
                          onMode={(md) => setOtherPayment(exp.id, { paymentMode: md })}
                        />
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900">
                          ₹{Number(exp.amount || 0).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await confirmDelete(`Remove the expense "${exp.description}"?`, { confirmText: 'Remove' }))
                              handleRemoveOtherExpense(exp.id);
                          }}
                          className="btn-icon !h-7 !w-7 hover:!bg-rose-50 hover:!text-rose-600"
                          title="Remove expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              )}
            </section>

            {/* Remarks */}
            <div className="border-t border-slate-300 pt-5">
              <label className="form-label">
                <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                Remarks <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Work stopped early due to rain / power clearance delayed"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="form-input"
              />
            </div>

            {/* ========================================================================= */}
            {/* COST SUMMARY                                                              */}
            {/* ========================================================================= */}
            <div className="rounded-xl border border-slate-300 bg-slate-50/70">
              <div className="grid grid-cols-3 divide-x divide-slate-300">
                {[
                  { label: 'Permanent', value: permanentWagesTotal, meta: `${permanentCount} workers`, dot: 'bg-blue-500' },
                  { label: 'Casual', value: additionalWagesTotal, meta: `${additionalMembersList.length} workers`, dot: 'bg-emerald-500' },
                  { label: 'Other', value: totalOtherExpenses, meta: `${otherExpenses.length} items`, dot: 'bg-amber-500' },
                ].map((item) => (
                  <div key={item.label} className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                      {item.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-sm font-semibold text-slate-900">
                      ₹{item.value.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-400">{item.meta}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-baseline justify-between border-t border-slate-300 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">Total cost for the day</span>
                <span className="font-mono text-xl font-bold text-slate-900">
                  ₹{grandTotalDailyCost.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-300 bg-slate-50/60 px-6 py-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary min-w-[140px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {loading ? 'Saving…' : editingDetail ? 'Update Log' : 'Save Daily Work'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
