import React from 'react';
import { Filter, Plus, LucideIcon } from 'lucide-react';

interface PrimaryAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showFiltersButton?: boolean;
  filtersOpen?: boolean;
  onToggleFilters?: () => void;
  primaryAction?: PrimaryAction;
  secondaryActions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  showFiltersButton = false,
  filtersOpen = false,
  onToggleFilters,
  primaryAction,
  secondaryActions,
}) => {
  const PrimaryIcon = primaryAction?.icon || Plus;

  return (
    <div className="flex flex-col justify-between gap-4 pb-1 sm:flex-row sm:items-end no-print">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px] sm:leading-9">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[15px] text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
        {secondaryActions}

        {showFiltersButton && (
          <button
            type="button"
            onClick={onToggleFilters}
            className={`btn-secondary ${
              filtersOpen ? '!border-blue-300 !bg-blue-50 !text-blue-700' : ''
            }`}
          >
            <Filter className={`h-4 w-4 ${filtersOpen ? 'text-blue-600' : 'text-slate-500'}`} />
            <span>Filters</span>
          </button>
        )}

        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="btn-primary"
          >
            <PrimaryIcon className="h-4 w-4 stroke-[2.5]" />
            <span>{primaryAction.label}</span>
          </button>
        )}
      </div>
    </div>
  );
};

