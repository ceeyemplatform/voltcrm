import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Save } from 'lucide-react';

interface ChoiceButton {
  id: string;
  label: string;
  kind: 'danger' | 'primary' | 'secondary';
}

interface ChoiceRequest {
  title: string;
  message: string;
  tone: 'danger' | 'info';
  /** Shown left to right; the last one has focus and answers Enter */
  buttons: ChoiceButton[];
  /** Answer for Escape or a click outside the box */
  cancelId: string;
  resolve: (id: string) => void;
}

let show: ((req: ChoiceRequest) => void) | null = null;

const ask = (req: Omit<ChoiceRequest, 'resolve'>, fallback: () => string): Promise<string> =>
  new Promise((resolve) => {
    if (!show) {
      resolve(fallback());
      return;
    }
    show({ ...req, resolve });
  });

/**
 * Asks the user to confirm a delete; resolves true on confirm.
 * Usable from any handler: `if (!(await confirmDelete('Remove this row?'))) return;`
 */
export const confirmDelete = async (
  message: string,
  opts: { title?: string; confirmText?: string } = {}
): Promise<boolean> =>
  (await ask(
    {
      title: opts.title || 'Confirm delete',
      message,
      tone: 'danger',
      buttons: [
        { id: 'cancel', label: 'Cancel', kind: 'secondary' },
        { id: 'ok', label: opts.confirmText || 'Delete', kind: 'danger' },
      ],
      cancelId: 'cancel',
    },
    () => (window.confirm(message) ? 'ok' : 'cancel')
  )) === 'ok';

/** Asks what to do with unsaved changes before closing: save them, drop them, or stay. */
export const askSaveChanges = (message = 'You have changes that are not saved yet.') =>
  ask(
    {
      title: 'Save changes?',
      message,
      tone: 'info',
      buttons: [
        { id: 'cancel', label: 'Cancel', kind: 'secondary' },
        { id: 'discard', label: "Don't save", kind: 'secondary' },
        { id: 'save', label: 'Save', kind: 'primary' },
      ],
      cancelId: 'cancel',
    },
    () => (window.confirm(`${message} Save them before closing?`) ? 'save' : 'discard')
  ) as Promise<'save' | 'discard' | 'cancel'>;

const BUTTON_CLASS: Record<ChoiceButton['kind'], string> = {
  secondary: 'btn-secondary',
  primary: 'btn-primary',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700',
};

/** Renders the confirm dialog; mount once at the app root. */
export const ConfirmHost: React.FC = () => {
  const [req, setReq] = useState<ChoiceRequest | null>(null);

  useEffect(() => {
    show = (next) => setReq(next);
    return () => {
      show = null;
    };
  }, []);

  const finish = (id: string) => {
    req?.resolve(id);
    setReq(null);
  };

  useEffect(() => {
    if (!req) return;
    // Captured first so Escape/Enter don't also reach the popup underneath
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        req.resolve(e.key === 'Enter' ? req.buttons[req.buttons.length - 1].id : req.cancelId);
        setReq(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [req]);

  if (!req) return null;

  const danger = req.tone === 'danger';
  const Icon = danger ? AlertTriangle : Save;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 no-print">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => finish(req.cancelId)} />
      <div role="alertdialog" aria-modal="true" className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
        <div className="flex items-start gap-4 p-6">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ring-1 ${
              danger ? 'bg-rose-50 text-rose-600 ring-rose-100' : 'bg-blue-50 text-blue-600 ring-blue-100'
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{req.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{req.message}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2.5 border-t border-slate-300 bg-slate-50/60 px-6 py-4">
          {req.buttons.map((b, i) => (
            <button
              key={b.id}
              type="button"
              autoFocus={i === req.buttons.length - 1}
              onClick={() => finish(b.id)}
              className={BUTTON_CLASS[b.kind]}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};
