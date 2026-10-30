import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Printer,
  MapPin,
  RefreshCw,
  Briefcase,
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { WorkSite, Work, Labour } from '../types';
import { DataTable, Column } from '../components/common/DataTable';
import { WorkSiteModal } from '../components/work-site/WorkSiteModal';
import { WorkSiteDetailPage } from './WorkSiteDetailPage';
import { WorkPolevarModal } from '../components/work/WorkPolevarModal';
import { WorkPrintView } from '../components/work/WorkPrintView';
import { WorkModal } from '../components/work/WorkModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { PrintHeader } from '../components/common/PrintHeader';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { MultiLineCell } from '../components/common/Badges';
import { buildSectionList } from '../lib/sections';

interface WorkSitePageProps {
  initialSiteId?: string | null;
  onClearSiteId?: () => void;
}

export const WorkSitePage: React.FC<WorkSitePageProps> = ({
  initialSiteId,
  onClearSiteId,
}) => {
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<WorkSite | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkSite | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');

  // Site works details & child modals
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
    initialSiteId || null
  );

  useEffect(() => {
    if (initialSiteId !== undefined) {
      setSelectedSiteId(initialSiteId);
    }
  }, [initialSiteId]);
  const [polevarWork, setPolevarWork] = useState<Work | null>(null);
  const [printingWork, setPrintingWork] = useState<Work | null>(null);
  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);

  const loadSites = async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.workSites.list(search);
      setWorkSites(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load work sites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSites(searchTerm);
    api.labours.list().then(setLabours).catch(() => {});
  }, [searchTerm]);

  const handleSave = async (data: Partial<WorkSite>) => {
    if (editingSite) {
      await api.workSites.update(editingSite.id, data);
    } else {
      await api.workSites.create(data);
    }
    await loadSites(searchTerm);
  };

  const handleSaveWork = async (data: any) => {
    if (editingWork) {
      await api.works.update(editingWork.id, data);
    } else {
      await api.works.create(data);
    }
    await loadSites(searchTerm);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.workSites.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadSites(searchTerm);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete work site');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Stats
  const totalSites = workSites.length;
  const sitesWithWorks = workSites.filter((s) => (s._count?.works ?? 0) > 0).length;
  const totalJobs = workSites.reduce((acc, s) => acc + (s._count?.works ?? 0), 0);
  const totalQuotes = workSites.reduce((acc, s) => acc + (s._count?.quotations ?? 0), 0);

  // Filtered
  const filteredSites = sectionFilter
    ? workSites.filter((s) => s.section === sectionFilter)
    : workSites;

  // Sections used by sites, for the modal dropdown and the filter
  const usedSections = useMemo(
    () => Array.from(new Set(workSites.map((s) => s.section).filter(Boolean) as string[])),
    [workSites]
  );
  const uniqueSections = useMemo(() => buildSectionList(usedSections), [usedSections, isModalOpen]);

  const columns: Column<WorkSite>[] = [
    {
      key: 'name',
      header: 'WORK SITE NAME',
      sortable: true,
      render: (row) => (
        <div
          onClick={() => setSelectedSiteId(row.id)}
          className="cursor-pointer group"
        >
          <MultiLineCell
            title={
              <span className="group-hover:text-blue-600 transition-colors font-bold text-slate-900">
                {row.name}
              </span>
            }
            subtitle={
              row.section ? (
                <span className="text-xs text-blue-600 font-medium">Section: {row.section}</span>
              ) : undefined
            }
          />
        </div>
      ),
    },
    {
      key: 'address',
      header: 'LOCATION / ADDRESS',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-slate-700 block truncate max-w-sm">
          {row.address || '-'}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'SITE IN-CHARGE / CONTACT',
      render: (row) => (
        <span className="text-xs font-medium text-slate-700">
          {row.contact || '-'}
        </span>
      ),
    },
    {
      key: 'worksCount',
      header: 'ACTIVE WORKS',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedSiteId(row.id)}
          className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200/70 hover:bg-blue-100 transition cursor-pointer"
        >
          <Briefcase className="h-3.5 w-3.5" />
          <span>{row._count?.works ?? 0} jobs</span>
        </button>
      ),
    },
    {
      key: 'note',
      header: 'NOTES',
      render: (row) => (
        <span className="text-xs text-slate-500 block truncate max-w-xs italic">
          {row.note || '-'}
        </span>
      ),
    },
  ];

  if (selectedSiteId) {
    return (
      <div className="space-y-6">
        <WorkSiteDetailPage
          siteId={selectedSiteId}
          onBack={() => {
            setSelectedSiteId(null);
            if (onClearSiteId) onClearSiteId();
          }}
          onEditSite={(site) => {
            setEditingSite(site);
            setIsModalOpen(true);
          }}
          onCreateWorkForSite={() => {
            setEditingWork(null);
            setIsWorkModalOpen(true);
          }}
          onOpenWorkPolevar={(work) => setPolevarWork(work)}
          onPrintWork={(work) => setPrintingWork(work)}
          onEditWork={(work) => {
            setEditingWork(work);
            setIsWorkModalOpen(true);
          }}
        />

        <WorkSiteModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSite(null);
          }}
          onSave={handleSave}
          initialData={editingSite}
          existingSections={usedSections}
        />

        {isWorkModalOpen && (
          <WorkModal
            isOpen={isWorkModalOpen}
            onClose={() => {
              setIsWorkModalOpen(false);
              setEditingWork(null);
            }}
            onSave={handleSaveWork}
            initialData={
              editingWork
                ? { ...editingWork, workSiteId: selectedSiteId }
                : ({ workSiteId: selectedSiteId } as any)
            }
            laboursList={labours}
            workSitesList={workSites}
            existingWorkCodes={[]}
            onOpenPolevar={(workData) => setPolevarWork(workData)}
          />
        )}

        {polevarWork && (
          <WorkPolevarModal
            isOpen={Boolean(polevarWork)}
            work={polevarWork}
            onClose={() => setPolevarWork(null)}
            onUpdated={() => loadSites(searchTerm)}
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
      <PageHeader
        title="Work Sites & Client Locations"
        subtitle="Active installation, maintenance & substation sites"
        showFiltersButton={true}
        filtersOpen={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        secondaryActions={
          <button
            type="button"
            onClick={() => loadSites(searchTerm)}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
        primaryAction={{
          label: 'Register Work Site',
          onClick: () => {
            setEditingSite(null);
            setIsModalOpen(true);
          },
          icon: Plus,
        }}
      />

      {/* 4 PRIMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          loading={loading}
          title="Total Work Sites"
          value={totalSites}
          icon={MapPin}
          variant="blue"
        />
        <StatCard
          loading={loading}
          title="Active Projects"
          value={sitesWithWorks}
          icon={AlertCircle}
          variant="accent"
        />
        <StatCard
          loading={loading}
          title="Assigned Orders"
          value={totalJobs}
          icon={Clock}
          variant="purple"
        />
        <StatCard
          loading={loading}
          title="Proposals / Quotes"
          value={totalQuotes}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <div className="card p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 no-print">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Filter Section:</span>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="form-input !w-auto !py-1.5 text-xs"
            >
              <option value="">All Electrical Sections</option>
              {uniqueSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>

            {sectionFilter && (
              <button
                type="button"
                onClick={() => setSectionFilter('')}
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
          title="ACTIVE WORK SITES & PROJECT LOCATIONS"
          date={new Date().toISOString()}
          subtitle="Directory of client facilities, site engineers and safety protocol notes."
        />
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Data Table */}
      <DataTable<WorkSite>
        columns={columns}
        data={filteredSites}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search work site, location, section, or contact..."
        isLoading={loading}
        rowKey={(s) => s.id}
        onView={(item) => setSelectedSiteId(item.id)}
        onEdit={(item) => {
          setEditingSite(item);
          setIsModalOpen(true);
        }}
        onDelete={(item) => setDeleteTarget(item)}
        emptyMessage="No work sites registered yet."
      />

      {/* Modals */}
      <WorkSiteModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSite(null);
        }}
        onSave={handleSave}
        initialData={editingSite}
        existingSections={usedSections}
      />

      {isWorkModalOpen && (
        <WorkModal
          isOpen={isWorkModalOpen}
          onClose={() => {
            setIsWorkModalOpen(false);
            setEditingWork(null);
          }}
          onSave={handleSaveWork}
          initialData={editingWork}
          laboursList={labours}
          workSitesList={workSites}
          existingWorkCodes={[]}
          onOpenPolevar={(workData) => setPolevarWork(workData)}
        />
      )}

      {polevarWork && (
        <WorkPolevarModal
          isOpen={Boolean(polevarWork)}
          work={polevarWork}
          onClose={() => setPolevarWork(null)}
          onUpdated={() => loadSites(searchTerm)}
        />
      )}

      {printingWork && (
        <WorkPrintView
          work={printingWork}
          onClose={() => setPrintingWork(null)}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        title="Delete Work Site"
        message={`Are you sure you want to permanently delete site "${deleteTarget?.name}"? All associated historical data will be removed.`}
      />
    </div>
  );
};
