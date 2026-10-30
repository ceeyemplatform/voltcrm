// Payment status rules shared by the daily log, work page, expense tracker and prints.
// Keep in sync with backend/src/common/payment-status.ts.
import { DailyLabourMember, DailyOtherExpense, DailyWorkDetail, Expense, PayStatus } from '../types';

export type RowStatus = PayStatus | 'partial' | undefined;

/** Logs saved before per-worker tracking count as fully paid unless they recorded otherwise. */
const isLegacy = (d: DailyWorkDetail) => !d.paymentTracking;

export const memberStatus = (d: DailyWorkDetail, m: DailyLabourMember): PayStatus | undefined =>
  m.paymentStatus ?? (isLegacy(d) ? d.paymentStatus ?? 'paid' : undefined);

export const wagesTotal = (d: DailyWorkDetail) =>
  d.labourMembers && d.labourMembers.length > 0
    ? d.labourMembers.reduce((s, m) => s + Number(m.wage || 0), 0)
    : Number(d.totalDailyWage || 0);

export const otherTotal = (d: DailyWorkDetail) =>
  Number(d.totalOtherExpenses ?? (d.otherExpenses || []).reduce((s, e) => s + Number(e.amount || 0), 0));

/** Mode for one worker: their own, else the day's wage mode */
export const memberMode = (d: DailyWorkDetail, m: DailyLabourMember) =>
  m.paymentMode || d.wagesPaymentMode || d.paymentMode || '';

/** Distinct modes used to pay the day's wages, e.g. "Cash / UPI" */
export const wagesMode = (d: DailyWorkDetail) => {
  const members = d.labourMembers || [];
  if (members.length === 0) return d.wagesPaymentMode || d.paymentMode || '';
  return Array.from(
    new Set(members.filter((m) => memberStatus(d, m) !== 'pending').map((m) => memberMode(d, m)).filter(Boolean))
  ).join(' / ');
};
export const otherMode = (d: DailyWorkDetail) => d.otherPaymentMode ?? d.paymentMode ?? '';

export const otherStatus = (d: DailyWorkDetail): PayStatus | undefined =>
  d.otherPaymentStatus ?? (isLegacy(d) ? d.paymentStatus ?? 'paid' : undefined);

/** Status for one site expense: its own, else the day's */
export const otherItemStatus = (d: DailyWorkDetail, e: DailyOtherExpense): PayStatus | undefined =>
  e.paymentStatus ?? otherStatus(d);

/** Mode for one site expense: its own, else the day's */
export const otherItemMode = (d: DailyWorkDetail, e: DailyOtherExpense) => e.paymentMode || otherMode(d);

const otherItems = (d: DailyWorkDetail) => (d.otherExpenses || []).filter((e) => Number(e.amount || 0) > 0);

/** Overall site expense status for a day, the amount still owed and the modes used. */
export const otherSummary = (d: DailyWorkDetail): { status: RowStatus; pending: number; mode: string } => {
  const items = otherItems(d);
  if (items.length === 0) {
    const st = otherStatus(d);
    return { status: st, pending: st === 'pending' ? otherTotal(d) : 0, mode: otherMode(d) };
  }
  const statuses = items.map((e) => otherItemStatus(d, e));
  const pending = items.reduce((s, e, i) => s + (statuses[i] === 'pending' ? Number(e.amount || 0) : 0), 0);
  const first = statuses[0];
  const status: RowStatus = statuses.every((s) => s === first) ? first : 'partial';
  const mode = Array.from(
    new Set(items.filter((_, i) => statuses[i] !== 'pending').map((e) => otherItemMode(d, e)).filter(Boolean))
  ).join(' / ');
  return { status, pending, mode };
};

/** Overall wage status for a day plus the amount still owed. */
export const wagesSummary = (d: DailyWorkDetail): { status: RowStatus; pending: number } => {
  const members = d.labourMembers || [];
  if (members.length === 0) {
    const st = isLegacy(d) ? d.paymentStatus ?? 'paid' : undefined;
    return { status: st, pending: st === 'pending' ? wagesTotal(d) : 0 };
  }
  const statuses = members.map((m) => memberStatus(d, m));
  const pending = members.reduce((s, m, i) => s + (statuses[i] === 'pending' ? Number(m.wage || 0) : 0), 0);
  const first = statuses[0];
  const status: RowStatus = statuses.every((s) => s === first) ? first : 'partial';
  return { status, pending };
};

/** Total still owed for a whole day (wages + site expenses). */
export const dayPending = (d: DailyWorkDetail) =>
  wagesSummary(d).pending + otherSummary(d).pending;

/** Converts a legacy log to explicit per-worker statuses so it can be edited safely. */
export const materializeTracking = (d: DailyWorkDetail): DailyWorkDetail => {
  if (!isLegacy(d)) return d;
  return {
    ...d,
    labourMembers: (d.labourMembers || []).map((m) => {
      const paymentStatus = memberStatus(d, m);
      return { ...m, paymentStatus, paymentMode: paymentStatus === 'paid' ? memberMode(d, m) || undefined : undefined };
    }),
    wagesPaymentMode: wagesMode(d) || undefined,
    otherPaymentMode: otherMode(d) || undefined,
    otherPaymentStatus: otherTotal(d) > 0 ? otherStatus(d) : undefined,
    paymentStatus: undefined,
    paymentMode: undefined,
    paymentTracking: true,
  };
};

