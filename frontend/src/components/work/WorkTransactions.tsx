import React, { useEffect, useState } from 'react';
import { formatDate } from '../../lib/dates';
import {
  Plus,
  Edit2,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  CreditCard,
  Clock,
} from 'lucide-react';
import { Expense, Work } from '../../types';
import { api } from '../../lib/api';
import { ExpenseModal } from '../expense/ExpenseModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { Skeleton } from '../common/Skeleton';

export interface WorkTransactionTotals {
  income: number;
  expense: number;
}

interface WorkTransactionsProps {
  work: Work;
  /** Reports income/expense totals so the page can include them in its figures */
  onTotalsChange?: (totals: WorkTransactionTotals) => void;
}

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

type TxFilter = '' | 'income' | 'expense' | 'received' | 'to_get' | 'given' | 'pending';

const TX_FILTERS: [TxFilter, string][] = [
  ['', 'All'],
  ['income', 'Income'],
  ['expense', 'Expense'],
  ['received', 'Received'],
  ['to_get', 'To get'],
  ['given', 'Given'],
  ['pending', 'Pending'],
];

const matchesTxFilter = (t: Expense, f: TxFilter) => {
  const isIn = t.type === 'income';
  switch (f) {
    case 'income':
      return isIn;
    case 'expense':
      return !isIn;
    case 'received':
      return isIn && !t.isFlagged;
    case 'to_get':
      return isIn && Boolean(t.isFlagged);
    case 'given':
      return !isIn && !t.isFlagged;
    case 'pending':
      return !isIn && Boolean(t.isFlagged);
    default:
      return true;
  }
};

