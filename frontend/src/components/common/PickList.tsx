import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { confirmDelete } from './ConfirmHost';

export interface PickOption {
  id: string;
  label: string;
  isCustom?: boolean;
}

interface PickListProps {
  value: string;
  options: PickOption[];
  onChange: (id: string) => void;
  /** Saves a new option and returns the id to select */
  onAdd: (name: string) => string;
  /** Removes a custom option (the user has already confirmed) */
  onDelete?: (id: string) => void;
  /** Label for the empty value; omit to leave no empty choice */
  emptyLabel?: string;
  /** Trigger text when nothing is selected */
  placeholder?: string;
  addLabel?: string;
  addPlaceholder?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Dropdown list where custom options sit right after the defaults, each with its own
 * delete button, and a "+ Add" row at the end. Rendered in a portal so popups can't clip it.
 */
export const PickList: React.FC<PickListProps> = ({
  value,
  options,
  onChange,
  onAdd,
  onDelete,
  emptyLabel,
  placeholder = 'Select…',
  addLabel = '+ Add new…',
  addPlaceholder = 'New option',
  size = 'md',
  className = '',
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: -9999, left: -9999, width: 0 });
  // A delete confirmation is open; outside clicks then belong to the dialog
  const confirming = useRef(false);

  const selected = options.find((o) => o.id === value);
  const close = () => {
    setOpen(false);
    setAdding(false);
    setDraft('');
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const h = listRef.current?.offsetHeight || 240;
    const width = Math.max(r.width, 200);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const below = r.bottom + 4;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : below;
    setPos({ top, left, width });
  }, [open, adding, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (confirming.current) return;
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !triggerRef.current?.contains(t)) close();
    };
    // Captured first so Escape closes only this list, not the popup behind it
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming.current) {
        e.stopPropagation();
        close();
      }
    };
    const onScroll = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node) && !confirming.current) close();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    close();
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    const existing = options.find(
      (o) => o.id.toLowerCase() === trimmed.toLowerCase() || o.label.toLowerCase() === trimmed.toLowerCase()
    );
    pick(existing ? existing.id : onAdd(trimmed));
  };

  const remove = async (opt: PickOption) => {
    confirming.current = true;
    const ok = await confirmDelete(`Remove "${opt.label}" from the list? Records that already use it keep their value.`, {
      title: 'Remove option',
      confirmText: 'Remove',
    });
    confirming.current = false;
    if (ok) onDelete?.(opt.id);
  };

  const sm = size === 'sm';
  const row = `flex w-full items-center gap-2 rounded-md text-left transition ${sm ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-sm'}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className={
          sm
            ? `inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700 hover:border-slate-400 ${className}`
            : `form-input flex items-center justify-between gap-2 text-left ${className}`
        }
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate ${selected || value ? '' : 'text-slate-400'}`}>
          {selected?.label || value || placeholder}
        </span>
        <ChevronDown className={`flex-shrink-0 text-slate-400 ${sm ? 'h-3 w-3' : 'h-4 w-4'}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[10001] max-h-72 overflow-y-auto rounded-lg border border-slate-300 bg-white p-1 shadow-lg"
          >
            {emptyLabel !== undefined && (
              <button type="button" onClick={() => pick('')} className={`${row} text-slate-500 hover:bg-slate-100`}>
                <span className="flex-1 truncate">{emptyLabel}</span>
                {!value && <Check className="h-3.5 w-3.5 text-blue-600" />}
              </button>
            )}
            {options.map((o) => {
              const active = o.id === value;
              return (
                <div
                  key={o.id}
                  className={`group flex items-center rounded-md ${active ? 'bg-blue-50' : 'hover:bg-slate-100'}`}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(o.id)}
                    className={`${row} flex-1 ${active ? 'font-medium text-blue-700' : 'text-slate-700'}`}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {active && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </button>
                  {o.isCustom && onDelete && (
                    <button
                      type="button"
                      onClick={() => remove(o)}
                      title={`Remove "${o.label}"`}
                      className="mr-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            <div className="mt-1 border-t border-slate-200 pt-1">
              {adding ? (
                <div className="flex items-center gap-1 p-1">
                  <input
                    type="text"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commit();
                      }
                    }}
                    placeholder={addPlaceholder}
                    className="form-input !py-1 text-xs"
                  />
                  <button type="button" onClick={commit} title="Add" className="btn-primary !px-2 !py-1">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className={`${row} font-medium text-blue-600 hover:bg-blue-50`}>
                  <Plus className="h-3.5 w-3.5" />
                  {addLabel.replace(/^\+\s*/, '')}
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
