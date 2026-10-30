// Dates are always shown as DD/MM/YYYY, independent of the browser's locale.

const pad = (n: number) => String(n).padStart(2, '0');

/** Today as YYYY-MM-DD in local time (toISOString would give yesterday's date before 5:30 AM in India). */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Values saved as a plain date (YYYY-MM-DD or midnight UTC) keep their calendar day in every time zone. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z?)?$/;

export const formatDate = (value?: string | Date | null): string => {
  if (!value) return '—';
  if (typeof value === 'string') {
    const m = value.match(DATE_ONLY);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Short weekday for a stored date, e.g. "Sat". */
export const weekdayOf = (value: string) => {
  const m = value.match(DATE_ONLY);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
};
