import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { formatDate } from '../lib/dates';
import {
  Plus,
  Printer,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  Flag,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  CircleDashed,
  ChevronDown,
  CreditCard,
  X,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { Expense } from '../types';
import { DataTable, Column } from '../components/common/DataTable';
import { ExpenseModal } from '../components/expense/ExpenseModal';
import { ExpensePrintView } from '../components/expense/ExpensePrintView';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { PrintHeader } from '../components/common/PrintHeader';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { MultiLineCell } from '../components/common/Badges';
import { ActionMenu, ActionMenuItem } from '../components/common/ActionMenu';
import { getAllPaymentModes, saveCustomPaymentMode } from '../lib/expenseConfig';
import {
  cashTotals,
  statusLabel,
  txnStatus,
  RowStatus,
  StatusFilter,
  STATUS_FILTERS,
  matchesStatusFilter,
} from '../lib/payments';
import { updateDailyPayments } from '../lib/dailyPayments';

// Unified transaction item combining manual transactions and daily work entries
interface UnifiedTransaction extends Expense {
  isDailyWorkEntry?: boolean;
}

interface WorkOptionItem {
  id: string;
  workCode: string;
  name: string;
  siteName?: string;
  siteId?: string;
  section?: string;
}

const STATUS_STYLE: Record<string, { cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  paid: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle2 },
  pending: { cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Clock },
  partial: { cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Clock },
  none: { cls: 'bg-slate-50 text-slate-500 ring-slate-300', icon: CircleDashed },
};

const isDailyRow = (t: UnifiedTransaction) => Boolean(t.isDailyWorkEntry && t.dailyId && t.workId);
const cleanMode = (m?: string) => (m && m !== 'Daily Log Wages' ? m : '');
const dayOf = (t: Expense) => new Date(String(t.date).slice(0, 10)).getTime();
const createdOf = (t: Expense) => new Date(t.createdAt || t.date).getTime() || 0;

