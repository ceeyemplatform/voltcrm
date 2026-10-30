import React, { useState, useEffect, useMemo } from 'react';
import { formatDate, todayISO } from '../lib/dates';
import {
  Plus,
  Printer,
  RefreshCw,
  Briefcase,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Calendar,
  X,
  Cloud,
  Calculator,
  ArrowUpDown,
} from 'lucide-react';
import { api } from '../lib/api';
import { Work, Labour, WorkSite } from '../types';
import { DataTable, Column } from '../components/common/DataTable';
import { WorkModal } from '../components/work/WorkModal';
import { WorkPrintView } from '../components/work/WorkPrintView';
import { WorkPolevarModal } from '../components/work/WorkPolevarModal';
import { DailyWorkDetailModal } from '../components/work/DailyWorkDetailModal';
import { CloudSyncModal } from '../components/common/CloudSyncModal';
import { WorkDetailPage } from './WorkDetailPage';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { PrintHeader } from '../components/common/PrintHeader';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge, MultiLineCell } from '../components/common/Badges';
import { StatusChangeModal } from '../components/work/StatusChangeModal';
import { getAllWorkStatuses } from '../lib/statusConfig';

interface WorkPageProps {
  /** Work shown in the detail view; driven by the #/work?workId= URL */
  selectedWorkId?: string | null;
  /** Daily log to open on arrival (from the expense tracker) */
  selectedLogId?: string | null;
  onSelectWork?: (workId: string | null) => void;
  onLogOpened?: () => void;
}

