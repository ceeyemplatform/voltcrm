import React, { useMemo, useState } from 'react';
import { Check, Layers, Plus, X } from 'lucide-react';
import { addCustomSection, buildSectionList } from '../../lib/sections';

interface SectionSelectProps {
  value: string;
  onChange: (section: string) => void;
  /** Sections already used by saved records, merged with the defaults */
  knownSections?: string[];
  label?: string;
  placeholder?: string;
  /** Show the "add new section" link and option */
  allowAdd?: boolean;
}

const NO_SECTIONS: string[] = [];

/** Electrical section dropdown with an inline "add new section" input. */
export const SectionSelect: React.FC<SectionSelectProps> = ({
  value,
  onChange,
  knownSections = NO_SECTIONS,
  label = 'Electrical Section',
  placeholder = 'Select a section',
  allowAdd = true,
}) => {
  const [added, setAdded] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const options = useMemo(
    () => buildSectionList(knownSections, added, [value]),
    [knownSections, added, value]
  );

  const startAdding = () => {
    setDraft('');
    setIsAdding(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    setIsAdding(false);
    setDraft('');
    if (!trimmed) return;
    const existing = options.find((s) => s.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      addCustomSection(trimmed);
      setAdded((prev) => [...prev, trimmed]);
    }
    onChange(existing || trimmed);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="form-label">
          <Layers className="h-3.5 w-3.5 text-slate-400" />
          {label}
        </label>
        {allowAdd && !isAdding && (
          <button
            type="button"
            onClick={startAdding}
            className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add section
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
                setIsAdding(false);
              }
            }}
            placeholder="New section name"
            className="form-input"
          />
          <button
            type="button"
            onClick={commit}
            className="btn-primary h-[38px] w-[38px] flex-shrink-0 !px-0"
            title="Add section"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className="btn-secondary h-[38px] w-[38px] flex-shrink-0 !px-0"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === '__ADD_NEW__') startAdding();
            else onChange(e.target.value);
          }}
          className="form-input"
        >
          <option value="">{placeholder}</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {allowAdd && <option value="__ADD_NEW__">+ Add new section…</option>}
        </select>
      )}
    </div>
  );
};
