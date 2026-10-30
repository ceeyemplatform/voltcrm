import React, { useState, useEffect, useMemo } from 'react';
import { formatDate } from '../lib/dates';
import {
  RefreshCw,
  AlertCircle,
  MapPin,
  CalendarClock,
  FileSpreadsheet,
  X,
  Layers,
} from 'lucide-react';
import { api } from '../lib/api';
import { PolevarSheetSummary, Work, WorkSite } from '../types';
import { DataTable, Column } from '../components/common/DataTable';
import { PrintHeader } from '../components/common/PrintHeader';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { MultiLineCell, StatusBadge } from '../components/common/Badges';
import { WorkPolevarModal } from '../components/work/WorkPolevarModal';
import { buildSectionList } from '../lib/sections';
import { buildFileName, fileDate } from '../lib/print';

export const PolevarPage: React.FC = () => {
  const [sheets, setSheets] = useState<PolevarSheetSummary[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [workSiteFilter, setWorkSiteFilter] = useState('');

  // Sheet opened in the Polevar matrix editor
  const [openSheet, setOpenSheet] = useState<PolevarSheetSummary | null>(null);
  const [printOnOpen, setPrintOnOpen] = useState(false);

  // Spreadsheet icon: download that work's Polevar sheet as Excel without opening it
  const downloadExcel = async (row: PolevarSheetSummary) => {
    setError(null);
    try {
      const data = await api.works.getPolevar(row.workId);
      const { downloadPolevarXlsx } = await import('../lib/polevarExcel');
      await downloadPolevarXlsx(
        {
          id: row.workId,
          workCode: row.workCode,
          name: row.workName,
          workSite: row.workSiteName ? { name: row.workSiteName } : undefined,
        } as Work,
        data,
        buildFileName('Polevar', row.workCode, row.workName, fileDate())
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to download the Excel file');
    }
  };

  const loadSheets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.polevar.getSheets({
        search: searchTerm || undefined,
        section: sectionFilter || undefined,
        workSiteId: workSiteFilter || undefined,
      });
      setSheets(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Polevar reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.workSites.list().then(setWorkSites).catch(() => {});
  }, []);

  useEffect(() => {
    loadSheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, sectionFilter, workSiteFilter]);

  const sectionOptions = useMemo(
    () => buildSectionList(workSites.map((s) => s.section), sheets.map((s) => s.section)),
    [workSites, sheets]
  );

  const sitesInSection = useMemo(
    () => (sectionFilter ? workSites.filter((s) => s.section === sectionFilter) : workSites),
    [workSites, sectionFilter]
  );

  const stats = useMemo(() => {
    const now = new Date();
    return {
      sections: new Set(sheets.map((s) => s.section).filter(Boolean)).size,
      sites: new Set(sheets.map((s) => s.workSiteId).filter(Boolean)).size,
      thisMonth: sheets.filter((s) => {
        const d = new Date(s.updatedAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
    };
  }, [sheets]);

  const hasFilters = Boolean(sectionFilter || workSiteFilter);

  const columns: Column<PolevarSheetSummary>[] = [
    {
      key: 'workCode',
      header: 'Work Code',
      sortable: true,
      render: (row) => (
        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-800 ring-1 ring-inset ring-slate-300">
          {row.workCode}
        </span>
      ),
    },
    {
      key: 'workName',
      header: 'Work Name',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => {
            setPrintOnOpen(false);
            setOpenSheet(row);
          }}
          className="group text-left"
        >
          <MultiLineCell
            title={<span className="group-hover:text-blue-600">{row.workName}</span>}
            subtitle={
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {row.workSiteName || 'No site'}
              </span>
            }
          />
        </button>
      ),
    },
    {
      key: 'section',
      header: 'Section',
      sortable: true,
      render: (row) =>
        row.section ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            {row.section}
          </span>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        ),
    },
    {
      key: 'workStatus',
      header: 'Status',
      render: (row) => <StatusBadge status={row.workStatus} />,
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500">
          {formatDate(row.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Polevar Reports"
        subtitle="Every saved POLE VAR sheet, by work code, name and section."
        showFiltersButton={true}
        filtersOpen={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        secondaryActions={
          <button type="button" onClick={loadSheets} disabled={loading} className="btn-secondary">
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        <StatCard loading={loading} title="Polevar Reports" value={sheets.length} icon={FileSpreadsheet} variant="blue" />
        <StatCard loading={loading} title="Sections" value={stats.sections} icon={Layers} variant="purple" />
        <StatCard loading={loading} title="Work Sites" value={stats.sites} icon={MapPin} variant="accent" />
        <StatCard loading={loading} title="Updated This Month" value={stats.thisMonth} icon={CalendarClock} variant="success" />
      </div>

      {showFilters && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4 no-print">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value);
                setWorkSiteFilter('');
              }}
              className="form-input !w-auto min-w-[200px]"
            >
              <option value="">All sections</option>
              {sectionOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={workSiteFilter}
              onChange={(e) => setWorkSiteFilter(e.target.value)}
              className="form-input !w-auto min-w-[200px]"
            >
              <option value="">All work sites</option>
              {sitesInSection.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSectionFilter('');
                  setWorkSiteFilter('');
                }}
                className="btn-ghost text-blue-600"
              >
                Clear filters
              </button>
            )}
          </div>

          <button type="button" onClick={() => setShowFilters(false)} className="btn-icon" title="Close filters">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="print-only">
        <PrintHeader
          title="POLEVAR REPORTS"
          date={new Date().toISOString()}
          subtitle="Saved POLE VAR sheets by work code, name and electrical section."
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <DataTable<PolevarSheetSummary>
        columns={columns}
        data={sheets}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search work code, name, section or site"
        isLoading={loading}
        rowKey={(r) => r.workId}
        onView={(row) => {
          setPrintOnOpen(false);
          setOpenSheet(row);
        }}
        onReportRow={downloadExcel}
        reportRowTitle="Download Excel"
        emptyMessage={
          hasFilters || searchTerm
            ? 'No Polevar reports match these filters.'
            : 'No Polevar sheets saved yet. Open a work entry and save its Polevar sheet.'
        }
      />

      {openSheet && (
        <WorkPolevarModal
          isOpen={Boolean(openSheet)}
          work={
            {
              id: openSheet.workId,
              workCode: openSheet.workCode,
              name: openSheet.workName,
              status: openSheet.workStatus,
              date: openSheet.workDate,
              electricalSection: openSheet.section || undefined,
              workSiteId: openSheet.workSiteId || undefined,
              workSite: openSheet.workSiteName ? { name: openSheet.workSiteName } : undefined,
            } as Work
          }
          autoPrint={printOnOpen}
          onClose={() => setOpenSheet(null)}
          onUpdated={loadSheets}
        />
      )}
    </div>
  );
};
