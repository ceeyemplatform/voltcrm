import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'muted';
  active?: boolean;
}

interface ActionMenuProps {
  /** Position of the element the menu opens under, captured on click
   *  (the element itself may re-render away before the menu measures it) */
  anchorRect: DOMRect;
  title?: string;
  items: ActionMenuItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Extra content under the items, e.g. an "add new" input */
  footer?: React.ReactNode;
}

const TONES: Record<NonNullable<ActionMenuItem['tone']>, string> = {
  default: 'text-slate-700',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-rose-700',
  muted: 'text-slate-500',
};

/** Small dropdown rendered in a portal so table scroll containers can't clip it. */
export const ActionMenu: React.FC<ActionMenuProps> = ({ anchorRect, title, items, onSelect, onClose, footer }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    const r = anchorRect;
    const menu = ref.current;
    const w = menu?.offsetWidth || 200;
    const h = menu?.offsetHeight || 160;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    const below = r.bottom + 6;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below;
    setPos({ top, left });
  }, [anchorRect]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onScroll = () => onClose();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-[10000] min-w-[190px] max-w-[260px] rounded-xl border border-slate-300 bg-white p-1.5 shadow-lg"
      role="menu"
    >
      {title && <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium text-slate-400">{title}</p>}
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            onClick={() => {
              onSelect(item.id);
              onClose();
            }}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-slate-100 ${
              TONES[item.tone || 'default']
            }`}
          >
            {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
            <span className="flex-1 truncate">{item.label}</span>
            {item.active && <Check className="h-4 w-4 flex-shrink-0 text-blue-600" />}
          </button>
        );
      })}
      {footer}
    </div>,
    document.body
  );
};
