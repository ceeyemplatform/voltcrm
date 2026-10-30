import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Printer,
  Edit2,
  Trash2,
  Eye,
  FileSpreadsheet,
  Inbox,
} from 'lucide-react';
import { TableRowsSkeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  onSearchChange?: (term: string) => void;
  searchValue?: string;
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onPrintRow?: (item: T) => void;
  onReportRow?: (item: T) => void;
  /** Tooltip for the spreadsheet (report) action */
  reportRowTitle?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  rowKey: (item: T) => string;
  hideSearch?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchPlaceholder = 'Search records...',
  onSearchChange,
  searchValue,
  onView,
  onEdit,
  onDelete,
  onPrintRow,
  onReportRow,
  reportRowTitle = 'Open Polevar Matrix Report',
  isLoading = false,
  emptyMessage = 'No records found.',
  rowKey,
  hideSearch = false,
}: DataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const term = searchValue !== undefined ? searchValue : internalSearch;

  const handleSearch = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setInternalSearch(val);
    }
    setCurrentPage(1);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Client-side filtering if onSearchChange is not handling server-side
  const filteredData = useMemo(() => {
    if (onSearchChange || !term) return data;
    const lower = term.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((val) =>
        String(val ?? '').toLowerCase().includes(lower)
      )
    );
  }, [data, term, onSearchChange]);

  // Client-side sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination calculations
  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const currentData = sortedData.slice(startIndex, startIndex + pageSize);

  const hasActions = Boolean(onView || onEdit || onDelete || onPrintRow || onReportRow);

  return (
    <div className="card flex flex-col overflow-hidden">
      {/* Top Search & Controls Bar */}
      {!hideSearch && (
        <div className="flex flex-col items-center justify-between gap-3 border-b border-slate-300 bg-white px-4 py-3 sm:flex-row sm:px-5 no-print">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={term}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="form-input !pl-9"
            />
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-end">
            <span className="font-medium text-slate-500">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-300 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-12 px-6 py-3 font-semibold text-slate-400">#</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap px-6 py-3 ${col.className || ''} ${
                    col.sortable ? 'cursor-pointer select-none hover:text-slate-800' : ''
                  }`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-slate-400">
                        {sortKey === col.key ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {hasActions && (
                <th className="w-32 px-6 py-3 text-right no-print">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            {isLoading ? (
              <TableRowsSkeleton columns={columns.length + (hasActions ? 2 : 1)} />
            ) : currentData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (hasActions ? 2 : 1)}
                  className="py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Inbox className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium text-slate-600">{emptyMessage}</p>
                    {term && (
                      <p className="text-xs text-slate-400">Try a different search term.</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              currentData.map((row, idx) => (
                <tr
                  key={rowKey(row)}
                  className="transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-6 py-3.5 font-mono text-xs text-slate-400">
                    {startIndex + idx + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-6 py-3.5 align-middle ${col.className || ''}`}
                    >
                      {col.render ? col.render(row, startIndex + idx) : row[col.key]}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="whitespace-nowrap px-6 py-3.5 text-right align-middle no-print">
                      <div className="flex items-center justify-end gap-0.5">
                        {onView && (
                          <button
                            type="button"
                            onClick={() => onView(row)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {onReportRow && (
                          <button
                            type="button"
                            onClick={() => onReportRow(row)}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title={reportRowTitle}
                          >
                            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                          </button>
                        )}
                        {onPrintRow && (
                          <button
                            type="button"
                            onClick={() => onPrintRow(row)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Print / View Report"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(row)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer matching screenshot */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:px-5 no-print">
        <span className="text-[13px] text-slate-500">
          Showing <span className="font-semibold text-slate-800">{totalItems === 0 ? 0 : startIndex + 1}</span> to{' '}
          <span className="font-semibold text-slate-800">{Math.min(startIndex + pageSize, totalItems)}</span> of{' '}
          <span className="font-semibold text-slate-800">{totalItems}</span> results
        </span>

        <div className="flex items-center space-x-2">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="select-none px-1 text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
