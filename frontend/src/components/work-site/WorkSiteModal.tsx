import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  UserRound,
  StickyNote,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { WorkSite } from '../../types';
import { SectionSelect } from '../common/SectionSelect';

interface WorkSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<WorkSite>) => Promise<void>;
  initialData?: WorkSite | null;
  existingSections?: string[];
}

const NO_SECTIONS: string[] = [];

export const WorkSiteModal: React.FC<WorkSiteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingSections = NO_SECTIONS,
}) => {
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form only when the modal opens or switches record
  useEffect(() => {
    if (!isOpen) return;
    setName(initialData?.name || '');
    setSection(initialData?.section || '');
    setAddress(initialData?.address || '');
    setContact(initialData?.contact || '');
    setNote(initialData?.note || '');
    setError(null);
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Work name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        section: section.trim() || undefined,
        address: address.trim() || undefined,
        contact: contact.trim() || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save work site');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Work Site' : 'Register New Work Site'}
      subtitle="Client location, site in-charge contact & site specifications"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label className="form-label">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            Work Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Apex Tech Park Substation 33kV"
            className="form-input"
          />
        </div>

        <SectionSelect
          value={section}
          onChange={setSection}
          knownSections={existingSections}
        />

        <div>
          <label className="form-label">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            Location
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Plot 14, Phase II Industrial Zone"
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">
            <UserRound className="h-3.5 w-3.5 text-slate-400" />
            Site Contact / In-charge
          </label>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Engineer Verma (+91 98220 11223)"
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">
            <StickyNote className="h-3.5 w-3.5 text-slate-400" />
            Site Notes & Special Instructions
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Permit required for HT work; safety helmet & boots mandatory"
            className="form-input resize-none"
          />
        </div>

        <div className="-mx-6 -mb-6 mt-2 flex justify-end gap-2.5 border-t border-slate-300 bg-slate-50/60 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary min-w-[110px]">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Saving…' : initialData ? 'Update Site' : 'Save Site'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
