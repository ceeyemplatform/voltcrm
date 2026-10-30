// Payment status rules for daily logs stored as JSON on Work.dailyDetails.
// Keep in sync with frontend/src/lib/payments.ts.

export type PayStatus = 'paid' | 'pending';
export type RowStatus = PayStatus | 'partial' | undefined;

/** Logs saved before per-worker tracking count as fully paid unless they recorded otherwise. */
const isLegacy = (d: any) => !d?.paymentTracking;

export const memberStatus = (d: any, m: any): PayStatus | undefined =>
  m?.paymentStatus ?? (isLegacy(d) ? d?.paymentStatus ?? 'paid' : undefined);

export const wagesTotal = (d: any): number =>
  Array.isArray(d?.labourMembers) && d.labourMembers.length > 0
    ? d.labourMembers.reduce((s: number, m: any) => s + Number(m?.wage || 0), 0)
    : Number(d?.totalDailyWage || 0);

export const otherTotal = (d: any): number =>
  Number(
    d?.totalOtherExpenses ??
      (Array.isArray(d?.otherExpenses)
        ? d.otherExpenses.reduce((s: number, e: any) => s + Number(e?.amount || 0), 0)
        : 0),
  );

export const memberMode = (d: any, m: any): string =>
  m?.paymentMode || d?.wagesPaymentMode || d?.paymentMode || '';

/** Distinct modes used to pay the day's wages, e.g. "Cash / UPI" */
export const wagesMode = (d: any): string => {
  const members: any[] = Array.isArray(d?.labourMembers) ? d.labourMembers : [];
  if (members.length === 0) return d?.wagesPaymentMode || d?.paymentMode || '';
  return Array.from(
    new Set(
      members
        .filter((m) => memberStatus(d, m) !== 'pending')
        .map((m) => memberMode(d, m))
        .filter(Boolean),
    ),
  ).join(' / ');
};
export const otherMode = (d: any): string => d?.otherPaymentMode ?? d?.paymentMode ?? '';

export const otherStatus = (d: any): PayStatus | undefined =>
  d?.otherPaymentStatus ?? (isLegacy(d) ? d?.paymentStatus ?? 'paid' : undefined);

/** Status for one site expense: its own, else the day's */
export const otherItemStatus = (d: any, e: any): PayStatus | undefined =>
  e?.paymentStatus ?? otherStatus(d);

/** Mode for one site expense: its own, else the day's */
export const otherItemMode = (d: any, e: any): string => e?.paymentMode || otherMode(d);

/** Overall site expense status for a day, the amount still owed and the modes used. */
export const otherSummary = (d: any): { status: RowStatus; pending: number; mode: string } => {
  const items: any[] = (Array.isArray(d?.otherExpenses) ? d.otherExpenses : []).filter(
    (e: any) => Number(e?.amount || 0) > 0,
  );
  if (items.length === 0) {
    const st = otherStatus(d);
    return { status: st, pending: st === 'pending' ? otherTotal(d) : 0, mode: otherMode(d) };
  }
  const statuses = items.map((e) => otherItemStatus(d, e));
  const pending = items.reduce(
    (s, e, i) => s + (statuses[i] === 'pending' ? Number(e?.amount || 0) : 0),
    0,
  );
  const first = statuses[0];
  const status: RowStatus = statuses.every((s) => s === first) ? first : 'partial';
  const mode = Array.from(
    new Set(
      items
        .filter((_, i) => statuses[i] !== 'pending')
        .map((e) => otherItemMode(d, e))
        .filter(Boolean),
    ),
  ).join(' / ');
  return { status, pending, mode };
};

export const wagesSummary = (d: any): { status: RowStatus; pending: number } => {
  const members: any[] = Array.isArray(d?.labourMembers) ? d.labourMembers : [];
  if (members.length === 0) {
    const st: PayStatus | undefined = isLegacy(d) ? d?.paymentStatus ?? 'paid' : undefined;
    return { status: st, pending: st === 'pending' ? wagesTotal(d) : 0 };
  }
  const statuses = members.map((m) => memberStatus(d, m));
  const pending = members.reduce(
    (s, m, i) => s + (statuses[i] === 'pending' ? Number(m?.wage || 0) : 0),
    0,
  );
  const first = statuses[0];
  const status: RowStatus = statuses.every((s) => s === first) ? first : 'partial';
  return { status, pending };
};

export const statusText = (type: 'income' | 'expense', st: RowStatus): string => {
  if (!st) return '';
  if (st === 'partial') return 'Partly given';
  if (type === 'income') return st === 'paid' ? 'Received' : 'To get';
  return st === 'paid' ? 'Given' : 'Pending';
};
