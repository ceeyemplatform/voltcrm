import React from 'react';
import { LucideIcon } from 'lucide-react';

export type StatCardVariant =
  | 'default'
  | 'accent'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'purple'
  | 'blue';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: StatCardVariant;
  onClick?: () => void;
  /** Show a shimmering placeholder instead of the value */
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  onClick,
  loading = false,
}) => {
  const iconVariants: Record<StatCardVariant, string> = {
    default: 'bg-slate-50 text-slate-600 ring-slate-300/70',
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    info: 'bg-sky-50 text-sky-600 ring-sky-100',
    accent: 'bg-amber-50 text-amber-600 ring-amber-100',
    warning: 'bg-amber-50 text-amber-600 ring-amber-100',
    purple: 'bg-violet-50 text-violet-600 ring-violet-100',
    success: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    danger: 'bg-rose-50 text-rose-600 ring-rose-100',
  };

  return (
    <div
      onClick={onClick}
      className={`card group relative overflow-hidden p-5 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-card-hover' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="pt-1 text-sm font-medium text-slate-600">{title}</p>
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ring-1 ${iconVariants[variant]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-2">
        {loading ? (
          <div className="skeleton my-1 h-7 w-24" />
        ) : (
          <p className="truncate text-[28px] font-bold leading-9 tracking-tight text-slate-900">
            {value}
          </p>
        )}
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
};
