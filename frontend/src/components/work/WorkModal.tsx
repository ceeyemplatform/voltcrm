import React, { useState, useEffect, useMemo } from 'react';
import { todayISO } from '../../lib/dates';
import {
  FileSpreadsheet,
  Hash,
  CalendarDays,
  CalendarCheck2,
  Briefcase,
  MapPin,
  Flag,
  IndianRupee,
  FileText,
  Wrench,
  Receipt,
  AlertCircle,
  Loader2,
  ClipboardList,
  ArrowUpRight,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Work, Labour, WorkSite } from '../../types';
import { SectionSelect } from '../common/SectionSelect';
import { OptionSelect } from '../common/OptionSelect';
import {
  getAllWorkStatuses,
  saveCustomWorkStatus,
  deleteCustomWorkStatus,
  getAllWorkTypes,
  saveCustomWorkType,
  deleteCustomWorkType,
  WorkStatusOption,
} from '../../lib/statusConfig';

interface WorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: Work | null;
  laboursList: Labour[];
  workSitesList: WorkSite[];
  existingWorkCodes?: string[];
  /** Types of work used by saved works, offered alongside the defaults */
  existingWorkTypes?: string[];
  onOpenPolevar?: (work: Work) => void;
}

const FieldLabel: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  required?: boolean;
}> = ({ icon: Icon, children, required }) => (
  <label className="form-label">
    <Icon className="h-3.5 w-3.5 text-slate-400" />
    {children}
    {required && <span className="text-rose-500">*</span>}
  </label>
);

