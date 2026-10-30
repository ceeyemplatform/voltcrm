import { createPortal } from 'react-dom';
import React, { useEffect, useRef, useState } from 'react';
import { buildFileName, fileDate, printWithFileName, usePrintIsolation } from '../../lib/print';
import { formatDate } from '../../lib/dates';
import { Skeleton, CardSkeleton } from '../common/Skeleton';
import {
  X,
  Printer,
  Download,
  MapPin,
  Phone,
  Info,
  Calendar,
  Briefcase,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Plus,
  Edit2,
  Boxes,
  Users,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { WorkSite, Work } from '../../types';
import { api } from '../../lib/api';

interface WorkSiteDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string | null;
  onOpenWorkPolevar: (work: Work) => void;
  onPrintWork: (work: Work) => void;
  onEditWork: (work: Work) => void;
  onCreateWorkForSite?: (siteId: string) => void;
}

export const WorkSiteDetailsModal: React.FC<WorkSiteDetailsModalProps> = ({
  isOpen,
  onClose,
  siteId,
  onOpenWorkPolevar,
  onPrintWork,
  onEditWork,
  onCreateWorkForSite,
}) => {
  // While open, printing outputs only this popup
  usePrintIsolation(isOpen);
  const [site, setSite] = useState<WorkSite | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWorkIds, setExpandedWorkIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && siteId) {
      loadSiteDetails(siteId);
    } else {
      setSite(null);
      setExpandedWorkIds({});
    }
  }, [isOpen, siteId]);

  const loadSiteDetails = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.workSites.get(id);
      setSite(data);
      // Auto-expand the first work if available
      if (data.works && data.works.length > 0) {
        setExpandedWorkIds({ [data.works[0].id]: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load site details');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const toggleExpand = (workId: string) => {
    setExpandedWorkIds((prev) => ({
      ...prev,
      [workId]: !prev[workId],
    }));
  };

  const expandAll = () => {
    if (!site?.works) return;
    const allExpanded: Record<string, boolean> = {};
    site.works.forEach((w) => {
      allExpanded[w.id] = true;
    });
    setExpandedWorkIds(allExpanded);
  };

  const collapseAll = () => {
    setExpandedWorkIds({});
  };

  const works = site?.works || [];
  const totalWorks = works.length;
  const completedWorks = works.filter((w) => w.status === 'COMPLETED').length;
  const pendingWorks = works.filter(
    (w) => w.status === 'PENDING' || w.status === 'IN_PROGRESS'
  ).length;
  const totalContractValue = works.reduce(
    (sum, w) => sum + (Number(w.contractorAmount) || 0),
    0
  );

  const statusColorMap: Record<string, string> = {
    COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-300',
    PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
    CANCELLED: 'bg-rose-100 text-rose-800 border-rose-300',
  };

  return createPortal(
    <div className="print-doc fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl max-h-[94vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-300">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-50/90 px-6 py-4 no-print">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white text-base shadow-xs">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  {loading ? 'Loading Site...' : site?.name || 'Work Site Details'}
                </h3>
                {site?.section && (
                  <span className="font-semibold text-xs text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Section: {site.section}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span>{site?.address || 'Location not specified'}</span>
                {site?.contact && (
                  <>
                    <span className="text-slate-300">•</span>
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{site.contact}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => printWithFileName(buildFileName('Work Site', site?.name, fileDate()))}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>Download PDF</span>
            </button>
            {onCreateWorkForSite && site && (
              <button
                onClick={() => {
                  onClose();
                  onCreateWorkForSite(site.id);
                }}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Work to Site</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div ref={pdfRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <CardSkeleton lines={5} />
            </div>
          ) : error ? (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700">
              {error}
            </div>
          ) : !site ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Work site not found.
            </div>
          ) : (
            <>
              {/* Site Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card p-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Works
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block">
                    {totalWorks}
                  </span>
                </div>
                <div className="card p-4">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                    Completed Works
                  </span>
                  <span className="text-xl font-bold text-emerald-700 mt-1 block">
                    {completedWorks}
                  </span>
                </div>
                <div className="card p-4">
                  <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                    In Progress / Pending
                  </span>
                  <span className="text-xl font-bold text-amber-700 mt-1 block">
                    {pendingWorks}
                  </span>
                </div>
                <div className="card p-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Contract Value
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                    ₹{totalContractValue.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Site Notes (if any) */}
              {site.note && (
                <div className="rounded-xl bg-amber-50/60 border border-amber-200/80 p-3.5 text-xs text-amber-950 flex items-start space-x-2.5">
                  <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold block text-amber-900">
                      Site Instructions & Protocol:
                    </span>
                    <span className="text-amber-800">{site.note}</span>
                  </div>
                </div>
              )}

              {/* Works Section Header with Accordion Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 pb-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span>Works Under This Site ({works.length})</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Detailed job specifications, workforce wage logs & Polevar materials
                  </p>
                </div>

                {works.length > 0 && (
                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      type="button"
                      onClick={expandAll}
                      className="font-medium text-amber-700 hover:text-amber-800 hover:underline"
                    >
                      Expand All
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="font-medium text-slate-500 hover:text-slate-700 hover:underline"
                    >
                      Collapse All
                    </button>
                  </div>
                )}
              </div>

              {/* Works List / Accordion */}
              {works.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
                  <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-700">
                    No work records under this site yet
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Create a new work order for this site to track workforce allocations, Polevar reports and invoices.
                  </p>
                  {onCreateWorkForSite && (
                    <button
                      onClick={() => {
                        onClose();
                        onCreateWorkForSite(site.id);
                      }}
                      className="mt-4 inline-flex items-center space-x-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create Work for {site.name}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {works.map((work, index) => {
                    const isExpanded = Boolean(expandedWorkIds[work.id]);
                    const labourTotalWage = (work.labours || []).reduce(
                      (sum, l) => sum + (Number(l.wage) || 0),
                      0
                    );

                    return (
                      <div
                        key={work.id}
                        className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                          isExpanded
                            ? 'border-amber-300 ring-1 ring-amber-200'
                            : 'border-slate-300 hover:border-slate-300'
                        }`}
                      >
                        {/* Work Summary Header */}
                        <div
                          onClick={() => toggleExpand(work.id)}
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition gap-3"
                        >
                          <div className="flex items-start sm:items-center space-x-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                              {index + 1}
                            </span>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                  {work.workCode}
                                </span>
                                <h5 className="font-bold text-slate-900 text-sm">
                                  {work.name}
                                </h5>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                                    statusColorMap[work.status] ||
                                    'bg-slate-100 text-slate-700 border-slate-300'
                                  }`}
                                >
                                  {work.status}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                                <span className="flex items-center space-x-1">
                                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
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
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 self-end md:self-auto shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                Contract Value
                              </span>
                              <span className="font-mono text-sm font-bold text-slate-950">
                                ₹{Number(work.contractorAmount || 0).toLocaleString()}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div
                              className="flex items-center space-x-1 pl-2 border-l border-slate-300"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => onOpenWorkPolevar(work)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition shadow-2xs"
                                title="Open Polevar Material Report"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5 text-amber-700" />
                                <span className="hidden sm:inline">Polevar Sheet</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onPrintWork(work)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                title="Print Work Report"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditWork(work)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Edit Work Order"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleExpand(work.id)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Work Full Details */}
                        {isExpanded && (
                          <div className="border-t border-slate-300 bg-slate-50/70 p-5 space-y-5">
                            {/* Specifications Grid */}
                            <div>
                              <h6 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                                Contract & Specification Details
                              </h6>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                                <div className="bg-white p-2.5 rounded-lg border border-slate-300">
                                  <span className="text-slate-400 text-[10px] uppercase font-bold block">
                                    Work Order (W/O)
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {work.workOrder || 'N/A'}
                                  </span>
                                </div>
                                <div className="bg-white p-2.5 rounded-lg border border-slate-300">
                                  <span className="text-slate-400 text-[10px] uppercase font-bold block">
                                    W/O Date
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {work.woDate ? formatDate(work.woDate) : 'N/A'}
                                  </span>
                                </div>
                                <div className="bg-white p-2.5 rounded-lg border border-slate-300">
                                  <span className="text-slate-400 text-[10px] uppercase font-bold block">
                                    GST Bill Number
                                  </span>
                                  <span className="font-mono text-slate-800">
                                    {work.gstMillNumber || 'N/A'}
                                  </span>
                                </div>
                                <div className="bg-white p-2.5 rounded-lg border border-slate-300">
                                  <span className="text-slate-400 text-[10px] uppercase font-bold block">
                                    Electrical Section
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {work.electricalSection || 'General'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Section: Labour Workforce Details */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center space-x-1.5">
                                  <Users className="h-3.5 w-3.5 text-amber-600" />
                                  <span>Assigned Workforce & Wages ({work.labours?.length || 0})</span>
                                </h6>
                                {labourTotalWage > 0 && (
                                  <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded">
                                    Total Wages: ₹{labourTotalWage.toLocaleString()}
                                  </span>
                                )}
                              </div>

                              <div className="bg-white rounded-lg border border-slate-300 overflow-hidden">
                                {work.labours && work.labours.length > 0 ? (
                                  <table className="w-full text-left text-xs text-slate-700">
                                    <thead className="bg-slate-50 border-b border-slate-300 font-semibold text-slate-600">
                                      <tr>
                                        <th className="p-2 w-10 text-center">#</th>
                                        <th className="p-2">Labour Name</th>
                                        <th className="p-2">Category of Work</th>
                                        <th className="p-2 text-right">Wage (₹)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-300">
                                      {work.labours.map((labour, lIdx) => (
                                        <tr key={lIdx} className="hover:bg-slate-50/50">
                                          <td className="p-2 text-center text-slate-400">
                                            {lIdx + 1}
                                          </td>
                                          <td className="p-2 font-medium text-slate-900">
                                            {labour.labourName}
                                          </td>
                                          <td className="p-2 text-slate-600">
                                            {labour.category || 'Worker'}
                                          </td>
                                          <td className="p-2 text-right font-mono font-semibold text-slate-900">
                                            ₹{Number(labour.wage || 0).toLocaleString()}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="p-4 text-center text-xs text-slate-400 italic">
                                    No individual labour workforce assigned to this work.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Section: Materials Log (Polevar Variance) */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center space-x-1.5">
                                  <Boxes className="h-3.5 w-3.5 text-amber-600" />
                                  <span>Materials Consumption Log ({work.materials?.length || 0})</span>
                                </h6>
                                <button
                                  type="button"
                                  onClick={() => onOpenWorkPolevar(work)}
                                  className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline flex items-center space-x-1"
                                >
                                  <FileSpreadsheet className="h-3 w-3" />
                                  <span>View Location-wise Polevar Sheet</span>
                                </button>
                              </div>

                              <div className="bg-white rounded-lg border border-slate-300 overflow-hidden">
                                {work.materials && work.materials.length > 0 ? (
                                  <table className="w-full text-left text-xs text-slate-700">
                                    <thead className="bg-slate-50 border-b border-slate-300 font-semibold text-slate-600">
                                      <tr>
                                        <th className="p-2 w-10 text-center">#</th>
                                        <th className="p-2">Material Name</th>
                                        <th className="p-2 text-right">Issued</th>
                                        <th className="p-2 text-right">Used</th>
                                        <th className="p-2 text-right">Variance</th>
                                        <th className="p-2">Remarks</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-300">
                                      {work.materials.map((mat, mIdx) => {
                                        const variance = mat.quantityIssued - mat.quantityUsed;
                                        return (
                                          <tr key={mIdx} className="hover:bg-slate-50/50">
                                            <td className="p-2 text-center text-slate-400">
                                              {mIdx + 1}
                                            </td>
                                            <td className="p-2 font-medium text-slate-900">
                                              {mat.materialName}
                                            </td>
                                            <td className="p-2 text-right font-mono">
                                              {mat.quantityIssued}
                                            </td>
                                            <td className="p-2 text-right font-mono">
                                              {mat.quantityUsed}
                                            </td>
                                            <td
                                              className={`p-2 text-right font-mono font-bold ${
                                                variance > 0
                                                  ? 'text-emerald-700'
                                                  : variance < 0
                                                  ? 'text-rose-700'
                                                  : 'text-slate-700'
                                              }`}
                                            >
                                              {variance > 0 ? `+${variance}` : variance}
                                            </td>
                                            <td className="p-2 text-slate-500 italic">
                                              {mat.remarks || '-'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="p-4 text-center text-xs text-slate-400 italic">
                                    No itemized material rows logged in standard log. Check the Polevar Sheet for location-wise poles.
                                  </div>
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
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
