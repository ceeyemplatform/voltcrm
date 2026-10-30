import React, { useState, useEffect, useMemo, useRef } from 'react';
import { buildFileName, fileDate, printWithFileName } from '../lib/print';
import { formatDate, weekdayOf } from '../lib/dates';
import { DetailPageSkeleton } from '../components/common/Skeleton';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Briefcase,
  MapPin,
  Phone,
  Printer,
  Download,
  Plus,
  Edit2,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Boxes,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Trash2,
  X,
  Eye,
} from 'lucide-react';
import { WorkSite, Work, WorkLabour, WorkMaterial, DailyWorkDetail } from '../types';
import { api } from '../lib/api';
import { StatusBadge } from '../components/common/Badges';
import { getAllWorkStatuses } from '../lib/statusConfig';
import { PrintHeader } from '../components/common/PrintHeader';
import { DailyWorkDetailModal } from '../components/work/DailyWorkDetailModal';
import { WorkDetailPage } from './WorkDetailPage';
import { confirmDelete } from '../components/common/ConfirmHost';

interface WorkSiteDetailPageProps {
  siteId: string;
  onBack: () => void;
  onEditSite?: (site: WorkSite) => void;
  onCreateWorkForSite?: (siteId: string) => void;
  onOpenWorkPolevar?: (work: Work) => void;
  onPrintWork?: (work: Work) => void;
  onEditWork?: (work: Work) => void;
}

