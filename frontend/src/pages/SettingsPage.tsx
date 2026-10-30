import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Plus, Save, Star, Trash2, Zap } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { PrintHeader } from '../components/common/PrintHeader';
import { confirmDelete } from '../components/common/ConfirmHost';
import { useCompany } from '../context/CompanyContext';
import { CompanySettings, PanEntry } from '../types';

const TEXT_FIELDS: {
  key: keyof CompanySettings;
  label: string;
  placeholder: string;
  wide?: boolean;
  type?: 'text' | 'email';
}[] = [
  { key: 'companyName', label: 'Company name', placeholder: 'e.g. Powervolt Electrical Contractors', wide: true },
  { key: 'tagline', label: 'Tagline', placeholder: 'e.g. Govt. Licensed Electrical Contractors', wide: true },
  { key: 'address', label: 'Address', placeholder: 'Office address', wide: true },
  { key: 'regNo', label: 'Reg. No', placeholder: 'e.g. EC-IND-49201' },
  { key: 'gstin', label: 'GSTIN', placeholder: 'e.g. 27AABCP1234F1Z8' },
  { key: 'phone', label: 'Contact', placeholder: 'e.g. +91 98765 43210' },
  { key: 'email', label: 'Email', placeholder: 'e.g. office@company.com', type: 'email' },
  { key: 'signatoryName', label: 'Signature name ("For ______")', placeholder: 'Defaults to the company name' },
];

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `pan_${Date.now()}_${Math.random()}`);

/** Shrinks an uploaded logo so it stays small in the database and in PDFs. */
const readLogo = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('This file is not a supported image'));
      img.onload = () => {
        const scale = Math.min(1, 400 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

export const SettingsPage: React.FC = () => {
  const { company, save } = useCompany();
  const [form, setForm] = useState<CompanySettings>(company);
  const [pans, setPans] = useState<PanEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Refill when the saved settings arrive or change
  useEffect(() => {
    setForm(company);
    setPans(Array.isArray(company.pans) ? company.pans.map((p) => ({ ...p })) : []);
  }, [company]);

  const setField = (key: keyof CompanySettings, value: string | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  const handleLogo = async (file?: File) => {
    if (!file) return;
    try {
      setField('logo', await readLogo(file));
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || 'Could not use this image' });
    }
  };

  const updatePan = (id: string, patch: Partial<PanEntry>) => {
    setPans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setMessage(null);
  };

  const makeDefault = (id: string) => {
    setPans((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));
    setMessage(null);
  };

  const removePan = async (entry: PanEntry) => {
    if (!(await confirmDelete(`Remove PAN ${entry.pan || '(empty)'} from the list?`, { confirmText: 'Remove' }))) return;
    setPans((prev) => {
      const next = prev.filter((p) => p.id !== entry.id);
      // Keep a default while any PAN is left
      if (entry.isDefault && next.length > 0) next[0] = { ...next[0], isDefault: true };
      return next;
    });
    setMessage(null);
  };

  const handleSave = async () => {
    const cleaned = pans
      .map((p) => ({ ...p, pan: p.pan.trim().toUpperCase(), label: (p.label || '').trim() }))
      .filter((p) => p.pan);
    const email = (form.email || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage({ ok: false, text: `"${email}" is not a valid email address.` });
      return;
    }
    const invalid = cleaned.find((p) => !PAN_PATTERN.test(p.pan));
    if (invalid) {
      setMessage({ ok: false, text: `"${invalid.pan}" is not a valid PAN (format: ABCDE1234F).` });
      return;
    }
    if (cleaned.length > 0 && !cleaned.some((p) => p.isDefault)) cleaned[0].isDefault = true;

    setSaving(true);
    setMessage(null);
    try {
      await save({
        companyName: form.companyName || '',
        tagline: form.tagline || '',
        regNo: form.regNo || '',
        gstin: form.gstin || '',
        phone: form.phone || '',
        email: form.email || '',
        address: form.address || '',
        signatoryName: form.signatoryName || '',
        logo: form.logo || '',
        pans: cleaned,
      });
      setMessage({ ok: true, text: 'Saved. All prints and PDFs now use these details.' });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Print Header"
        subtitle="Company details, logo and PAN numbers used on every print and PDF"
        primaryAction={{ label: saving ? 'Saving…' : 'Save', onClick: handleSave, icon: saving ? Loader2 : Save }}
      />

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            message.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {message.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Live preview */}
      <div className="card p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
        <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white p-5">
          <PreviewHeader form={form} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Company details */}
        <div className="card space-y-4 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900">Company details</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.map((f) => (
              <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
                <label className="form-label">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  value={(form[f.key] as string) || ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="form-input"
                />
              </div>
            ))}
          </div>
          {!company.id && (
            <p className="text-xs text-slate-500">
              These are sample details. Change them and press Save to use your own.
            </p>
          )}
        </div>

        {/* Logo */}
        <div className="card space-y-4 p-5">
          <h3 className="text-sm font-semibold text-slate-900">Logo</h3>
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            {form.logo ? (
              <img src={form.logo} alt="Logo" className="max-h-24 max-w-[200px] object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Zap className="h-8 w-8 fill-white" />
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {form.logo ? 'Your logo is used on prints.' : 'No logo: the default icon is used.'} PNG, JPG or WebP.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              handleLogo(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary">
              <ImagePlus className="h-4 w-4 text-blue-600" />
              {form.logo ? 'Change logo' : 'Upload logo'}
            </button>
            {form.logo && (
              <button
                type="button"
                onClick={async () => {
                  if (await confirmDelete('Remove the logo? The default icon will be used instead.', { confirmText: 'Remove' }))
                    setField('logo', null);
                }}
                className="btn-secondary hover:!text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PAN numbers */}
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">PAN numbers</h3>
            <p className="text-xs text-slate-500">
              Pick one when creating a quotation. The default one is selected automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPans((prev) => [...prev, { id: newId(), pan: '', label: '', isDefault: prev.length === 0 }])}
            className="btn-secondary"
          >
            <Plus className="h-4 w-4 text-blue-600" />
            Add PAN
          </button>
        </div>

        {pans.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            No PAN numbers saved yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-300 rounded-lg border border-slate-300">
            {pans.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <input
                  type="text"
                  value={p.pan}
                  onChange={(e) => updatePan(p.id, { pan: e.target.value.toUpperCase() })}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="form-input !w-40 font-mono uppercase"
                />
                <input
                  type="text"
                  value={p.label || ''}
                  onChange={(e) => updatePan(p.id, { label: e.target.value })}
                  placeholder="Name (optional), e.g. Firm PAN"
                  className="form-input min-w-[180px] flex-1"
                />
                <button
                  type="button"
                  onClick={() => makeDefault(p.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                    p.isDefault
                      ? 'bg-amber-50 text-amber-700 ring-amber-300'
                      : 'bg-white text-slate-500 ring-slate-300 hover:text-slate-800'
                  }`}
                  title={p.isDefault ? 'Default PAN' : 'Make default'}
                >
                  <Star className={`h-3.5 w-3.5 ${p.isDefault ? 'fill-amber-400' : ''}`} />
                  {p.isDefault ? 'Default' : 'Make default'}
                </button>
                <button
                  type="button"
                  onClick={() => removePan(p)}
                  className="btn-icon hover:!bg-rose-50 hover:!text-rose-600"
                  title="Remove PAN"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** Header preview built from the unsaved form values */
const PreviewHeader: React.FC<{ form: CompanySettings }> = ({ form }) => (
  <PrintHeader title="QUOTATION" referenceNo="QT-0001" date={new Date().toISOString()} preview={form} />
);

