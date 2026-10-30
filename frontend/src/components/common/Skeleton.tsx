import React from 'react';

/** Shimmering placeholder block. Size it with className (h-*, w-*, rounded-*). */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton ${className}`} aria-hidden="true" />
);

/** Placeholder matching StatCard's layout. */
export const StatCardSkeleton: React.FC = () => (
  <div className="card p-5">
    <div className="flex items-start justify-between">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-10 rounded-lg" />
    </div>
    <Skeleton className="mt-4 h-8 w-20" />
  </div>
);

export const StatGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
    {Array.from({ length: count }).map((_, i) => (
      <StatCardSkeleton key={i} />
    ))}
  </div>
);

/** Table body rows for DataTable and hand-built tables. */
export const TableRowsSkeleton: React.FC<{ rows?: number; columns: number }> = ({
  rows = 6,
  columns,
}) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r}>
        {Array.from({ length: columns }).map((_, c) => (
          <td key={c} className="px-6 py-4">
            {c === 1 ? (
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            ) : (
              <Skeleton className={`h-3.5 ${c === 0 ? 'w-5' : c % 3 === 0 ? 'w-16' : 'w-24'}`} />
            )}
          </td>
        ))}
      </tr>
    ))}
  </>
);

/** Generic card with a title and a few lines, for panels and detail sections. */
export const CardSkeleton: React.FC<{ lines?: number; className?: string }> = ({
  lines = 4,
  className = '',
}) => (
  <div className={`card p-5 ${className}`}>
    <Skeleton className="h-4 w-40" />
    <div className="mt-5 space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i % 2 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  </div>
);

/** Full detail-page placeholder: header, stat row and two content columns. */
export const DetailPageSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Skeleton className="h-9 w-9 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-3.5 w-40" />
      </div>
    </div>
    <StatGridSkeleton />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <CardSkeleton lines={6} className="lg:col-span-2" />
      <CardSkeleton lines={5} />
    </div>
  </div>
);
