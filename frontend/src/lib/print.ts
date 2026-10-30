import { useEffect } from 'react';
import { formatDate, todayISO } from './dates';

/** Date and time of the download, e.g. 29-10-2026_14-35, safe inside a file name. */
export const fileDate = () => {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  return `${formatDate(todayISO()).replace(/\//g, '-')}_${time}`;
};

/**
 * Builds a file name like "WorkReport-WRK-2610-996-Lightfitting-29-10-2026_14-35": parts joined by "-",
 * no spaces anywhere, and characters Windows disallows removed.
 */
export const buildFileName = (...parts: (string | number | null | undefined)[]) =>
  parts
    .map((p) => String(p ?? '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((p) => p.replace(/\s+/g, ''))
    .join('-')
    .slice(0, 150);

/**
 * Prints with a suggested file name: browsers use the page title as the default
 * name for "Save as PDF", so it is swapped in for the duration of the print.
 */
export const printWithFileName = (name: string, options: { landscape?: boolean } = {}) => {
  const previous = document.title;
  document.title = name;
  let pageStyle: HTMLStyleElement | null = null;
  if (options.landscape) {
    pageStyle = document.createElement('style');
    pageStyle.textContent = '@page { size: A4 landscape; margin: 10mm 0 0 0; }';
    document.head.appendChild(pageStyle);
  }
  // Printed documents are always light, even in dark mode
  const root = document.documentElement;
  const wasDark = root.classList.contains('dark');
  root.classList.remove('dark');
  document.body.classList.remove('dark');
  const restore = () => {
    document.title = previous;
    pageStyle?.remove();
    if (wasDark) {
      root.classList.add('dark');
      document.body.classList.add('dark');
    }
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
};

/** While a print popup is open, printing outputs only the popup (marked `print-doc`), not the page behind it. */
export const usePrintIsolation = (active = true) => {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add('print-doc-open');
    return () => document.body.classList.remove('print-doc-open');
  }, [active]);
};
