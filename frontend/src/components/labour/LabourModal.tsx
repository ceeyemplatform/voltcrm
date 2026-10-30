import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Labour } from '../../types';
import { OptionSelect } from '../common/OptionSelect';
import {
  getAllLabourCategories,
  saveCustomLabourCategory,
  deleteCustomLabourCategory,
  WorkStatusOption,
} from '../../lib/statusConfig';

interface LabourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Labour>) => Promise<void>;
  initialData?: Labour | null;
  /** Professions already used by saved workers */
  existingCategories?: string[];
}

export const LabourModal: React.FC<LabourModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingCategories = [],
}) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [category, setCategory] = useState('Electrician');
  const [categoryOptions, setCategoryOptions] = useState<WorkStatusOption[]>([]);
  const [hourlyRate, setHourlyRate] = useState<number | ''>('');
  const [dailyWage, setDailyWage] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCategoryOptions(getAllLabourCategories([...existingCategories, initialData?.category]));
    if (initialData) {
      setName(initialData.name || '');
      setAddress(initialData.address || '');
      setContact(initialData.contact || '');
      setCategory(initialData.category || 'Electrician');
      setHourlyRate(initialData.hourlyRate ?? '');
      setDailyWage(initialData.dailyWage ?? '');
    } else {
      setName('');
      setAddress('');
      setContact('');
      setCategory('Electrician');
      setHourlyRate('');
      setDailyWage('');
    }
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Labour name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        address: address.trim() || undefined,
        contact: contact.trim() || undefined,
        category: category || undefined,
        hourlyRate: hourlyRate === '' ? 0 : Number(hourlyRate),
        dailyWage: dailyWage === '' ? 0 : Number(dailyWage),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save labour record');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = (name: string) => {
    const saved = saveCustomLabourCategory(name);
    setCategoryOptions(getAllLabourCategories([...existingCategories, initialData?.category, saved]));
    return saved;
  };

  const handleDeleteCategory = (name: string) => {
    deleteCustomLabourCategory(name);
    setCategoryOptions(getAllLabourCategories([...existingCategories, initialData?.category]));
    if (category === name) setCategory('Electrician');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Labour Profile' : 'Add New Labour Workforce'}
      subtitle="Worker details, skills classification & standard wage compensation"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="form-label">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Sharma"
              className="form-input"
            />
          </div>

          <OptionSelect
            label="Skill Category"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
            onAdd={handleAddCategory}
            onDelete={handleDeleteCategory}
            addOptionLabel="+ Add profession…"
            addPlaceholder="e.g. Crane Operator"
          />

          <div>
            <label className="form-label">
              Contact / Phone
            </label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="+91 98765 43210"
              className="form-input"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="form-label">
              Address / Town
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Sector 4, Industrial Area, City"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">
              Hourly Rate (₹)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={hourlyRate}
              onChange={(e) =>
                setHourlyRate(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="100"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">
              Daily Wage (₹)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={dailyWage}
              onChange={(e) =>
                setDailyWage(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="800"
              className="form-input"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-300">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Saving...' : initialData ? 'Update Labour' : 'Save Labour'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
