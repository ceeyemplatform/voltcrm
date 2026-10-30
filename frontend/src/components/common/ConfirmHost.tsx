import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface ConfirmRequest {
  title: string;
  message: string;
  confirmText: string;
  resolve: (ok: boolean) => void;
}

let show: ((req: ConfirmRequest) => void) | null = null;

/**
 * Asks the user to confirm a delete; resolves true on confirm.
 * Usable from any handler: `if (!(await confirmDelete('Remove this row?'))) return;`
 */
export const confirmDelete = (
  message: string,
  opts: { title?: string; confirmText?: string } = {}
): Promise<boolean> =>
  new Promise((resolve) => {
    if (!show) {
      resolve(window.confirm(message));
      return;
    }
    show({ title: opts.title || 'Confirm delete', confirmText: opts.confirmText || 'Delete', message, resolve });
  });

/** Renders the confirm dialog; mount once at the app root. */
export const ConfirmHost: React.FC = () => {
  const [req, setReq] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    show = (next) => setReq(next);
    return () => {
      show = null;
    };
  }, []);

  const finish = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };

  useEffect(() => {
    if (!req) return;
    // Captured first so Escape/Enter don't also reach the popup underneath
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        req.resolve(e.key === 'Enter');
        setReq(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [req]);

  if (!req) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 no-print">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => finish(false)} />
      <div role="alertdialog" aria-modal="true" className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
        <div className="flex items-start gap-4 p-6">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{req.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{req.message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-slate-300 bg-slate-50/60 px-6 py-4">
          <button type="button" onClick={() => finish(false)} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => finish(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            {req.confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
