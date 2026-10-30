import React, { useState, useEffect } from 'react';
import { formatDate } from '../lib/dates';
import {
  Plus,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
  PenLine,
} from 'lucide-react';
import { api } from '../lib/api';
import { Quotation, WorkSite } from '../types';
import { DataTable, Column } from '../components/common/DataTable';
import { QuotationModal } from '../components/quotation/QuotationModal';
import { QuotationPrintView } from '../components/quotation/QuotationPrintView';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { PrintHeader } from '../components/common/PrintHeader';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { MultiLineCell } from '../components/common/Badges';

export const QuotationPage: React.FC = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [siteFilter, setSiteFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKind, setNewKind] = useState<'ITEMS' | 'WRITTEN'>('ITEMS');
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [printingQuotation, setPrintingQuotation] = useState<Quotation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDependencies = async () => {
    try {
      const sites = await api.workSites.list();
      setWorkSites(sites);
    } catch {
      // ignore
    }
  };

  const loadQuotations = async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.quotations.list(search);
      setQuotations(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  useEffect(() => {
    loadQuotations(searchTerm);
  }, [searchTerm]);

  const handleSave = async (data: any) => {
    if (editingQuotation) {
      await api.quotations.update(editingQuotation.id, data);
    } else {
      await api.quotations.create(data);
    }
    await loadQuotations(searchTerm);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.quotations.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadQuotations(searchTerm);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete quotation');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Stats
  const totalQuotes = quotations.length;
  const totalPipeline = quotations.reduce(
    (acc, q) => acc + Number(q.total || 0),
    0
  );
  const totalItems = quotations.reduce(
    (acc, q) => acc + (q.items?.length || 0),
    0
  );
  const avgQuote = totalQuotes > 0 ? Math.round(totalPipeline / totalQuotes) : 0;

  // Filter
  const isWritten = (q: Quotation) => q.kind === 'WRITTEN';
  const pageCount = (q: Quotation) => (Array.isArray(q.pages) ? q.pages.length : 0);

  const filteredQuotations = siteFilter
    ? quotations.filter((q) => q.workSiteId === siteFilter)
    : quotations;

  const columns: Column<Quotation>[] = [
    {
      key: 'quotationNo',
      header: 'QUOTE NO',
      sortable: true,
      render: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">
            {row.quotationNo}
          </span>
          {isWritten(row) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
              <PenLine className="h-3 w-3" />
              Written
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'clientName',
      header: 'CLIENT / PROJECT',
      sortable: true,
      render: (row) => (
        <MultiLineCell
          title={row.clientName}
          subtitle={row.address || (row.workSite ? 'Work site' : 'Company')}
        />
      ),
    },
    {
      key: 'date',
      header: 'DATE',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-medium text-slate-600">
          {formatDate(row.date)}
        </span>
      ),
    },
    {
      key: 'itemsCount',
      header: 'LINE ITEMS',
      render: (row) => (
        <span className="text-xs font-medium text-slate-600">
          {isWritten(row) ? '—' : `${row.items?.length || 0} items`}
          {pageCount(row) > 0 && (
            <span className="block text-[11px] text-slate-400">
              {pageCount(row)} page{pageCount(row) === 1 ? '' : 's'}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'subtotal',
      header: 'SUBTOTAL',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-slate-600 text-xs font-medium">
          {isWritten(row) ? '—' : `₹${Number(row.subtotal || 0).toLocaleString()}`}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'TOTAL (INCL. GST)',
      sortable: true,
      render: (row) =>
        isWritten(row) ? (
          <span className="text-xs text-slate-400">Written</span>
        ) : (
          <MultiLineCell
            title={`₹${Number(row.total || 0).toLocaleString()}`}
            subtitle={`Includes ${row.gstPercent}% GST`}
          />
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation Generator"
        subtitle="Generate commercial estimates with automatic GST calculations"
        showFiltersButton={true}
        filtersOpen={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        secondaryActions={
          <>
          <button
            type="button"
            onClick={() => {
              setEditingQuotation(null);
              setNewKind('WRITTEN');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <PenLine className="h-3.5 w-3.5 text-indigo-600" />
            <span>Write Quotation</span>
          </button>
          <button
            type="button"
            onClick={() => loadQuotations(searchTerm)}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          </>
        }
        primaryAction={{
          label: 'New Quotation',
          onClick: () => {
            setEditingQuotation(null);
            setNewKind('ITEMS');
            setIsModalOpen(true);
          },
          icon: Plus,
        }}
      />

      {/* 4 PRIMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          loading={loading}
          title="Total Quotations"
          value={totalQuotes}
          icon={FileSpreadsheet}
          variant="blue"
        />
        <StatCard
          loading={loading}
          title="Pipeline Value"
          value={`₹${totalPipeline.toLocaleString()}`}
          icon={AlertCircle}
          variant="accent"
        />
        <StatCard
          loading={loading}
          title="Line Items Active"
          value={totalItems}
          icon={Clock}
          variant="purple"
        />
        <StatCard
          loading={loading}
          title="Average Quote"
          value={`₹${avgQuote.toLocaleString()}`}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <div className="card p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 no-print">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Filter Work Site:</span>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="form-input !w-auto !py-1.5 text-xs"
            >
              <option value="">All Work Sites</option>
              {workSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {siteFilter && (
              <button
                type="button"
                onClick={() => setSiteFilter('')}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(false)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Print Only Header */}
      <div className="print-only">
        <PrintHeader
          title="ELECTRICAL ESTIMATES & COMMERCIAL QUOTATIONS"
          date={new Date().toISOString()}
          subtitle="Official price schedule including labour, material components, and GST."
        />
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Data Table */}
      <DataTable<Quotation>
        columns={columns}
        data={filteredQuotations}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search quotation by client name, quote number..."
        isLoading={loading}
        rowKey={(q) => q.id}
        onView={(item) => setPrintingQuotation(item)}
        onPrintRow={(item) => setPrintingQuotation(item)}
        onEdit={(item) => {
          setEditingQuotation(item);
          setIsModalOpen(true);
        }}
        onDelete={(item) => setDeleteTarget(item)}
        emptyMessage="No quotations generated yet."
      />

      {/* Modals */}
      <QuotationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingQuotation(null);
        }}
        onSave={handleSave}
        initialData={editingQuotation}
        workSitesList={workSites}
        kind={newKind}
      />

      {printingQuotation && (
        <QuotationPrintView
          quotation={printingQuotation}
          onClose={() => setPrintingQuotation(null)}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        title="Delete Quotation"
        message={`Are you sure you want to permanently delete quotation "${deleteTarget?.quotationNo} - ${deleteTarget?.clientName}"?`}
      />
    </div>
  );
};
