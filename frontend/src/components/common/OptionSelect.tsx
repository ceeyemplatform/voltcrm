import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { PickList } from './PickList';

export interface SelectOption {
  id: string;
  label: string;
  isCustom?: boolean;
}

interface OptionSelectProps {
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Saves a new option and returns the id to select */
  onAdd: (name: string) => string;
  addPlaceholder?: string;
  /** Removes a custom option (asked to confirm first); each custom option gets a delete button */
  onDelete?: (id: string) => void;
  /** Label of the "add new" entry at the end of the list */
  addOptionLabel?: string;
  /** Shown as an empty first option when set */
  emptyLabel?: string;
  selectClassName?: string;
}

/** Dropdown with an "+ Add" link for new options, styled like the payment mode picker. */
export const OptionSelect: React.FC<OptionSelectProps> = ({
  label,
  icon: Icon,
  required,
  value,
  onChange,
  options,
  onAdd,
  onDelete,
  addOptionLabel = '+ Add new…',
  addPlaceholder = 'New option',
  emptyLabel,
  selectClassName = '',
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const cancel = () => {
    setIsAdding(false);
    setDraft('');
  };

  const commit = () => {
    const trimmed = draft.trim();
    cancel();
    if (!trimmed) return;
    const existing = options.find(
      (o) => o.id.toLowerCase() === trimmed.toLowerCase() || o.label.toLowerCase() === trimmed.toLowerCase()
    );
    onChange(existing ? existing.id : onAdd(trimmed));
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="form-label">
          {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      {isAdding ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                cancel();
              }
            }}
            placeholder={addPlaceholder}
            className="form-input"
          />
          <button type="button" onClick={commit} className="btn-primary h-[38px] w-[38px] flex-shrink-0 !px-0" title="Add">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" onClick={cancel} className="btn-secondary h-[38px] w-[38px] flex-shrink-0 !px-0" title="Cancel">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <PickList
          value={value}
          options={options}
          onChange={onChange}
          onAdd={onAdd}
          onDelete={onDelete}
          emptyLabel={emptyLabel}
          placeholder={emptyLabel || 'Select…'}
          addLabel={addOptionLabel}
          addPlaceholder={addPlaceholder}
          className={selectClassName}
        />
      )}
    </div>
  );
};