export const WorkSiteDetailPage: React.FC<WorkSiteDetailPageProps> = ({
  siteId,
  onBack,
  onEditSite,
  onCreateWorkForSite,
  onOpenWorkPolevar,
  onPrintWork,
  onEditWork,
}) => {
  const [site, setSite] = useState<WorkSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'workcode'>('calendar');
  const [expandedWorkIds, setExpandedWorkIds] = useState<Record<string, boolean>>({});
  const [workCodeSearch, setWorkCodeSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Daily work detail modal state
  const [dailyModalWork, setDailyModalWork] = useState<Work | null>(null);
  const [dailyModalInitialDate, setDailyModalInitialDate] = useState<string | undefined>(undefined);
  const [dailyModalEditingDetail, setDailyModalEditingDetail] = useState<DailyWorkDetail | null>(null);
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);

  // Calendar tab state
  const [selectedWorkIdForDetail, setSelectedWorkIdForDetail] = useState<string | null>(null);
  const [activeCrewPopoverId, setActiveCrewPopoverId] = useState<string | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [calendarFilterDate, setCalendarFilterDate] = useState<string>('ALL');
  const [calendarSearch, setCalendarSearch] = useState('');
  const [onlyActiveDays, setOnlyActiveDays] = useState(true);
  const dateStripRef = useRef<HTMLDivElement>(null);

  const loadSite = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.workSites.get(id);
      setSite(data);
      if (data.works && data.works.length > 0) {
        setExpandedWorkIds({ [data.works[0].id]: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load work site details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (siteId) {
      loadSite(siteId);
    }
  }, [siteId]);

  const works = useMemo(() => site?.works || [], [site]);

  // Calculate high-level metrics
  const totalWorks = works.length;
  const completedWorks = works.filter((w) => w.status === 'COMPLETED').length;
  const pendingWorks = works.filter(
    (w) => w.status === 'PENDING' || w.status === 'IN_PROGRESS'
  ).length;
  const totalContractValue = works.reduce(
    (sum, w) => sum + (Number(w.contractorAmount) || 0),
    0
  );

  // Derive chronological dates for Calendar View
  const calendarTimeline = useMemo(() => {
    if (!works || works.length === 0) return [];

    // Helper to format Date to YYYY-MM-DD
    const toDateKey = (d: Date | string) => {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return null;
      return dateObj.toISOString().split('T')[0];
    };

    // Find earliest and latest dates
    let minTime = Infinity;
    let maxTime = -Infinity;

    works.forEach((w) => {
      const s = new Date(w.date).getTime();
      if (!isNaN(s)) {
        if (s < minTime) minTime = s;
        if (s > maxTime) maxTime = s;
      }
      if (w.endDate) {
        const e = new Date(w.endDate).getTime();
        if (!isNaN(e)) {
          if (e > maxTime) maxTime = e;
        }
      }
      if (w.dailyDetails && Array.isArray(w.dailyDetails)) {
        w.dailyDetails.forEach((d) => {
          const dt = new Date(d.date).getTime();
          if (!isNaN(dt)) {
            if (dt < minTime) minTime = dt;
            if (dt > maxTime) maxTime = dt;
          }
        });
      }
    });

    if (minTime === Infinity) return [];

    // Map of date string to active works
    const dateMap = new Map<
      string,
      {
        date: Date;
        dateKey: string;
        works: {
          work: Work;
          isStart: boolean;
          isEnd: boolean;
          dailyLog?: DailyWorkDetail;
        }[];
      }
    >();

    // Populate all dates from start to end
    const curr = new Date(minTime);
    // Normalize to midnight
    curr.setHours(0, 0, 0, 0);
    const end = new Date(maxTime);
    end.setHours(23, 59, 59, 999);

    // Limit day span to max 365 days to prevent loop runaway
    let count = 0;
    while (curr.getTime() <= end.getTime() && count < 365) {
      const key = curr.toISOString().split('T')[0];
      dateMap.set(key, {
        date: new Date(curr),
        dateKey: key,
        works: [],
      });
      curr.setDate(curr.getDate() + 1);
      count++;
    }

    // Assign works to dates
    works.forEach((w) => {
      const startKey = toDateKey(w.date);
      const endKey = w.endDate ? toDateKey(w.endDate) : startKey;

      if (!startKey) return;

      dateMap.forEach((entry, key) => {
        const inRange = endKey
          ? key >= startKey && key <= endKey
          : key === startKey;

        const dailyLogForThisDay = (w.dailyDetails || []).find((d) => d.date === key);

        if (inRange || dailyLogForThisDay) {
          entry.works.push({
            work: w,
            isStart: key === startKey,
            isEnd: key === endKey,
            dailyLog: dailyLogForThisDay,
          });
        }
      });
    });

    // Convert map to array sorted ascending by date
    const allDays = Array.from(dateMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    return allDays;
  }, [works]);

  const handleDeleteDailyDetail = async (work: Work, detailId: string) => {
    if (!(await confirmDelete('Delete this daily work entry? Its workers, wages and site expenses will be removed.'))) return;
    try {
      const currentList = Array.isArray(work.dailyDetails) ? [...work.dailyDetails] : [];
      const updatedList = currentList.filter((d) => d.id !== detailId);
      await api.works.updateDailyDetails(work.id, updatedList);
      await loadSite(siteId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete daily work detail');
    }
  };

  // Set default selected date once calendar timeline is computed
  useEffect(() => {
    if (calendarTimeline.length > 0 && !selectedDateStr) {
      // Find the first date with work, or just the first date
      const firstActive = calendarTimeline.find((d) => d.works.length > 0);
      setSelectedDateStr(firstActive ? firstActive.dateKey : calendarTimeline[0].dateKey);
    }
  }, [calendarTimeline, selectedDateStr]);

  // Filtered calendar days for the swipe strip
  const visibleCalendarDays = useMemo(() => {
    if (onlyActiveDays) {
      return calendarTimeline.filter((d) => d.works.length > 0);
    }
    return calendarTimeline;
  }, [calendarTimeline, onlyActiveDays]);

  // Date display helper
  const formatDateDisplay = (dateStr: string) => {
    try {
      return `${weekdayOf(dateStr)}, ${formatDate(dateStr)}`;
    } catch {
      return dateStr;
    }
  };

  // All daily work logs across all works on this site
  const allDailyLogs = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      work: Work;
      workCode: string;
      workName: string;
      electricalSection?: string;
      typeOfWork?: string;
      dailyLog: DailyWorkDetail;
    }> = [];

    works.forEach((w) => {
      (w.dailyDetails || []).forEach((d) => {
        list.push({
          id: `${w.id}_${d.id}`,
          date: d.date,
          work: w,
          workCode: w.workCode,
          workName: w.name,
          electricalSection: w.electricalSection,
          typeOfWork: w.typeOfWork,
          dailyLog: d,
        });
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [works]);

  // Filtered daily logs for the Calendar Table
  const filteredCalendarLogs = useMemo(() => {
    return allDailyLogs.filter((item) => {
      // Date filter
      if (calendarFilterDate !== 'ALL' && item.date !== calendarFilterDate) {
        return false;
      }

      // Search query filter
      if (calendarSearch.trim()) {
        const q = calendarSearch.toLowerCase().trim();
        const matchesWorkCode = item.workCode.toLowerCase().includes(q);
        const matchesWorkName = item.workName.toLowerCase().includes(q);
        const matchesWorkDone = item.dailyLog.workDone.toLowerCase().includes(q);
        const matchesSection = (item.electricalSection || '').toLowerCase().includes(q);
        const matchesRemarks = (item.dailyLog.remarks || '').toLowerCase().includes(q);
        const matchesLabour = (item.dailyLog.labourMembers || []).some((m) =>
          m.name.toLowerCase().includes(q)
        );

        if (
          !matchesWorkCode &&
          !matchesWorkName &&
          !matchesWorkDone &&
          !matchesSection &&
          !matchesRemarks &&
          !matchesLabour
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allDailyLogs, calendarFilterDate, calendarSearch]);

  // Active works scheduled on selected date that don't have a daily log yet
  const unloggedWorksForSelectedDate = useMemo(() => {
    if (calendarFilterDate === 'ALL') return [];
    return works.filter((w) => {
      const startKey = w.date ? w.date.split('T')[0] : '';
      const endKey = w.endDate ? w.endDate.split('T')[0] : startKey;
      const inRange = endKey
        ? calendarFilterDate >= startKey && calendarFilterDate <= endKey
        : calendarFilterDate === startKey;

      if (!inRange) return false;

      const hasLog = (w.dailyDetails || []).some((d) => d.date === calendarFilterDate);
      return !hasLog;
    });
  }, [works, calendarFilterDate]);

  // Selected date data
  const selectedDayData = useMemo(() => {
    if (!selectedDateStr) return null;
    return calendarTimeline.find((d) => d.dateKey === selectedDateStr) || null;
  }, [calendarTimeline, selectedDateStr]);

  // Filtered works for "Work Code" tab
  const filteredWorks = useMemo(() => {
    return works.filter((w) => {
      const matchesSearch =
        workCodeSearch === '' ||
        w.workCode.toLowerCase().includes(workCodeSearch.toLowerCase()) ||
        w.name.toLowerCase().includes(workCodeSearch.toLowerCase()) ||
        (w.typeOfWork && w.typeOfWork.toLowerCase().includes(workCodeSearch.toLowerCase())) ||
        (w.gstMillNumber && w.gstMillNumber.toLowerCase().includes(workCodeSearch.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' || w.status.toUpperCase() === statusFilter.toUpperCase();

      return matchesSearch && matchesStatus;
    });
  }, [works, workCodeSearch, statusFilter]);

  const toggleExpand = (workId: string) => {
    setExpandedWorkIds((prev) => ({
      ...prev,
      [workId]: !prev[workId],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    works.forEach((w) => {
      all[w.id] = true;
    });
    setExpandedWorkIds(all);
  };

  const collapseAll = () => {
    setExpandedWorkIds({});
  };

  const scrollDateStrip = (direction: 'left' | 'right') => {
    if (dateStripRef.current) {
      const amount = direction === 'left' ? -260 : 260;
      dateStripRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <DetailPageSkeleton />
    );
  }

  if (error || !site) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="inline-flex p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Work Site Not Found</h3>
        <p className="text-xs text-slate-500">{error || 'Could not locate the requested work site.'}</p>
        <button
          onClick={onBack}
          className="btn-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Work Sites</span>
        </button>
      </div>
    );
  }

  if (selectedWorkIdForDetail) {
    return (
      <WorkDetailPage
        workId={selectedWorkIdForDetail}
        onBack={() => {
          setSelectedWorkIdForDetail(null);
          loadSite(siteId);
        }}
        onEditWork={(w) => {
          if (onEditWork) onEditWork(w);
        }}
        onOpenPolevar={(w) => {
          if (onOpenWorkPolevar) onOpenWorkPolevar(w);
        }}
        onPrintWork={(w) => {
          if (onPrintWork) onPrintWork(w);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar with Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary group"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition" />
            <span>Back to Work Sites</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {onEditSite && (
            <button
              type="button"
              onClick={() => onEditSite(site)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <Edit2 className="h-3.5 w-3.5 text-slate-500" />
              <span>Edit Site</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => printWithFileName(buildFileName('Work Site', site?.name, fileDate()))}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-blue-600" />
            <span>Download PDF</span>
          </button>

          {onCreateWorkForSite && (
            <button
              type="button"
              onClick={() => onCreateWorkForSite(site.id)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Work to Site</span>
            </button>
          )}
        </div>
      </div>

      {/* Print Only Header */}
      <div className="print-only">
        <PrintHeader
          title={`WORK SITE REPORT: ${site.name.toUpperCase()}`}
          date={new Date().toISOString()}
          subtitle={`Section: ${site.section || 'General'} | Address: ${site.address || 'N/A'}`}
        />
      </div>

      {/* Site Master Header Card */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {site.name}
                </h1>
                {site.section && (
                  <span className="font-semibold text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
                    Section: {site.section}
                  </span>
                )}
                <span className="font-semibold text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Site
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500 mt-2">
                <span className="flex items-center space-x-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{site.address || 'Location not specified'}</span>
                </span>
                {site.contact && (
                  <span className="flex items-center space-x-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-medium text-slate-700">{site.contact}</span>
                  </span>
                )}
                <span className="flex items-center space-x-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span>Created: {formatDate(site.createdAt)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Site Notes Banner */}
        {site.note && (
          <div className="mt-5 rounded-xl bg-amber-50/70 border border-amber-200/80 p-3.5 text-xs text-amber-950 flex items-start space-x-2.5">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold block text-amber-900">
                Site Directives & Protocol:
              </span>
              <span className="text-amber-800 leading-relaxed">{site.note}</span>
            </div>
          </div>
        )}

        {/* 4 Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-300">
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-300">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Works
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {totalWorks}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Job contracts recorded</span>
          </div>

          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
              Completed
            </span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">
              {completedWorks}
            </span>
            <span className="text-[11px] text-emerald-600/80 mt-0.5 block">Delivered & closed</span>
          </div>

          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200/50">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
              In Progress / Pending
            </span>
            <span className="text-2xl font-bold text-blue-700 mt-1 block">
              {pendingWorks}
            </span>
            <span className="text-[11px] text-blue-600/80 mt-0.5 block">Active on-site tasks</span>
          </div>

          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-300">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Contract Value
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
              ₹{totalContractValue.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Gross agreed billings</span>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 pb-3 no-print">
        <div className="flex items-center space-x-2 bg-slate-100/90 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs ${
              activeTab === 'calendar'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <CalendarIcon className="h-4 w-4" />
            <span>Daily Work Logs</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'calendar'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {allDailyLogs.length} Logs
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workcode')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs ${
              activeTab === 'workcode'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>As Work Code</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'workcode'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {totalWorks} Works
            </span>
          </button>
        </div>

        {/* Tab Controls */}
        {activeTab === 'calendar' ? (
          <div className="flex items-center space-x-3 text-xs text-slate-500 font-semibold">
            <span>{allDailyLogs.length} total entries recorded</span>
          </div>
        ) : (
          <div className="flex items-center space-x-3 text-xs">
            <button
              type="button"
              onClick={expandAll}
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Expand All
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={collapseAll}
              className="font-semibold text-slate-500 hover:text-slate-700 hover:underline"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AS CALENDAR VIEW                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {calendarTimeline.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
              <CalendarIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No work dates logged yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Add work orders with start and completion dates to populate the daily work timeline.
              </p>
              {onCreateWorkForSite && (
                <button
                  type="button"
                  onClick={() => onCreateWorkForSite(site.id)}
                  className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create First Work Order</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Daily Work Logs Table */}
              <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xs space-y-0">
                {/* Table Header & Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-slate-300 bg-slate-50/80">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                      <CalendarIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          Daily work logs
                        </h3>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          {filteredCalendarLogs.length} Entries
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Chronological table of electrical work details, work codes, crew deployed and wages
                      </p>
                    </div>
                  </div>

                  {/* Filters & Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search inside Table */}
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search work code, details, crew..."
                        value={calendarSearch}
                        onChange={(e) => setCalendarSearch(e.target.value)}
                        className="text-xs pl-8.5 pr-8 py-2 rounded-xl border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs w-56 sm:w-64"
                      />
                      {calendarSearch && (
                        <button
                          type="button"
                          onClick={() => setCalendarSearch('')}
                          className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {works.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDailyModalWork(works[0]);
                          setDailyModalEditingDetail(null);
                          setDailyModalInitialDate(undefined);
                          setIsDailyModalOpen(true);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-xs cursor-pointer shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Log Daily Work</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Table Component */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/90 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-300">
                      <tr>
                        <th className="py-3 px-4 whitespace-nowrap">Date</th>
                        <th className="py-3 px-4 whitespace-nowrap">Work Code</th>
                        <th className="py-3 px-4 min-w-[170px]">Job Title & Section</th>
                        <th className="py-3 px-4 min-w-[260px]">Work Done / Details</th>
                        <th className="py-3 px-4 min-w-[180px]">Crew & Wages</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {filteredCalendarLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            <CalendarIcon className="h-9 w-9 mx-auto mb-2 text-slate-300" />
                            <p className="font-bold text-xs text-slate-700">
                              No daily work logs recorded yet
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                              {calendarSearch
                                ? `No logs match "${calendarSearch}". Clear search to view all logged records.`
                                : 'Add a daily work entry with the button above to log work done, crew deployed and wages.'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredCalendarLogs.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-blue-50/20 transition-colors group"
                          >
                            {/* Date */}
                            <td className="py-3.5 px-4 align-top whitespace-nowrap">
                              <div className="font-bold text-slate-900">
                                {formatDateDisplay(item.date)}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {item.date}
                              </div>
                            </td>

                            {/* Work Code with Eye Action */}
                            <td className="py-3.5 px-4 align-top whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedWorkIdForDetail(item.work.id)}
                                className="inline-flex items-center space-x-1.5 font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-2xs transition cursor-pointer group"
                                title="Open Work Entry Page"
                              >
                                <span>{item.workCode}</span>
                                <Eye className="h-3.5 w-3.5 text-blue-500 group-hover:text-blue-700" />
                              </button>
                              <div className="mt-1.5">
                                <StatusBadge status={item.work.status} />
                              </div>
                            </td>

                            {/* Job Title & Section */}
                            <td className="py-3.5 px-4 align-top">
                              <div className="font-bold text-slate-900 leading-snug">
                                {item.workName}
                              </div>
                              {item.electricalSection && (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Section: <span className="font-semibold text-slate-700">{item.electricalSection}</span>
                                </div>
                              )}
                              {item.typeOfWork && (
                                <div className="text-[10px] text-slate-400">
                                  {item.typeOfWork}
                                </div>
                              )}
                            </td>

                            {/* Work Done / Details */}
                            <td className="py-3.5 px-4 align-top">
                              <div className="font-medium text-slate-800 leading-relaxed whitespace-pre-line">
                                {item.dailyLog.workDone}
                              </div>
                              {item.dailyLog.remarks && (
                                <div className="text-[11px] text-slate-500 italic mt-1.5 bg-slate-50 p-2 rounded-lg border border-slate-300">
                                  <span className="font-semibold not-italic text-slate-700">Inspection Note:</span>{' '}
                                  {item.dailyLog.remarks}
                                </div>
                              )}
                            </td>

                            {/* Crew & Wages with number and i icon popover */}
                            <td className="py-3.5 px-4 align-top">
                              {item.dailyLog.labourMembers && item.dailyLog.labourMembers.length > 0 ? (
                                <div className="relative inline-block text-left">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-xs text-slate-900 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg whitespace-nowrap">
                                      {item.dailyLog.labourCount || item.dailyLog.labourMembers.length} Workers
                                    </span>

                                    {item.dailyLog.totalDailyWage !== undefined && (
                                      <span className="font-mono font-bold text-xs text-slate-700 whitespace-nowrap">
                                        ₹{item.dailyLog.totalDailyWage.toLocaleString()}
                                      </span>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveCrewPopoverId(
                                          activeCrewPopoverId === item.id ? null : item.id
                                        )
                                      }
                                      className={`h-5 w-5 rounded-full flex items-center justify-center transition border cursor-pointer shrink-0 ${
                                        activeCrewPopoverId === item.id
                                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                          : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                                      }`}
                                      title="View crew details list"
                                    >
                                      <Info className="h-3 w-3" />
                                    </button>
                                  </div>

                                  {/* Floating Crew List Box */}
                                  {activeCrewPopoverId === item.id && (
                                    <div className="absolute left-0 top-full mt-1.5 z-40 w-72 p-3 bg-white rounded-xl shadow-xl border border-slate-300 text-xs animate-in fade-in zoom-in-95">
                                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-300">
                                        <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                                          <Users className="h-3.5 w-3.5 text-blue-600" />
                                          <span>
                                            Crew List ({item.dailyLog.labourCount || item.dailyLog.labourMembers.length})
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setActiveCrewPopoverId(null)}
                                          className="p-0.5 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>

                                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {item.dailyLog.labourMembers.map((m, mIdx) => (
                                          <div
                                            key={mIdx}
                                            className={`flex items-center justify-between p-1.5 rounded-lg border text-xs ${
                                              m.isAdditional
                                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                                : 'bg-blue-50/70 border-blue-200 text-blue-950'
                                            }`}
                                          >
                                            <div className="flex items-center space-x-1.5">
                                              <span
                                                className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded font-mono ${
                                                  m.isAdditional
                                                    ? 'bg-emerald-200 text-emerald-800'
                                                    : 'bg-blue-200 text-blue-800'
                                                }`}
                                              >
                                                {m.isAdditional ? 'Casual' : 'Perm'}
                                              </span>
                                              <span className="font-semibold">{m.name}</span>
                                            </div>
                                            {m.wage !== undefined && (
                                              <span className="font-mono font-bold text-slate-700">
                                                ₹{m.wage}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>

                                      {item.dailyLog.totalDailyWage !== undefined && (
                                        <div className="mt-2.5 pt-2 border-t border-slate-300 flex items-center justify-between font-bold text-xs">
                                          <span className="text-slate-500 uppercase text-[10px]">
                                            Total Day Wages
                                          </span>
                                          <span className="font-mono text-slate-900">
                                            ₹{item.dailyLog.totalDailyWage.toLocaleString()}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : item.dailyLog.labourCount ? (
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-xs text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                    {item.dailyLog.labourCount} Workers
                                  </span>
                                  {item.dailyLog.totalDailyWage !== undefined && (
                                    <span className="font-mono font-bold text-xs text-slate-700 whitespace-nowrap">
                                      ₹{item.dailyLog.totalDailyWage.toLocaleString()}
                                    </span>
                                  )}
                                  {item.dailyLog.labourDetails && (
                                    <div className="relative inline-block">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActiveCrewPopoverId(
                                            activeCrewPopoverId === item.id ? null : item.id
                                          )
                                        }
                                        className="h-5 w-5 rounded-full flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 cursor-pointer"
                                        title="View crew details"
                                      >
                                        <Info className="h-3 w-3" />
                                      </button>
                                      {activeCrewPopoverId === item.id && (
                                        <div className="absolute left-0 top-full mt-1.5 z-40 w-64 p-3 bg-white rounded-xl shadow-xl border border-slate-300 text-xs">
                                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-300">
                                            <span className="font-bold text-slate-900">Crew Details</span>
                                            <button
                                              type="button"
                                              onClick={() => setActiveCrewPopoverId(null)}
                                              className="p-0.5 text-slate-400 hover:text-slate-600"
                                            >
                                              <X className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                          <p className="text-slate-700 text-xs leading-relaxed">
                                            {item.dailyLog.labourDetails}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">No workforce logged</span>
                              )}
                            </td>

                            {/* Actions with Eye Icon */}
                            <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedWorkIdForDetail(item.work.id)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                  title="Open Work Entry Page"
                                >
                                  <Eye className="h-4 w-4 text-blue-600" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setDailyModalWork(item.work);
                                    setDailyModalEditingDetail(item.dailyLog);
                                    setDailyModalInitialDate(item.date);
                                    setIsDailyModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                  title="Edit Daily Detail"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>

                                {onOpenWorkPolevar && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenWorkPolevar(item.work)}
                                    className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                    title="Open Polevar Sheet"
                                  >
                                    <FileSpreadsheet className="h-4 w-4 text-amber-600" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteDailyDetail(item.work, item.dailyLog.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Delete Entry"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Additional section: Scheduled work orders on this date without a daily log */}
                {calendarFilterDate !== 'ALL' && unloggedWorksForSelectedDate.length > 0 && (
                  <div className="p-4 bg-amber-50/60 border-t border-amber-200/80">
                    <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 mb-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span>
                        Other Active Work Orders on {formatDateDisplay(calendarFilterDate)} without a daily log yet:
                      </span>
                    </div>
                    <div className="space-y-2">
                      {unloggedWorksForSelectedDate.map((unloggedWork) => (
                        <div
                          key={unloggedWork.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-amber-200/80 text-xs"
                        >
                          <div className="flex items-center space-x-2.5">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">
                              {unloggedWork.workCode}
                            </span>
                            <span className="font-bold text-slate-900">
                              {unloggedWork.name}
                            </span>
                            {unloggedWork.electricalSection && (
                              <span className="text-[11px] text-slate-500">
                                ({unloggedWork.electricalSection})
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setDailyModalWork(unloggedWork);
                              setDailyModalEditingDetail(null);
                              setDailyModalInitialDate(calendarFilterDate);
                              setIsDailyModalOpen(true);
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition cursor-pointer self-start sm:self-auto"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Log Work Done Today</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AS WORK CODE VIEW                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'workcode' && (
        <div className="space-y-5">
          {/* Work Code Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-300 shadow-[0_2px_12px_rgba(0,0,0,0.02)] no-print">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={workCodeSearch}
                onChange={(e) => setWorkCodeSearch(e.target.value)}
                placeholder="Search by Work Code, Title or GST Bill No..."
                className="form-input !pl-10"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses ({works.length})</option>
                {getAllWorkStatuses(works.map((w) => w.status)).map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Works List / Accordion */}
          {filteredWorks.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
              <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No matching work codes found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Try adjusting your search query or status filter.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredWorks.map((work, index) => {
                const isExpanded = Boolean(expandedWorkIds[work.id]);
                const labourTotalWage = (work.labours || []).reduce(
                  (sum, l) => sum + (Number(l.wage) || 0),
                  0
                );

                return (
                  <div
                    key={work.id}
                    className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)] ${
                      isExpanded
                        ? 'border-blue-300 ring-2 ring-blue-100'
                        : 'border-slate-300 hover:border-slate-300'
                    }`}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => toggleExpand(work.id)}
                      className="flex flex-col md:flex-row md:items-center justify-between p-5 cursor-pointer hover:bg-slate-50/50 transition gap-4"
                    >
                      <div className="flex items-start sm:items-center space-x-3.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700 border border-slate-300">
                          {index + 1}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200/60">
                              {work.workCode}
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm">
                              {work.name}
                            </h4>
                            <StatusBadge status={work.status} />
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
                            <span className="flex items-center space-x-1">
                              <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                              <span>
                                Start: <strong>{formatDate(work.date)}</strong>
                              </span>
                              {work.endDate && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span>
                                    End: <strong>{formatDate(work.endDate)}</strong>
                                  </span>
                                </>
                              )}
                            </span>
                            {work.typeOfWork && (
                              <span>
                                Type: <strong className="text-slate-700">{work.typeOfWork}</strong>
                              </span>
                            )}
                            {work.electricalSection && (
                              <span>
                                Section: <strong className="text-slate-700">{work.electricalSection}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3.5 self-end md:self-auto shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Contract Value
                          </span>
                          <span className="font-mono text-base font-bold text-slate-950">
                            ₹{Number(work.contractorAmount || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div
                          className="flex items-center space-x-1.5 pl-3 border-l border-slate-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onOpenWorkPolevar && (
                            <button
                              type="button"
                              onClick={() => onOpenWorkPolevar(work)}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition shadow-2xs"
                              title="Open Polevar Material Report"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5 text-amber-700" />
                              <span className="hidden sm:inline">Polevar</span>
                            </button>
                          )}
                          {onPrintWork && (
                            <button
                              type="button"
                              onClick={() => onPrintWork(work)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition border border-slate-300 bg-white"
                              title="Print Work Order"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          )}
                          {onEditWork && (
                            <button
                              type="button"
                              onClick={() => onEditWork(work)}
                              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition border border-slate-300 bg-white"
                              title="Edit Work Order"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          <div className="p-1 text-slate-400">
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-blue-600" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Work Details & Daily Breakdown */}
                    {isExpanded && (
                      <div className="border-t border-slate-300 bg-slate-50/40 p-6 space-y-6">
                        {/* Specifications Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-300 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Work Order No
                            </span>
                            <span className="font-semibold text-slate-800 mt-0.5 block">
                              {work.workOrder || 'N/A'}
                            </span>
                            {work.woDate && (
                              <span className="text-[10px] text-slate-500">
                                Date: {formatDate(work.woDate)}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              GST Bill Ref
                            </span>
                            <span className="font-semibold text-slate-800 mt-0.5 block font-mono">
                              {work.gstMillNumber || 'N/A'}
                            </span>
                            {work.gstDate && (
                              <span className="text-[10px] text-slate-500">
                                Date: {formatDate(work.gstDate)}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Electrical Section
                            </span>
                            <span className="font-semibold text-slate-800 mt-0.5 block">
                              {work.electricalSection || 'Default'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Workforce Wages Total
                            </span>
                            <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                              ₹{labourTotalWage.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Day-by-Day Work Details for this Work Code */}
                        <div className="bg-white rounded-xl border border-slate-300 p-5 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 pb-3">
                            <div className="flex items-center space-x-2">
                              <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                <Clock className="h-4 w-4" />
                              </div>
                              <div>
                                <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                  Day-by-Day Work Details & Logs
                                </h5>
                                <p className="text-[11px] text-slate-500">
                                  Track daily tasks, manpower deployed, and materials consumed for {work.workCode}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setDailyModalWork(work);
                                setDailyModalEditingDetail(null);
                                setDailyModalInitialDate(undefined);
                                setIsDailyModalOpen(true);
                              }}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-2xs cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Add Daily Work Detail</span>
                            </button>
                          </div>

                          {/* Quick Summary of Dates */}
                          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 flex flex-wrap gap-x-6 gap-y-2 border border-slate-300">
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                Work Start Date
                              </span>
                              <span className="font-bold text-slate-900">
                                {formatDate(work.date)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                Completion Date
                              </span>
                              <span className="font-bold text-slate-900">
                                {work.endDate ? formatDate(work.endDate) : 'In Progress'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                Total Days Worked
                              </span>
                              <span className="font-bold text-blue-600">
                                {work.dailyDetails?.length || 0} day(s) recorded
                              </span>
                            </div>
                          </div>

                          {/* Daily Logs List */}
                          {!work.dailyDetails || work.dailyDetails.length === 0 ? (
                            <div className="py-7 px-4 rounded-xl border border-dashed border-slate-300 text-center bg-slate-50/50">
                              <CalendarIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                              <p className="text-xs font-bold text-slate-700">
                                No daily work details recorded yet for {work.workCode}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                                Record day-by-day logs of what was accomplished, workers present, and materials used.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setDailyModalWork(work);
                                  setDailyModalEditingDetail(null);
                                  setDailyModalInitialDate(undefined);
                                  setIsDailyModalOpen(true);
                                }}
                                className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition border border-blue-200 cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Add First Daily Work</span>
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {work.dailyDetails.map((detail, dIdx) => (
                                <div
                                  key={detail.id || dIdx}
                                  className="p-3.5 rounded-xl border border-slate-300 bg-white hover:border-slate-300 transition space-y-2 shadow-2xs"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                        {`${weekdayOf(detail.date)}, ${formatDate(detail.date)}`}
                                      </span>
                                      {detail.labourCount !== undefined && (
                                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300">
                                          {detail.labourCount} Workers
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center space-x-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDailyModalWork(work);
                                          setDailyModalEditingDetail(detail);
                                          setIsDailyModalOpen(true);
                                        }}
                                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                                        title="Edit daily detail"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDailyDetail(work, detail.id)}
                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                        title="Delete daily detail"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="text-xs text-slate-800 leading-relaxed font-medium">
                                    {detail.workDone}
                                  </div>

                                  {detail.labourMembers && detail.labourMembers.length > 0 ? (
                                    <div className="pt-2 border-t border-slate-300 space-y-1.5">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-bold text-slate-700 flex items-center space-x-1">
                                          <Users className="h-3.5 w-3.5 text-blue-600" />
                                          <span>Crew Deployed ({detail.labourCount || detail.labourMembers.length} Workers):</span>
                                        </span>
                                        {detail.totalDailyWage !== undefined && (
                                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">
                                            Day Wages: ₹{detail.totalDailyWage.toLocaleString()}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {detail.labourMembers.map((m, mIdx) => (
                                          <span
                                            key={mIdx}
                                            className={`inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-lg border font-medium ${
                                              m.isAdditional
                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                : 'bg-blue-50 text-blue-800 border-blue-200'
                                            }`}
                                          >
                                            <span className="font-bold">{m.name}</span>
                                            {m.wage !== undefined && (
                                              <span className="font-mono text-slate-600">₹{m.wage}</span>
                                            )}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : detail.labourDetails ? (
                                    <div className="pt-2 border-t border-slate-300 flex items-start space-x-1.5 text-[11px] text-slate-600">
                                      <Users className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                                      <span>Crew: <strong className="text-slate-800">{detail.labourDetails}</strong></span>
                                    </div>
                                  ) : null}

                                  {(detail.materialsUsed || detail.remarks) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-300 text-[11px] text-slate-600">
                                      {detail.materialsUsed && (
                                        <div className="flex items-start space-x-1.5">
                                          <Boxes className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                                          <span>Materials: <strong className="text-slate-800">{detail.materialsUsed}</strong></span>
                                        </div>
                                      )}
                                      {detail.remarks && (
                                        <div className="sm:col-span-2 text-slate-500 italic">
                                          Note: {detail.remarks}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Workforce and Materials 2-Column Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          {/* Labourers Table */}
                          <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                                <Users className="h-4 w-4 text-blue-600" />
                                <span>Labour Workforce ({work.labours?.length || 0})</span>
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-700">
                                Total: ₹{labourTotalWage.toLocaleString()}
                              </span>
                            </div>

                            {!work.labours || work.labours.length === 0 ? (
                              <div className="p-6 text-center text-xs text-slate-400">
                                No labour workforce assigned to this work code.
                              </div>
                            ) : (
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50/60 text-[10px] text-slate-400 uppercase border-b border-slate-300">
                                  <tr>
                                    <th className="px-4 py-2">Labour Name</th>
                                    <th className="px-3 py-2">Category</th>
                                    <th className="px-4 py-2 text-right">Wage (₹)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-300">
                                  {work.labours.map((l, lIdx) => (
                                    <tr key={l.id || lIdx} className="hover:bg-slate-50/50">
                                      <td className="px-4 py-2.5 font-medium text-slate-800">
                                        {l.labourName}
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-500">
                                        {l.category || 'General'}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                                        ₹{Number(l.wage || 0).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* Materials Table */}
                          <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                                <Boxes className="h-4 w-4 text-amber-600" />
                                <span>Materials Consumed ({work.materials?.length || 0})</span>
                              </span>
                            </div>

                            {!work.materials || work.materials.length === 0 ? (
                              <div className="p-6 text-center text-xs text-slate-400">
                                No materials recorded for this work code.
                              </div>
                            ) : (
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50/60 text-[10px] text-slate-400 uppercase border-b border-slate-300">
                                  <tr>
                                    <th className="px-4 py-2">Material</th>
                                    <th className="px-3 py-2 text-right">Issued</th>
                                    <th className="px-3 py-2 text-right">Used</th>
                                    <th className="px-4 py-2 text-right">Variance</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-300">
                                  {work.materials.map((m, mIdx) => (
                                    <tr key={m.id || mIdx} className="hover:bg-slate-50/50">
                                      <td className="px-4 py-2.5 font-medium text-slate-800">
                                        {m.materialName}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                                        {m.quantityIssued}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono text-emerald-700 font-bold">
                                        {m.quantityUsed}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-700">
                                        {m.variance}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Daily Work Detail Modal */}
      {isDailyModalOpen && dailyModalWork && (
        <DailyWorkDetailModal
          isOpen={isDailyModalOpen}
          onClose={() => {
            setIsDailyModalOpen(false);
            setDailyModalWork(null);
            setDailyModalEditingDetail(null);
            setDailyModalInitialDate(undefined);
          }}
          work={dailyModalWork}
          initialDate={dailyModalInitialDate}
          editingDetail={dailyModalEditingDetail}
          onSaved={() => loadSite(siteId)}
          onOpenPolevar={(w) => {
            setIsDailyModalOpen(false);
            if (onOpenWorkPolevar) onOpenWorkPolevar(w);
          }}
        />
      )}
    </div>
  );
};