export interface DailyPaymentChange {
  part: 'wages' | 'other';
  /** For site expenses: the one item to change; all items when unset */
  itemId?: string;
  /** null clears the status; undefined leaves it as is */
  status?: PayStatus | null;
  /** '' clears the mode; undefined leaves it as is */
  mode?: string;
}

export const applyDailyPaymentChange = (d: DailyWorkDetail, change: DailyPaymentChange): DailyWorkDetail => {
  const next = materializeTracking(d);
  if (change.part === 'wages') {
    // A day-level change applies to every worker; a mode is only kept for workers marked given
    return {
      ...next,
      labourMembers: (next.labourMembers || []).map((m) => {
        const paymentStatus = change.status === undefined ? m.paymentStatus : change.status || undefined;
        const paymentMode = change.mode === undefined ? m.paymentMode : change.mode || undefined;
        return { ...m, paymentStatus, paymentMode: paymentStatus === 'paid' ? paymentMode : undefined };
      }),
      wagesPaymentMode: change.mode === undefined ? next.wagesPaymentMode : change.mode || undefined,
    };
  }
  const items = next.otherExpenses || [];
  if (items.length === 0) {
    const otherPaymentStatus = change.status === undefined ? next.otherPaymentStatus : change.status || undefined;
    const otherPaymentMode = change.mode === undefined ? next.otherPaymentMode : change.mode || undefined;
    return {
      ...next,
      otherPaymentStatus,
      otherPaymentMode: otherPaymentStatus === 'paid' ? otherPaymentMode : undefined,
    };
  }
  // Items carry their own status; the day-level values are folded into each item first
  return {
    ...next,
    otherExpenses: items.map((e) => {
      const curStatus = otherItemStatus(next, e);
      const curMode = curStatus === 'paid' ? otherItemMode(next, e) || undefined : undefined;
      if (change.itemId && e.id !== change.itemId) return { ...e, paymentStatus: curStatus, paymentMode: curMode };
      const paymentStatus = change.status === undefined ? curStatus : change.status || undefined;
      const paymentMode = change.mode === undefined ? curMode : change.mode || undefined;
      return { ...e, paymentStatus, paymentMode: paymentStatus === 'paid' ? paymentMode : undefined };
    }),
    otherPaymentStatus: undefined,
    otherPaymentMode: undefined,
  };
};

/** Status of any expense-tracker row (manual transactions always have one). */
export const txnStatus = (t: Expense): RowStatus =>
  t.dailyId ? t.paymentStatus : t.paymentStatus ?? (t.isFlagged ? 'pending' : 'paid');

export const txnPendingAmount = (t: Expense) => {
  const st = txnStatus(t);
  if (st === 'pending') return t.pendingAmount ?? Number(t.amount || 0);
  if (st === 'partial') return Number(t.pendingAmount || 0);
  return 0;
};

/** Labels depend on direction: income is received / to get, expense is given / pending. */
export const statusLabel = (t: Pick<Expense, 'type'>, st: RowStatus) => {
  if (!st) return 'Not set';
  if (st === 'partial') return 'Partly given';
  if (t.type === 'income') return st === 'paid' ? 'Received' : 'To get';
  return st === 'paid' ? 'Given' : 'Pending';
};

export interface CashTotals {
  received: number;
  toGet: number;
  outflow: number;
  pendingOut: number;
  paidOut: number;
  net: number;
}

export const cashTotals = (items: Expense[]): CashTotals => {
  let received = 0;
  let toGet = 0;
  let outflow = 0;
  let pendingOut = 0;
  for (const t of items) {
    const amt = Number(t.amount || 0);
    if (t.type === 'income') {
      const p = txnPendingAmount(t);
      toGet += p;
      received += amt - p;
    } else {
      outflow += amt;
      pendingOut += txnPendingAmount(t);
    }
  }
  const paidOut = outflow - pendingOut;
  return { received, toGet, outflow, pendingOut, paidOut, net: received - paidOut };
};

export type StatusFilter = '' | 'received' | 'to_get' | 'given' | 'pending' | 'not_set';

export const STATUS_FILTERS: [StatusFilter, string][] = [
  ['', 'All statuses'],
  ['received', 'Received'],
  ['to_get', 'To get'],
  ['given', 'Given'],
  ['pending', 'Pending (incl. partly given)'],
  ['not_set', 'Not set'],
];

export const matchesStatusFilter = (t: Expense, f: StatusFilter) => {
  if (!f) return true;
  const st = txnStatus(t);
  if (f === 'received') return t.type === 'income' && st === 'paid';
  if (f === 'to_get') return t.type === 'income' && st === 'pending';
  if (f === 'given') return t.type === 'expense' && st === 'paid';
  if (f === 'pending') return t.type === 'expense' && (st === 'pending' || st === 'partial');
  return !st;
};