export const ExpensePage: React.FC = () => {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [workOptions, setWorkOptions] = useState<WorkOptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // '', 'income', 'expense', 'daily_logs'
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [workFilter, setWorkFilter] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<string>('date-desc');

  // Modals & menus
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ rect: DOMRect; row: UnifiedTransaction; kind: 'status' | 'mode' } | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [newModeDraft, setNewModeDraft] = useState('');

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const data = await api.expenses.summary();
      setTransactions(data.items);
      setWorkOptions(data.works);
    } catch (err: any) {
      setError(err?.message || 'Failed to load financial records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (data: Partial<Expense>) => {
    if (editingExpense) {
      await api.expenses.update(editingExpense.id, data);
    } else {
      await api.expenses.create(data);
    }
    await loadData({ silent: true });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.expenses.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadData({ silent: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to delete transaction');
    } finally {
      setDeleteLoading(false);
    }
  };

  /** Applies a status/mode change to manual and daily-log rows alike. */
  const applyChange = async (
    rows: UnifiedTransaction[],
    change: { status?: 'paid' | 'pending' | null; mode?: string }
  ) => {
    const ids = new Set(rows.map((r) => r.id));
    setSavingIds((prev) => new Set([...prev, ...ids]));
    setError(null);
    try {
      const daily = rows.filter(isDailyRow);
      const manual = rows.filter((r) => !r.isDailyWorkEntry);
      await Promise.all(
        manual.map((r) =>
          api.expenses.update(r.id, {
            ...(change.status !== undefined ? { isFlagged: change.status === 'pending' } : {}),
            ...(change.mode !== undefined ? { paymentMode: change.mode || undefined } : {}),
          })
        )
      );
      if (daily.length > 0) {
        await updateDailyPayments(
          daily.map((r) => ({
            workId: r.workId!,
            dailyId: r.dailyId!,
            change: {
              part: r.dailyPart || 'wages',
              itemId: r.dailyPart === 'other' ? r.dailyItemId : undefined,
              status: change.status,
              mode: change.mode,
            },
          }))
        );
      }
      await loadData({ silent: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to update payment');
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const openDailyLog = (row: UnifiedTransaction) => {
    window.location.hash = `#/work?workId=${encodeURIComponent(row.workId!)}&logId=${encodeURIComponent(row.dailyId!)}`;
  };

  // Instant in-memory filtering & sorting
  const filteredAndSortedTransactions = useMemo(() => {
    let list = [...transactions];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.category.toLowerCase().includes(q) ||
          (t.remarks && t.remarks.toLowerCase().includes(q)) ||
          (t.workCode && t.workCode.toLowerCase().includes(q)) ||
          (t.workName && t.workName.toLowerCase().includes(q)) ||
          (t.personName && t.personName.toLowerCase().includes(q)) ||
          (t.paymentMode && t.paymentMode.toLowerCase().includes(q)) ||
          t.amount.toString().includes(q)
      );
    }
    if (workFilter) list = list.filter((t) => t.workId === workFilter || t.workCode === workFilter);
    if (typeFilter === 'income') list = list.filter((t) => t.type === 'income');
    else if (typeFilter === 'expense') list = list.filter((t) => t.type === 'expense');
    else if (typeFilter === 'daily_logs') list = list.filter((t) => Boolean(t.isDailyWorkEntry));
    if (statusFilter) list = list.filter((t) => matchesStatusFilter(t, statusFilter));
    if (paymentModeFilter)
      list = list.filter((t) => cleanMode(t.paymentMode).split(' / ').includes(paymentModeFilter));
    if (startDate) list = list.filter((t) => new Date(t.date) >= new Date(startDate));
    if (endDate) list = list.filter((t) => new Date(t.date) <= new Date(endDate));

    list.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return dayOf(a) - dayOf(b) || createdOf(a) - createdOf(b);
        case 'workcode-asc':
          return (a.workCode || 'ZZZZ').localeCompare(b.workCode || 'ZZZZ');
        case 'workcode-desc':
          return (b.workCode || '').localeCompare(a.workCode || '');
        case 'workname-asc':
          return (a.workName || 'ZZZZ').localeCompare(b.workName || 'ZZZZ');
        case 'amount-desc':
          return Number(b.amount || 0) - Number(a.amount || 0);
        case 'amount-asc':
          return Number(a.amount || 0) - Number(b.amount || 0);
        default:
          // Same day: the most recently created record first
          return dayOf(b) - dayOf(a) || createdOf(b) - createdOf(a);
      }
    });
    return list;
  }, [transactions, searchTerm, workFilter, typeFilter, statusFilter, paymentModeFilter, startDate, endDate, sortBy]);

  const totals = useMemo(() => cashTotals(filteredAndSortedTransactions), [filteredAndSortedTransactions]);
  const availableModes = getAllPaymentModes(
    transactions.flatMap((t) => cleanMode(t.paymentMode).split(' / ')).filter(Boolean)
  );
  const hasFilters = Boolean(typeFilter || statusFilter || workFilter || paymentModeFilter || startDate || endDate);

  // Selection for bulk status changes (only rows still visible)
  const selectedRows = filteredAndSortedTransactions.filter((t) => selected.has(t.id));
  const allVisibleSelected =
    filteredAndSortedTransactions.length > 0 && filteredAndSortedTransactions.every((t) => selected.has(t.id));
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = async (status: 'paid' | 'pending') => {
    setBulkSaving(true);
    await applyChange(selectedRows, { status });
    setSelected(new Set());
    setBulkSaving(false);
  };

  const menuItems = (row: UnifiedTransaction, kind: 'status' | 'mode'): ActionMenuItem[] => {
    if (kind === 'mode') {
      const current = cleanMode(row.paymentMode);
      return [
        ...(row.isDailyWorkEntry ? [{ id: '', label: 'Not specified', tone: 'muted' as const, active: !current }] : []),
        ...availableModes.map((m) => ({ id: m.id, label: m.label, icon: CreditCard, active: current === m.id })),
      ];
    }
    const st = txnStatus(row);
    const isIncome = row.type === 'income';
    const items: ActionMenuItem[] = [
      { id: 'paid', label: isIncome ? 'Received' : 'Given', icon: CheckCircle2, tone: 'success', active: st === 'paid' },
      { id: 'pending', label: isIncome ? 'To get' : 'Pending', icon: Clock, tone: 'warning', active: st === 'pending' },
    ];
    if (row.isDailyWorkEntry) items.push({ id: 'clear', label: 'Clear status', icon: CircleDashed, tone: 'muted', active: !st });
    return items;
  };

  const statusPill = (row: UnifiedTransaction) => {
    const st: RowStatus = txnStatus(row);
    const style = STATUS_STYLE[st || 'none'];
    const Icon = style.icon;
    const saving = savingIds.has(row.id);
    return (
      <button
        type="button"
        onClick={(e) => setMenu({ rect: e.currentTarget.getBoundingClientRect(), row, kind: 'status' })}
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition hover:brightness-95 ${style.cls}`}
        title={row.isDailyWorkEntry && row.dailyPart === 'wages' ? 'Applies to all workers on this day' : 'Change status'}
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
        {statusLabel(row, st)}
        {st === 'partial' && row.pendingAmount ? ` · ₹${row.pendingAmount.toLocaleString()} due` : ''}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
    );
  };

  const columns: Column<UnifiedTransaction>[] = [
    {
      key: 'select',
      header: '',
      className: 'w-10 no-print',
      render: (row) => (
        <input
          type="checkbox"
          checked={selected.has(row.id)}
          onChange={() => toggleRow(row.id)}
          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          aria-label="Select row"
        />
      ),
    },
    {
      key: 'date',
      header: 'DATE',
      sortable: true,
      render: (row) => (
        <span className="whitespace-nowrap text-xs font-medium text-slate-800">
          {formatDate(row.date)}
        </span>
      ),
    },
    {
      key: 'workCode',
      header: 'WORK',
      sortable: true,
      render: (row) =>
        !row.workCode ? (
          <span className="text-xs italic text-slate-400">General</span>
        ) : (
          <div className="space-y-0.5">
            <span className="inline-block whitespace-nowrap rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">
              {row.workCode}
            </span>
            {row.workName && (
              <div className="line-clamp-1 max-w-[170px] text-[11px] text-slate-600">{row.workName}</div>
            )}
          </div>
        ),
    },
    {
      key: 'category',
      header: 'CATEGORY / DETAILS',
      sortable: true,
      render: (row) => (
        <MultiLineCell
          title={
            <span className="flex items-center gap-1.5">
              {row.type === 'income' ? (
                <TrendingUp className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 flex-shrink-0 text-rose-600" />
              )}
              <span>{row.category}</span>
            </span>
          }
          subtitle={<span className="line-clamp-1 max-w-[260px]">{row.remarks || '-'}</span>}
        />
      ),
    },
    {
      key: 'personName',
      header: 'PARTY',
      sortable: true,
      render: (row) => <span className="text-xs text-slate-700">{row.personName || '—'}</span>,
    },
    {
      key: 'paymentMode',
      header: 'MODE',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={(e) => setMenu({ rect: e.currentTarget.getBoundingClientRect(), row, kind: 'mode' })}
          className="group inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
          title="Change payment mode"
        >
          {cleanMode(row.paymentMode) || <span className="text-slate-400">Not set</span>}
          <ChevronDown className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
        </button>
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      render: (row) => statusPill(row),
    },
    {
      key: 'amount',
      header: 'AMOUNT (₹)',
      sortable: true,
      render: (row) => (
        <span
          className={`whitespace-nowrap font-mono text-sm font-semibold ${
            row.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {row.type === 'income' ? '+' : '-'}₹{Number(row.amount || 0).toLocaleString()}
        </span>
      ),
    },
  ];

  const selectStyle = 'form-input !w-auto !py-1.5 text-xs';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Tracker"
        subtitle="Income, receivables, daily log wages and site purchases in one place."
        showFiltersButton={true}
        filtersOpen={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        secondaryActions={
          <>
            <button type="button" onClick={() => loadData()} disabled={loading} className="btn-secondary">
              <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button type="button" onClick={() => setIsPrintViewOpen(true)} className="btn-secondary">
              <Printer className="h-4 w-4 text-slate-500" />
              <span className="hidden sm:inline">Print Report</span>
            </button>
          </>
        }
        primaryAction={{
          label: 'Add Transaction',
          onClick: () => {
            setEditingExpense(null);
            setIsModalOpen(true);
          },
          icon: Plus,
        }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard loading={loading} title="Income Received" value={`₹${totals.received.toLocaleString()}`} icon={TrendingUp} variant="success" />
        <StatCard
          loading={loading}
          title="To Get"
          value={`₹${totals.toGet.toLocaleString()}`}
          subtitle="Pending from clients"
          icon={Flag}
          variant="warning"
        />
        <StatCard
          loading={loading}
          title="Paid Out"
          value={`₹${totals.paidOut.toLocaleString()}`}
          subtitle={`₹${totals.pendingOut.toLocaleString()} still to pay`}
          icon={TrendingDown}
          variant="danger"
        />
        <StatCard
          loading={loading}
          title="Net Cash"
          value={`₹${totals.net.toLocaleString()}`}
          subtitle="Received minus paid out"
          icon={Wallet}
          variant={totals.net >= 0 ? 'success' : 'danger'}
        />
      </div>

      {showFilters && (
        <div className="card flex flex-wrap items-center gap-3 p-4 no-print">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectStyle}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
            <option value="daily_logs">Daily logs only</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={selectStyle}>
            {STATUS_FILTERS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select value={workFilter} onChange={(e) => setWorkFilter(e.target.value)} className={`${selectStyle} max-w-xs`}>
            <option value="">All works</option>
            {workOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.workCode} · {w.name}
              </option>
            ))}
          </select>
          <select value={paymentModeFilter} onChange={(e) => setPaymentModeFilter(e.target.value)} className={selectStyle}>
            <option value="">All modes</option>
            {availableModes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={selectStyle} title="From" />
            –
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={selectStyle} title="To" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectStyle}>
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="workcode-asc">Work code A–Z</option>
              <option value="workcode-desc">Work code Z–A</option>
              <option value="workname-asc">Work name A–Z</option>
              <option value="amount-desc">Highest amount</option>
              <option value="amount-asc">Lowest amount</option>
            </select>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter('');
                setStatusFilter('');
                setWorkFilter('');
                setPaymentModeFilter('');
                setStartDate('');
                setEndDate('');
              }}
              className="btn-ghost text-blue-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="print-only">
        <PrintHeader
          title="EXPENSE STATEMENT"
          date={new Date().toISOString()}
          subtitle="Income, receivables, daily wages and site expenses."
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="card sticky top-20 z-20 flex flex-wrap items-center justify-between gap-3 border-blue-300 bg-blue-50/60 px-4 py-3 no-print">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-slate-900">{selectedRows.length} selected</span>
            <button
              type="button"
              onClick={() =>
                setSelected(allVisibleSelected ? new Set() : new Set(filteredAndSortedTransactions.map((t) => t.id)))
              }
              className="btn-ghost"
            >
              {allVisibleSelected ? 'Unselect all' : `Select all ${filteredAndSortedTransactions.length}`}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={bulkSaving || selectedRows.length === 0} onClick={() => runBulk('paid')} className="btn-secondary">
              {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              Mark given / received
            </button>
            <button type="button" disabled={bulkSaving || selectedRows.length === 0} onClick={() => runBulk('pending')} className="btn-secondary">
              <Clock className="h-4 w-4 text-amber-600" />
              Mark pending
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="btn-icon" title="Clear selection">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <DataTable<UnifiedTransaction>
        columns={columns}
        data={filteredAndSortedTransactions}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by work code, job title, party, category, amount..."
        isLoading={loading}
        rowKey={(e) => e.id}
        onEdit={(item) => {
          if (isDailyRow(item)) {
            openDailyLog(item);
          } else {
            setEditingExpense(item);
            setIsModalOpen(true);
          }
        }}
        onDelete={(item) => {
          if (!item.isDailyWorkEntry) setDeleteTarget(item);
          else openDailyLog(item);
        }}
        emptyMessage="No financial transactions recorded for the selected criteria."
      />

      {/* Summary */}
      <div className="card grid grid-cols-2 overflow-hidden sm:grid-cols-5 sm:divide-x sm:divide-slate-300 no-print">
        {[
          { label: 'Received', value: `+₹${totals.received.toLocaleString()}`, cls: 'text-emerald-700', bg: 'bg-emerald-50/60' },
          { label: 'To get', value: `₹${totals.toGet.toLocaleString()}`, cls: 'text-amber-700', bg: '' },
          { label: 'Paid out', value: `-₹${totals.paidOut.toLocaleString()}`, cls: 'text-rose-700', bg: 'bg-rose-50/60' },
          { label: 'Pending to pay', value: `₹${totals.pendingOut.toLocaleString()}`, cls: 'text-amber-700', bg: '' },
          {
            label: `Net cash · ${filteredAndSortedTransactions.length} rows`,
            value: `₹${totals.net.toLocaleString()}`,
            cls: totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700',
            bg: '',
          },
        ].map((item) => (
          <div key={item.label} className={`px-5 py-4 ${item.bg}`}>
            <span className="text-xs text-slate-500">{item.label}</span>
            <span className={`mt-1 block font-mono text-lg font-semibold ${item.cls}`}>{item.value}</span>
          </div>
        ))}
      </div>

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingExpense(null);
        }}
        onSave={handleSave}
        initialData={editingExpense}
        worksList={workOptions}
      />

      {isPrintViewOpen && (
        <ExpensePrintView
          transactions={transactions}
          works={workOptions}
          initial={{ startDate, endDate, workId: workFilter, status: statusFilter, mode: paymentModeFilter }}
          onClose={() => setIsPrintViewOpen(false)}
        />
      )}

      {menu && (
        <ActionMenu
          anchorRect={menu.rect}
          title={
            menu.kind === 'mode'
              ? 'Payment mode'
              : menu.row.isDailyWorkEntry && menu.row.dailyPart === 'wages'
              ? 'Status for all workers this day'
              : menu.row.isDailyWorkEntry && menu.row.dailyPart === 'other' && !menu.row.dailyItemId
              ? "Status for all of this day's site expenses"
              : 'Payment status'
          }
          items={menuItems(menu.row, menu.kind)}
          footer={
            menu.kind === 'mode' ? (
              <form
                className="mt-1 flex items-center gap-1 border-t border-slate-200 px-1 pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newModeDraft.trim();
                  if (!name) return;
                  const existing = availableModes.find((m) => m.id.toLowerCase() === name.toLowerCase());
                  if (!existing) saveCustomPaymentMode(name);
                  applyChange([menu.row], { mode: existing ? existing.id : name });
                  setNewModeDraft('');
                  setMenu(null);
                }}
              >
                <input
                  type="text"
                  value={newModeDraft}
                  onChange={(e) => setNewModeDraft(e.target.value)}
                  placeholder="+ Add payment mode"
                  className="form-input !py-1 text-xs"
                />
                <button type="submit" className="btn-primary !px-2 !py-1" title="Add mode">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : undefined
          }
          onClose={() => {
            setNewModeDraft('');
            setMenu(null);
          }}
          onSelect={(id) => {
            const row = menu.row;
            if (menu.kind === 'mode') applyChange([row], { mode: id });
            else applyChange([row], { status: id === 'clear' ? null : (id as 'paid' | 'pending') });
          }}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        title="Delete Transaction"
        message={`Are you sure you want to delete this ${deleteTarget?.type} record of ₹${Number(deleteTarget?.amount || 0).toLocaleString()} under "${deleteTarget?.category}"?`}
      />
    </div>
  );
};
