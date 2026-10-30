import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Work } from '../../types';
import {
  getAllWorkStatuses,
  saveCustomWorkStatus,
  deleteCustomWorkStatus,
  WorkStatusOption,
} from '../../lib/statusConfig';
import { StatusBadge } from '../common/Badges';
import { Plus, Check, Trash2 } from 'lucide-react';
import { confirmDelete } from '../common/ConfirmHost';

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  work: Work | null;
  onSaveStatus: (workId: string, newStatus: string) => Promise<void>;
}

export const StatusChangeModal: React.FC<StatusChangeModalProps> = ({
  isOpen,
  onClose,
  work,
  onSaveStatus,
}) => {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [availableStatuses, setAvailableStatuses] = useState<WorkStatusOption[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (work && isOpen) {
      setSelectedStatus(work.status);
      setAvailableStatuses(getAllWorkStatuses([work.status]));
      setIsAdding(false);
      setNewStageName('');
    }
  }, [work, isOpen]);

  if (!work) return null;

  const handleAddNewStage = () => {
    const trimmed = newStageName.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    saveCustomWorkStatus(trimmed);
    const updated = getAllWorkStatuses([trimmed, work.status]);
    setAvailableStatuses(updated);
    setSelectedStatus(trimmed);
    setNewStageName('');
    setIsAdding(false);
  };

  const handleDeleteCustomStage = async (e: React.MouseEvent, stageId: string) => {
    e.stopPropagation();
    if (!(await confirmDelete(`Remove the stage "${stageId}" from the list? Works already in this stage keep it.`, { title: 'Remove stage', confirmText: 'Remove' }))) return;
    deleteCustomWorkStatus(stageId);
    const updated = getAllWorkStatuses([work.status]);
    setAvailableStatuses(updated);
    if (selectedStatus === stageId) {
      setSelectedStatus('PENDING');
    }
  };

  const handleConfirm = async () => {
    if (!selectedStatus) return;
    setLoading(true);
    try {
      await onSaveStatus(work.id, selectedStatus);
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to update work status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Status / Stage"
      subtitle={`Set operational stage for ${work.workCode} - ${work.name}`}
      maxWidth="md"
    >
      <div className="space-y-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Current Stage
          </span>
          <div className="flex items-center space-x-2">
            <StatusBadge status={work.status} />
            <span className="text-xs text-slate-500 font-mono">
              ({work.workCode})
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">
              Select Stage or Add Custom Stage
            </span>
            {!isAdding && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Stage</span>
              </button>
            )}
          </div>

          {isAdding && (
            <div className="mb-3 flex items-center space-x-1.5 p-2 bg-blue-50/70 rounded-xl border border-blue-200 animate-in fade-in">
              <input
                type="text"
                autoFocus
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNewStage();
                  } else if (e.key === 'Escape') {
                    setIsAdding(false);
                    setNewStageName('');
                  }
                }}
                placeholder="e.g. Pole Erection, Testing, Stringing..."
                className="block w-full rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddNewStage}
                className="btn-primary shrink-0"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewStageName('');
                }}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition shrink-0 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {availableStatuses.map((opt) => {
              const isSelected = selectedStatus === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setSelectedStatus(opt.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/70 shadow-2xs'
                      : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-800">
                        {opt.label}
                      </span>
                      {opt.isCustom && (
                        <span className="ml-2 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          Custom
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <StatusBadge status={opt.id} />
                    {opt.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustomStage(e, opt.id)}
                        title="Remove custom stage"
                        className="p-1 text-slate-300 hover:text-rose-600 rounded transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-300">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || selectedStatus === work.status}
            onClick={handleConfirm}
            className="btn-primary"
          >
            {loading ? 'Updating...' : 'Apply Stage'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