/** Expenses and income recorded against one work, apart from its daily logs. */
export const WorkTransactions: React.FC<WorkTransactionsProps> = ({ work, onTotalsChange }) => {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'income' | 'expense' | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<TxFilter>('');

  const load = async () => {
    setError(null);
    try {
      const list = await api.expenses.list({ workId: work.id });
      // Newest date first; within a day, the most recently created record first
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setItems(sorted);
      onTotalsChange?.({
        income: sorted.filter((t) => t.type === 'income' && !t.isFlagged).reduce((s, t) => s + Number(t.amount || 0), 0),
        expense: sorted.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work.id]);

  const handleSave = async (data: Partial<Expense>) => {
    if (editing) await api.expenses.update(editing.id, data);
    else await api.expenses.create(data);
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.expenses.delete(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete transaction');
    } finally {
      setDeleting(false);
    }
  };

  const visibleItems = items.filter((t) => matchesTxFilter(t, filter));

  // Footer figures follow the selected filter
  const sumOf = (pred: (t: Expense) => boolean) =>
    visibleItems.filter(pred).reduce((s, t) => s + Number(t.amount || 0), 0);
  const shown = {
    received: sumOf((t) => t.type === 'income' && !t.isFlagged),
    toGet: sumOf((t) => t.type === 'income' && Boolean(t.isFlagged)),
    given: sumOf((t) => t.type === 'expense' && !t.isFlagged),
    pending: sumOf((t) => t.type === 'expense' && Boolean(t.isFlagged)),
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            Expenses & Payments
          </h3>
          <p className="text-[13px] text-slate-500">Purchases, bills and client payments for this work</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalType('income');
            }}
            className="btn-secondary !px-3 !py-1.5"
          >
            <Plus className="h-4 w-4 text-emerald-600" />
            Income
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalType('expense');
            }}
            className="btn-secondary !px-3 !py-1.5"
          >
            <Plus className="h-4 w-4 text-rose-600" />
            Expense
          </button>
        </div>
      </div>

      {error && (
        <p className="border-b border-slate-300 bg-rose-50 px-5 py-2 text-xs text-rose-700">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3 px-5 py-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Receipt className="h-5 w-5" />
          </span>
          <p className="mt-2 text-sm text-slate-500">No expenses or payments recorded for this work.</p>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalType('expense');
            }}
            className="btn-primary mt-4"
          >
            <Plus className="h-4 w-4" />
            Add expense
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 border-b border-slate-300 bg-slate-50/60 px-5 py-2.5">
            {TX_FILTERS.map(([id, label]) => {
              const count = items.filter((t) => matchesTxFilter(t, id)).length;
              return (
                <button
                  key={id || 'all'}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${
                    filter === id
                      ? 'bg-blue-50 text-blue-700 ring-blue-300'
                      : 'bg-white text-slate-600 ring-slate-300 hover:text-slate-900'
                  }`}
                >
                  {label} <span className="text-slate-400">{count}</span>
                </button>
              );
            })}
          </div>
          {visibleItems.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-slate-500">No records match this filter.</p>
          )}
          <ul className="divide-y divide-slate-300">
            {visibleItems.map((t) => {
              const isIn = t.type === 'income';
              return (
                <li key={t.id} className="group flex items-center gap-3 px-5 py-3">
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ring-1 ${
                      isIn ? 'bg-emerald-50 text-emerald-600 ring-emerald-200' : 'bg-rose-50 text-rose-600 ring-rose-200'
                    }`}
                  >
                    {isIn ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {t.category}
                      {t.isFlagged && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 align-middle text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                          <Clock className="h-3 w-3" />
                          {isIn ? 'To get' : 'Pending'}
                        </span>
                      )}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span>
                        {formatDate(t.date)}
                      </span>
                      {t.personName && <span>· {t.personName}</span>}
                      {t.paymentMode && (
                        <span className="inline-flex items-center gap-1">
                          · <CreditCard className="h-3 w-3" /> {t.paymentMode}
                        </span>
                      )}
                      {t.remarks && <span className="truncate">· {t.remarks}</span>}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 font-mono text-sm font-semibold ${
                      t.isFlagged ? 'text-amber-700' : isIn ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {isIn ? '+' : '-'}
                    {money(Number(t.amount || 0))}
                  </span>
                  <div className="flex flex-shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(t);
                        setModalType(t.type);
                      }}
                      className="btn-icon !h-7 !w-7 hover:!bg-blue-50 hover:!text-blue-600"
                      title="Edit"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(t)}
                      className="btn-icon !h-7 !w-7 hover:!bg-rose-50 hover:!text-rose-600"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-2 divide-x divide-slate-300 border-t border-slate-300 text-sm">
            <div className="bg-emerald-50/60 px-5 py-3">
              <span className="text-xs text-slate-500">Income{filter ? ' (filtered)' : ''}</span>
              <span className="block font-mono font-semibold text-emerald-700">
                +{money(shown.received + shown.toGet)}
              </span>
              <span className="mt-1 flex flex-wrap gap-x-3 text-[11px]">
                <span className="text-emerald-700">Received {money(shown.received)}</span>
                <span className="text-amber-700">To get {money(shown.toGet)}</span>
              </span>
            </div>
            <div className="bg-rose-50/60 px-5 py-3">
              <span className="text-xs text-slate-500">Expenses{filter ? ' (filtered)' : ''}</span>
              <span className="block font-mono font-semibold text-rose-700">
                -{money(shown.given + shown.pending)}
              </span>
              <span className="mt-1 flex flex-wrap gap-x-3 text-[11px]">
                <span className="text-rose-700">Given {money(shown.given)}</span>
                <span className="text-amber-700">Pending {money(shown.pending)}</span>
              </span>
            </div>
          </div>
        </>
      )}

      <ExpenseModal
        isOpen={modalType !== null}
        onClose={() => {
          setModalType(null);
          setEditing(null);
        }}
        onSave={handleSave}
        initialData={editing}
        fixedWork={work}
        defaultType={modalType || 'expense'}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Transaction"
        message={`Delete this ${deleteTarget?.type === 'income' ? 'income' : 'expense'} of ₹${Number(
          deleteTarget?.amount || 0
        ).toLocaleString('en-IN')} (${deleteTarget?.category})?`}
      />
    </div>
  );
};