export const WorkPage: React.FC<WorkPageProps> = ({
  selectedWorkId = null,
  selectedLogId = null,
  onSelectWork,
  onLogOpened,
}) => {
  const [works, setWorks] = useState<Work[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [loading, setLoading] = useState(true);

  const setSelectedWorkId = (id: string | null) => onSelectWork?.(id);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'contract-desc' | 'logged-desc' | 'title-asc'>('date-desc');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [printingWork, setPrintingWork] = useState<Work | null>(null);
  const [polevarWork, setPolevarWork] = useState<Work | null>(null);
  const [selectedWorkForDailyModal, setSelectedWorkForDailyModal] = useState<Work | null>(null);
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Work | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusChangeTarget, setStatusChangeTarget] = useState<Work | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDependencies = async () => {
    try {
      const [l, s] = await Promise.all([
        api.labours.list(),
        api.workSites.list(),
      ]);
      setLabours(l);
      setWorkSites(s);
    } catch {
      // ignore
    }
  };

  const loadWorks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.works.list({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        workSiteId: siteFilter || undefined,
        startDate: startDateFilter || undefined,
        endDate: endDateFilter || undefined,
      });
      setWorks(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load works');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  useEffect(() => {
    loadWorks();
  }, [searchTerm, statusFilter, siteFilter, startDateFilter, endDateFilter]);

  // Compute sorting over loaded works
  const sortedWorks = useMemo(() => {
    const list = [...works];
    switch (sortBy) {
      case 'date-asc':
        return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'date-desc':
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      case 'contract-desc':
        return list.sort((a, b) => (Number(b.contractorAmount) || 0) - (Number(a.contractorAmount) || 0));
      case 'logged-desc':
        return list.sort((a, b) => {
          const aLogged = (a.dailyDetails || []).reduce((s, d) => s + (Number(d.totalDailyCost ?? d.totalDailyWage) || 0), 0);
          const bLogged = (b.dailyDetails || []).reduce((s, d) => s + (Number(d.totalDailyCost ?? d.totalDailyWage) || 0), 0);
          return bLogged - aLogged;
        });
      case 'title-asc':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list;
    }
  }, [works, sortBy]);

  const handleSave = async (data: any) => {
    if (editingWork) {
      await api.works.update(editingWork.id, data);
    } else {
      await api.works.create(data);
    }
    setDetailRefreshKey((prev) => prev + 1);
    await loadWorks();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.works.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadWorks();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete work order');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleQuickStatusUpdate = async (workId: string, newStatus: string) => {
    const computedEndDate =
      newStatus.toUpperCase().includes('COMPLET')
        ? todayISO()
        : undefined;
    await api.works.update(workId, {
      status: newStatus,
      ...(computedEndDate ? { endDate: computedEndDate } : {}),
    });
    await loadWorks();
    setDetailRefreshKey((prev) => prev + 1);
  };

  // Compute stats based on actual electrical work contracts
  const totalWorks = works.length;
  const inProgressCount = works.filter((w) => w.status === 'IN_PROGRESS').length;
  const pendingCount = works.filter((w) => w.status === 'PENDING').length;
  const completedCount = works.filter((w) => w.status === 'COMPLETED').length;

  // Compute total amounts across all filtered works
  const totalContractorAmount = sortedWorks.reduce(
    (sum, w) => sum + (Number(w.contractorAmount) || 0),
    0
  );

  const totalLoggedAmount = sortedWorks.reduce((sum, w) => {
    const dailyTotal = (w.dailyDetails || []).reduce(
      (dSum, d) => dSum + (Number(d.totalDailyCost ?? d.totalDailyWage) || 0),
      0
    );
    return sum + dailyTotal;
  }, 0);

  const columns: Column<Work>[] = [
    {
      key: 'workCode',
      header: 'WORK CODE',
      sortable: true,
      render: (row) => (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 whitespace-nowrap inline-block">
          {row.workCode}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'JOB TITLE & SITE',
      sortable: true,
      render: (row) => (
        <MultiLineCell
          title={row.name}
          subtitle={`Site: ${row.workSite?.name || 'Unassigned'} • ${row.typeOfWork || 'General'}`}
        />
      ),
    },
    {
      key: 'date',
      header: 'START / END DATE',
      sortable: true,
      render: (row) => (
        <MultiLineCell
          title={`Start: ${formatDate(row.date)}`}
          subtitle={
            row.endDate ? (
              <span className="text-emerald-600 font-medium">
                End: {formatDate(row.endDate)}
              </span>
            ) : row.status === 'COMPLETED' ? (
              <span className="text-emerald-600 font-medium">
                End: {formatDate(row.date)}
              </span>
            ) : (
              <span className="text-slate-400 italic">In progress</span>
            )
          }
        />
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={row.status}
          onClick={() => setStatusChangeTarget(row)}
        />
      ),
    },
    {
      key: 'amounts',
      header: 'AMOUNT (₹)',
      sortable: true,
      render: (row) => {
        const logged = (row.dailyDetails || []).reduce(
          (sum, d) => sum + (Number(d.totalDailyCost ?? d.totalDailyWage) || 0),
          0
        );
        return (
          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-300 inline-block">
            ₹{logged.toLocaleString()}
          </span>
        );
      },
    },
    {
      key: 'dailyLogs',
      header: 'DAILY LOGS',
      render: (row) => (
        <button
          type="button"
          onClick={() => {
            setSelectedWorkForDailyModal(row);
            setIsDailyModalOpen(true);
          }}
          className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition shadow-2xs cursor-pointer"
          title="Add / View Daily Work Details"
        >
          <Calendar className="h-3.5 w-3.5 text-emerald-600" />
          <span>{row.dailyDetails?.length || 0} Day(s) Logged</span>
        </button>
      ),
    },
  ];

  if (selectedWorkId) {
    return (
      <div className="space-y-6">
        <WorkDetailPage
          workId={selectedWorkId}
          openLogId={selectedLogId}
          onLogOpened={onLogOpened}
          refreshTrigger={detailRefreshKey}
          onBack={() => {
            setSelectedWorkId(null);
            loadWorks();
          }}
          onEditWork={(work) => {
            setEditingWork(work);
            setIsModalOpen(true);
          }}
          onOpenPolevar={(work) => setPolevarWork(work)}
          onPrintWork={(work) => setPrintingWork(work)}
        />

        {/* Modal for editing work order */}
        <WorkModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingWork(null);
          }}
          onSave={handleSave}
          initialData={editingWork}
          laboursList={labours}
          workSitesList={workSites}
          existingWorkCodes={works.map((w) => w.workCode)}
          existingWorkTypes={works.map((w) => w.typeOfWork || '')}
          onOpenPolevar={(workData) => setPolevarWork(workData)}
        />

        {polevarWork && (
          <WorkPolevarModal
            isOpen={Boolean(polevarWork)}
            work={polevarWork}
            onClose={() => setPolevarWork(null)}
            onUpdated={async () => {
              await loadWorks();
              setDetailRefreshKey((prev) => prev + 1);
            }}
          />
        )}

        {printingWork && (
          <WorkPrintView
            work={printingWork}
            onClose={() => setPrintingWork(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Work Orders"
        subtitle="Log electrical contracts, multi-row labour wages & Polevar material reports"
        showFiltersButton={true}
        filtersOpen={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        secondaryActions={
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsCloudSyncOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-emerald-200/90 bg-emerald-50/70 hover:bg-emerald-100 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs transition cursor-pointer"
              title="Sync with Google Sheets Cloud"
            >
              <Cloud className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Sync Cloud</span>
            </button>

            <button
              type="button"
              onClick={loadWorks}
              disabled={loading}
              className="btn-secondary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
        primaryAction={{
          label: 'New Work Entry',
          onClick: () => {
            setEditingWork(null);
            setIsModalOpen(true);
          },
          icon: Plus,
        }}
      />

      {/* 4 PRIMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          loading={loading}
          title="Total Work Orders"
          value={totalWorks}
          icon={Briefcase}
          variant="blue"
        />
        <StatCard
          loading={loading}
          title="In Progress"
          value={inProgressCount}
          icon={Clock}
          variant="accent"
        />
        <StatCard
          loading={loading}
          title="Pending Execution"
          value={pendingCount}
          icon={AlertCircle}
          variant="purple"
        />
        <StatCard
          loading={loading}
          title="Completed Works"
          value={completedCount}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {/* Collapsible Filters Toolbar */}
      {showFilters && (
        <div className="card p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 no-print">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Filters:</span>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input !w-auto !py-1.5 text-xs"
            >
              <option value="">All Statuses / Stages</option>
              <optgroup label="Standard Stages">
                {getAllWorkStatuses(works.map((w) => w.status))
                  .filter((s) => !s.isCustom)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
              </optgroup>
              {getAllWorkStatuses(works.map((w) => w.status)).some((s) => s.isCustom) && (
                <optgroup label="Custom Stages">
                  {getAllWorkStatuses(works.map((w) => w.status))
                    .filter((s) => s.isCustom)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>

            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="form-input !w-auto !py-1.5 text-xs max-w-xs"
            >
              <option value="">All Work Sites</option>
              {workSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>

            {/* Date Range Filter */}
            <div className="flex items-center space-x-1.5 text-xs bg-slate-50/70 border border-slate-300 rounded-xl px-2.5 py-1">
              <span className="text-[11px] font-semibold text-slate-500">From:</span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="bg-transparent text-slate-800 text-xs focus:outline-none"
              />
              <span className="text-slate-300">|</span>
              <span className="text-[11px] font-semibold text-slate-500">To:</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="bg-transparent text-slate-800 text-xs focus:outline-none"
              />
            </div>

            {/* Sorting Filter */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="font-semibold text-slate-500">Sort:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="form-input !w-auto !py-1.5 text-xs"
              >
                <option value="date-desc">Date (Newest First)</option>
                <option value="date-asc">Date (Oldest First)</option>
                <option value="contract-desc">Contract Amount (High to Low)</option>
                <option value="logged-desc">Logged Execution (High to Low)</option>
                <option value="title-asc">Job Title (A-Z)</option>
              </select>
            </div>

            {(statusFilter || siteFilter || startDateFilter || endDateFilter) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('');
                  setSiteFilter('');
                  setStartDateFilter('');
                  setEndDateFilter('');
                }}
                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                Clear Filters
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
          title="ELECTRICAL WORK ORDERS MASTER REGISTER"
          date={new Date().toISOString()}
          subtitle="Consolidated registry of electrical work orders, values, and execution stages."
        />
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Data Table */}
      <DataTable<Work>
        columns={columns}
        data={sortedWorks}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search work by code, title, order no, GST bill no..."
        isLoading={loading}
        rowKey={(w) => w.id}
        onView={(item) => setSelectedWorkId(item.id)}
        onReportRow={(item) => setPolevarWork(item)}
        onPrintRow={(item) => setPrintingWork(item)}
        onEdit={(item) => {
          setEditingWork(item);
          setIsModalOpen(true);
        }}
        onDelete={(item) => setDeleteTarget(item)}
        emptyMessage="No electrical work orders found."
      />

      {/* Bottom Total Summary Bar: Calculated over all filtered works across all pages */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Filtered Works Total
              </h4>
              <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                {sortedWorks.length} Work{sortedWorks.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Cumulative total calculated across all pages
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Amount
            </span>
            <span className="font-mono text-xl sm:text-2xl font-bold text-emerald-400">
              ₹{totalLoggedAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Modals */}
      <WorkModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingWork(null);
        }}
        onSave={handleSave}
        initialData={editingWork}
        laboursList={labours}
        workSitesList={workSites}
        existingWorkCodes={works.map((w) => w.workCode)}
        existingWorkTypes={works.map((w) => w.typeOfWork || '')}
        onOpenPolevar={(workData) => setPolevarWork(workData)}
      />

      {polevarWork && (
        <WorkPolevarModal
          isOpen={Boolean(polevarWork)}
          work={polevarWork}
          onClose={() => setPolevarWork(null)}
          onUpdated={loadWorks}
        />
      )}

      {printingWork && (
        <WorkPrintView
          work={printingWork}
          onClose={() => setPrintingWork(null)}
        />
      )}

      {isDailyModalOpen && selectedWorkForDailyModal && (
        <DailyWorkDetailModal
          isOpen={isDailyModalOpen}
          onClose={() => {
            setIsDailyModalOpen(false);
            setSelectedWorkForDailyModal(null);
          }}
          work={selectedWorkForDailyModal}
          onSaved={loadWorks}
          onOpenPolevar={(w) => {
            setIsDailyModalOpen(false);
            setPolevarWork(w);
          }}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        title="Delete Work Order"
        message={`Are you sure you want to permanently delete "${deleteTarget?.workCode} - ${deleteTarget?.name}"? All assigned labour wages and Polevar logs will be removed.`}
      />

      {statusChangeTarget && (
        <StatusChangeModal
          isOpen={Boolean(statusChangeTarget)}
          onClose={() => setStatusChangeTarget(null)}
          work={statusChangeTarget}
          onSaveStatus={handleQuickStatusUpdate}
        />
      )}

      {isCloudSyncOpen && (
        <CloudSyncModal
          isOpen={isCloudSyncOpen}
          onClose={() => setIsCloudSyncOpen(false)}
          onSyncCompleted={loadWorks}
        />
      )}
    </div>
  );
};