export const WorkModal: React.FC<WorkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  laboursList,
  workSitesList,
  existingWorkCodes = [],
  existingWorkTypes = [],
  onOpenPolevar,
}) => {
  // Main fields: Date is Start Date, plus End Date
  const [date, setDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [workCode, setWorkCode] = useState('');
  const [name, setName] = useState('');
  const [workOrder, setWorkOrder] = useState('');
  const [woDate, setWoDate] = useState('');
  const [contractorAmount, setContractorAmount] = useState<number | ''>('');
  const [status, setStatus] = useState('PENDING');
  const [availableStatuses, setAvailableStatuses] = useState<WorkStatusOption[]>([]);
  const [availableTypes, setAvailableTypes] = useState<WorkStatusOption[]>([]);
  const [gstMillNumber, setGstMillNumber] = useState('');
  const [gstDate, setGstDate] = useState('');
  const [electricalSection, setElectricalSection] = useState('');
  const [typeOfWork, setTypeOfWork] = useState('Wiring & Cabling');
  const [workSiteId, setWorkSiteId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A record with an id is being edited; otherwise initialData only carries presets (e.g. workSiteId)
  const isEditing = Boolean(initialData?.id);

  useEffect(() => {
    if (!isOpen) return;
    setAvailableTypes(getAllWorkTypes([...existingWorkTypes, initialData?.typeOfWork]));
    if (initialData && isEditing) {
      setDate(
        initialData.date
          ? new Date(initialData.date).toISOString().split('T')[0]
          : todayISO()
      );
      setEndDate(
        initialData.endDate
          ? new Date(initialData.endDate).toISOString().split('T')[0]
          : initialData.status === 'COMPLETED'
          ? (initialData.date
              ? new Date(initialData.date).toISOString().split('T')[0]
              : todayISO())
          : ''
      );
      setWorkCode(initialData.workCode || '');
      setName(initialData.name || '');
      setWorkOrder(initialData.workOrder || '');
      setWoDate(
        initialData.woDate
          ? new Date(initialData.woDate).toISOString().split('T')[0]
          : ''
      );
      setContractorAmount(initialData.contractorAmount ?? '');
      setStatus(initialData.status || 'PENDING');
      setAvailableStatuses(getAllWorkStatuses([initialData.status]));
      setGstMillNumber(initialData.gstMillNumber || '');
      setGstDate(
        initialData.gstDate
          ? new Date(initialData.gstDate).toISOString().split('T')[0]
          : ''
      );
      setElectricalSection(initialData.electricalSection || '');
      setTypeOfWork(initialData.typeOfWork || 'Wiring & Cabling');
      setWorkSiteId(initialData.workSiteId || '');
    } else {
      setDate(todayISO());
      setEndDate('');
      // The work code is the client's/department's reference, so it is always typed in
      setWorkCode('');
      setName('');
      setWorkOrder('');
      setWoDate('');
      setContractorAmount('');
      setStatus('PENDING');
      setAvailableStatuses(getAllWorkStatuses());
      setGstMillNumber('');
      setGstDate('');
      const presetSite = workSitesList.find((s) => s.id === initialData?.workSiteId);
      setElectricalSection(presetSite?.section || '');
      setTypeOfWork('Wiring & Cabling');
      setWorkSiteId(presetSite?.id || '');
    }
    setError(null);
    // Only reset when the modal opens or switches record, not when the site list refreshes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isOpen]);

  // Sections used by saved sites; the site list is narrowed to the chosen section
  const siteSections = useMemo(
    () => Array.from(new Set(workSitesList.map((s) => s.section).filter(Boolean) as string[])),
    [workSitesList]
  );
  const sitesInSection = useMemo(
    () =>
      electricalSection
        ? workSitesList.filter((s) => s.section === electricalSection)
        : workSitesList,
    [workSitesList, electricalSection]
  );

  const handleSectionChange = (section: string) => {
    setElectricalSection(section);
    const currentSite = workSitesList.find((s) => s.id === workSiteId);
    if (section && currentSite && currentSite.section !== section) {
      setWorkSiteId('');
    }
  };

  const handleWorkSiteChange = (siteId: string) => {
    setWorkSiteId(siteId);
    const site = workSitesList.find((s) => s.id === siteId);
    if (site?.section) setElectricalSection(site.section);
  };

  // When status becomes COMPLETED or completion stage, automatically set today as the end date
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    const norm = newStatus.toUpperCase();
    if (norm.includes('COMPLET') && !endDate) {
      setEndDate(todayISO());
    }
  };

  const handleAddStatus = (name: string) => {
    saveCustomWorkStatus(name);
    setAvailableStatuses(getAllWorkStatuses([name, initialData?.status]));
    return name;
  };

  const handleDeleteStatus = (id: string) => {
    deleteCustomWorkStatus(id);
    setAvailableStatuses(getAllWorkStatuses([initialData?.status]));
    if (status === id) handleStatusChange(initialData?.status && initialData.status !== id ? initialData.status : 'PENDING');
  };

  const handleDeleteWorkType = (id: string) => {
    deleteCustomWorkType(id);
    setAvailableTypes(getAllWorkTypes([...existingWorkTypes, initialData?.typeOfWork]));
    if (typeOfWork === id) setTypeOfWork('');
  };

  const handleAddWorkType = (name: string) => {
    const saved = saveCustomWorkType(name);
    setAvailableTypes(getAllWorkTypes([...existingWorkTypes, initialData?.typeOfWork, saved]));
    return saved;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workCode.trim() || !name.trim()) {
      setError('Work Code and Work Name are required.');
      return;
    }

    // Check duplicate work code (case-insensitive)
    const trimmedCode = workCode.trim().toUpperCase();
    const isDuplicate = existingWorkCodes.some(
      (c) =>
        c.trim().toUpperCase() === trimmedCode &&
        (!isEditing || initialData?.workCode?.trim().toUpperCase() !== trimmedCode)
    );
    if (isDuplicate) {
      setError(`Work code "${workCode.trim()}" already exists. Please choose a unique work code.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const computedEndDate =
        endDate ||
        (status === 'COMPLETED' ? todayISO() : undefined);

      const payload = {
        date,
        endDate: computedEndDate,
        workCode: workCode.trim(),
        name: name.trim(),
        workOrder: workOrder.trim() || undefined,
        woDate: woDate || undefined,
        contractorAmount: contractorAmount === '' ? 0 : Number(contractorAmount),
        status,
        gstMillNumber: gstMillNumber.trim() || undefined,
        gstDate: gstDate || undefined,
        electricalSection: electricalSection.trim() || undefined,
        typeOfWork: typeOfWork.trim() || undefined,
        workSiteId: workSiteId || undefined,
        // Workers are assigned per day in the Daily Log; existing assignments are left untouched on edit
        ...(isEditing ? {} : { labours: [] }),
        materials: initialData?.materials || [],
        dailyDetails: initialData?.dailyDetails,
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save work entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Work Entry' : 'New Electrical Work Entry'}
      subtitle="Job details, contract information & Polevar material report"
      maxWidth="5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* SECTION 1: MAIN FIELDS */}
        <section>
          <h4 className="form-section-title mb-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <ClipboardList className="h-3.5 w-3.5" />
            </span>
            Work Specifications & Contract Details
          </h4>

          <div className="grid grid-cols-1 gap-x-4 gap-y-4 rounded-xl border border-slate-300 bg-slate-50/50 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
            <div>
              <FieldLabel icon={Hash} required>Work Code</FieldLabel>
              <input
                type="text"
                required
                value={workCode}
                onChange={(e) => setWorkCode(e.target.value)}
                placeholder="Enter work code"
                autoFocus={!isEditing}
                className="form-input font-mono font-semibold"
              />
            </div>

            <div>
              <FieldLabel icon={CalendarDays} required>Start Date</FieldLabel>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <FieldLabel icon={CalendarCheck2}>End Date</FieldLabel>
                {status === 'COMPLETED' && (
                  <span className="mb-1.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    Auto-set on complete
                  </span>
                )}
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`form-input ${
                  status === 'COMPLETED' && endDate ? '!border-emerald-400 !bg-emerald-50/40' : ''
                }`}
              />
            </div>

            <div>
              <FieldLabel icon={Briefcase} required>Work / Job Title</FieldLabel>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 11kV Feeder Line Installation"
                className="form-input"
              />
            </div>

            <SectionSelect
              label="Electrical Section / Division"
              placeholder="All sections"
              value={electricalSection}
              onChange={handleSectionChange}
              knownSections={siteSections}
              allowAdd={false}
            />

            <div>
              <div className="flex items-center justify-between">
                <FieldLabel icon={MapPin}>Work Site</FieldLabel>
                {electricalSection && (
                  <span className="mb-1.5 text-[11px] font-medium text-slate-400">
                    {sitesInSection.length} in section
                  </span>
                )}
              </div>
              <select
                value={workSiteId}
                onChange={(e) => handleWorkSiteChange(e.target.value)}
                className="form-input"
              >
                <option value="">
                  {sitesInSection.length === 0 ? 'No sites in this section' : 'Select work site'}
                </option>
                {sitesInSection.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                    {!electricalSection && site.section ? ` · ${site.section}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <OptionSelect
              label="Status / Stage"
              icon={Flag}
              required
              value={status}
              onChange={handleStatusChange}
              options={availableStatuses}
              onAdd={handleAddStatus}
              onDelete={handleDeleteStatus}
              addOptionLabel="+ Add custom stage…"
              addPlaceholder="e.g. Pole Erection, Testing"
              selectClassName="font-medium"
            />

            <div>
              <FieldLabel icon={IndianRupee}>Contractor Amount</FieldLabel>
              <input
                type="number"
                min="0"
                step="any"
                value={contractorAmount}
                onChange={(e) =>
                  setContractorAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="50000"
                className="form-input"
              />
            </div>

            <div>
              <FieldLabel icon={FileText}>Work Order No (W/O)</FieldLabel>
              <input
                type="text"
                value={workOrder}
                onChange={(e) => setWorkOrder(e.target.value)}
                placeholder="WO/2026/EL-041"
                className="form-input"
              />
            </div>

            <div>
              <FieldLabel icon={CalendarDays}>W/O Date</FieldLabel>
              <input
                type="date"
                value={woDate}
                onChange={(e) => setWoDate(e.target.value)}
                className="form-input"
              />
            </div>

            <OptionSelect
              label="Type of Work"
              icon={Wrench}
              value={typeOfWork}
              onChange={setTypeOfWork}
              options={availableTypes}
              onAdd={handleAddWorkType}
              onDelete={handleDeleteWorkType}
              addOptionLabel="+ Add type of work…"
              addPlaceholder="e.g. Pole Erection & Cabling"
              emptyLabel="Select type of work"
            />

            <div>
              <FieldLabel icon={Receipt}>GST Bill Number</FieldLabel>
              <input
                type="text"
                value={gstMillNumber}
                onChange={(e) => setGstMillNumber(e.target.value)}
                placeholder="GST-BILL-8891"
                className="form-input"
              />
            </div>

            <div>
              <FieldLabel icon={CalendarDays}>GST Date</FieldLabel>
              <input
                type="date"
                value={gstDate}
                onChange={(e) => setGstDate(e.target.value)}
                className="form-input"
              />
            </div>
          </div>
        </section>

        {/* SECTION 2: POLEVAR MATERIALS REPORT */}
        <section className="flex flex-col gap-3 rounded-xl border border-slate-300 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Polevar Materials Report</h4>
              <p className="mt-0.5 text-xs text-slate-500">
                {isEditing
                  ? 'Materials, labour & taken-back items are managed in the Polevar sheet.'
                  : 'Save the work entry first, then open its Polevar sheet to add materials.'}
              </p>
            </div>
          </div>

          {isEditing && initialData && onOpenPolevar && (
            <button
              type="button"
              onClick={() => onOpenPolevar(initialData)}
              className="btn-secondary whitespace-nowrap"
            >
              Open Polevar Sheet
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </section>

        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
          Workers and wages are assigned per day from the work's Daily Work.
        </p>

        {/* Modal Footer */}
        <div className="-mx-6 -mb-6 flex justify-end gap-2.5 border-t border-slate-300 bg-slate-50/60 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary min-w-[140px]">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Saving…' : isEditing ? 'Update Work' : 'Save Work Entry'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
