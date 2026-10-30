import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Printer,
  Users,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { Labour, Work } from '../types';
import { memberStatus } from '../lib/payments';
import { DataTable, Column } from '../components/common/DataTable';
import { LabourModal } from '../components/labour/LabourModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { PrintHeader } from '../components/common/PrintHeader';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { MultiLineCell } from '../components/common/Badges';

export const LabourPage: React.FC = () => {
  const [labours, setLabours] = useState<Labour[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLabour, setEditingLabour] = useState<Labour | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Labour | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [works, setWorks] = useState<Work[]>([]);

  const loadLabours = async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.labours.list(search);
      setLabours(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load labour list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabours(searchTerm);
  }, [searchTerm]);

  // Daily logs across all works, for each worker's pending wages
  useEffect(() => {
    api.works.list().then(setWorks).catch(() => {});
  }, []);

  const pendingByLabour = useMemo(() => {
    const map = new Map<string, { amount: number; days: number }>();
    for (const w of works) {
      for (const d of Array.isArray(w.dailyDetails) ? w.dailyDetails : []) {
        for (const m of d.labourMembers || []) {
          if (!m.labourId || memberStatus(d, m) !== 'pending') continue;
          const cur = map.get(m.labourId) || { amount: 0, days: 0 };
          map.set(m.labourId, { amount: cur.amount + Number(m.wage || 0), days: cur.days + 1 });
        }
      }
    }
    return map;
  }, [works]);
  const totalPendingWages = Array.from(pendingByLabour.values()).reduce((s, v) => s + v.amount, 0);

  const handleSave = async (data: Partial<Labour>) => {
    if (editingLabour) {
      await api.labours.update(editingLabour.id, data);
    } else {
      await api.labours.create(data);
    }
    await loadLabours(searchTerm);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.labours.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadLabours(searchTerm);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete labour record');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Stats
  const totalLabours = labours.length;
  const electricians = labours.filter((l) =>
    (l.category || '').toLowerCase().includes('electrician')
  ).length;
  const helpers = labours.filter(
    (l) =>
      (l.category || '').toLowerCase().includes('helper') ||
      (l.category || '').toLowerCase().includes('wireman')
  ).length;
  const avgWage =
    totalLabours > 0
      ? Math.round(
          labours.reduce((acc, l) => acc + Number(l.dailyWage || 0), 0) /
            totalLabours
        )
      : 0;

  // Filtered
  const filteredLabours = categoryFilter
    ? labours.filter((l) => l.category === categoryFilter)
    : labours;

  const uniqueCategories = Array.from(
    new Set(labours.map((l) => l.category).filter(Boolean))
  );

  const columns: Column<Labour>[] = [
    {
      key: 'name',
      header: 'WORKER NAME',
      sortable: true,
      render: (row) => (
        <MultiLineCell
          title={row.name}
          subtitle={row.address || 'Address not logged'}
        />
      ),
    },
    {
      key: 'category',
      header: 'CATEGORY / TRADE',
      sortable: true,
      render: (row) => (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200/70">
          {row.category || 'General'}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'CONTACT NO',
      render: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {row.contact || '-'}
        </span>
      ),
    },
    {
      key: 'dailyWage',
      header: 'DAILY WAGE',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 text-sm">
          ₹{Number(row.dailyWage || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'hourlyRate',
      header: 'HOURLY RATE',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-slate-600 text-xs">
          ₹{Number(row.hourlyRate || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'pendingWages',
      header: 'PENDING WAGES',
      render: (row) => {
        const p = pendingByLabour.get(row.id);
        return p && p.amount > 0 ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            <Clock className="h-3 w-3" />₹{p.amount.toLocaleString()} · {p.days} day{p.days === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Labour Workforce Directory"
        subtitle="Electricians, wiremen, helpers & wage schedules"
        showFiltersButton={true}
        filtersOpen={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        secondaryActions={
          <button
            type="button"
            onClick={() => loadLabours(searchTerm)}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
        primaryAction={{
          label: 'Add Labour Worker',
          onClick: () => {
            setEditingLabour(null);
            setIsModalOpen(true);
          },
          icon: Plus,
        }}
      />

      {/* 4 PRIMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          loading={loading}
          title="Total Workforce"
          value={totalLabours}
          icon={Users}
          variant="blue"
        />
        <StatCard
          loading={loading}
          title="Electricians"
          value={electricians}
          icon={AlertCircle}
          variant="accent"
        />
        <StatCard
          loading={loading}
          title="Helpers & Wiremen"
          value={helpers}
          icon={Clock}
          variant="purple"
        />
        <StatCard
          loading={loading}
          title="Pending Wages"
          value={`₹${totalPendingWages.toLocaleString()}`}
          subtitle={`Average wage ₹${avgWage.toLocaleString()}`}
          icon={CheckCircle2}
          variant="warning"
        />
      </div>

      {/* Collapsible Filter Toolbar */}
      {showFilters && (
        <div className="card p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 no-print">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Filter Trade:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-input !w-auto !py-1.5 text-xs"
            >
              <option value="">All Trades</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {categoryFilter && (
              <button
                type="button"
                onClick={() => setCategoryFilter('')}
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
          title="REGISTERED WORKFORCE & WAGE SCHEDULES"
          date={new Date().toISOString()}
          subtitle="Directory of technicians, helpers, emergency contacts and agreed daily rates."
        />
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Data Table */}
      <DataTable<Labour>
        columns={columns}
        data={filteredLabours}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search labour by name, address, contact or trade..."
        isLoading={loading}
        rowKey={(l) => l.id}
        onEdit={(item) => {
          setEditingLabour(item);
          setIsModalOpen(true);
        }}
        onDelete={(item) => setDeleteTarget(item)}
        emptyMessage="No workers registered yet."
      />

      {/* Modals */}
      <LabourModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLabour(null);
        }}
        onSave={handleSave}
        initialData={editingLabour}
        existingCategories={labours.map((l) => l.category || '')}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        title="Delete Worker Record"
        message={`Are you sure you want to permanently remove worker "${deleteTarget?.name}"? Past recorded works will retain payment references.`}
      />
    </div>
  );
};
