export interface WorkStatusOption {
  id: string;
  label: string;
  isCustom?: boolean;
}

export const DEFAULT_WORK_STATUSES: WorkStatusOption[] = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const STORAGE_KEY = 'elecrm_custom_work_statuses';

export const getCustomWorkStatuses = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveCustomWorkStatus = (name: string): string[] => {
  const trimmed = name.trim();
  if (!trimmed) return getCustomWorkStatuses();

  const current = getCustomWorkStatuses();
  // Check if it already matches default
  const isDefault = DEFAULT_WORK_STATUSES.some(
    (d) =>
      d.id.toLowerCase() === trimmed.toLowerCase() ||
      d.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (isDefault) return current;

  const exists = current.some((s) => s.toLowerCase() === trimmed.toLowerCase());
  if (!exists) {
    const updated = [...current, trimmed];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated;
  }
  return current;
};

export const deleteCustomWorkStatus = (statusToDelete: string): string[] => {
  const current = getCustomWorkStatuses();
  const updated = current.filter(
    (s) => s.toLowerCase() !== statusToDelete.toLowerCase()
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
};

export const formatStatusLabel = (status: string): string => {
  if (!status) return '';
  // If user entered mixed-case with spaces (e.g. "Pole Erection", "Testing & Commissioning"), keep as-is
  if (/[a-z]/.test(status) && (status.includes(' ') || status.includes('&') || status.includes('/'))) {
    return status;
  }
  return status
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

export const getAllWorkStatuses = (
  extraStatuses: (string | undefined | null)[] = []
): WorkStatusOption[] => {
  const custom = getCustomWorkStatuses();
  const options: WorkStatusOption[] = [...DEFAULT_WORK_STATUSES];

  const seen = new Set<string>(
    DEFAULT_WORK_STATUSES.map((d) => d.id.toUpperCase())
  );

  // Add custom stored statuses
  for (const c of custom) {
    const key = c.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      options.push({
        id: c,
        label: formatStatusLabel(c),
        isCustom: true,
      });
    }
  }

  // Add extra statuses from database records
  for (const extra of extraStatuses) {
    if (!extra) continue;
    const key = extra.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      options.push({
        id: extra,
        label: formatStatusLabel(extra),
        isCustom: true,
      });
    }
  }

  return options;
};


// =================== TYPES OF WORK ===================
export const DEFAULT_WORK_TYPES: WorkStatusOption[] = [
  'Wiring & Cabling',
  'Pole Erection',
  'Line Stringing',
  'Transformer Installation',
  'Substation Work',
  'Maintenance & Repair',
].map((t) => ({ id: t, label: t }));

const WORK_TYPES_STORAGE_KEY = 'elecrm_custom_work_types';

export const getCustomWorkTypes = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORK_TYPES_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

export const saveCustomWorkType = (name: string): string => {
  const trimmed = name.trim();
  const current = getCustomWorkTypes();
  const known = [...DEFAULT_WORK_TYPES.map((d) => d.id), ...current];
  const existing = known.find((t) => t.toLowerCase() === trimmed.toLowerCase());
  if (existing || !trimmed) return existing || trimmed;
  try {
    localStorage.setItem(WORK_TYPES_STORAGE_KEY, JSON.stringify([...current, trimmed]));
  } catch {
    // ignore
  }
  return trimmed;
};

/** Defaults + saved custom types + types already used by works */
export const getAllWorkTypes = (extraTypes: (string | undefined | null)[] = []): WorkStatusOption[] => {
  const options: WorkStatusOption[] = [...DEFAULT_WORK_TYPES];
  const seen = new Set(options.map((o) => o.id.toLowerCase()));
  for (const t of [...getCustomWorkTypes(), ...extraTypes]) {
    const trimmed = (t || '').trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      options.push({ id: trimmed, label: trimmed, isCustom: true });
    }
  }
  return options;
};

export const deleteCustomWorkType = (name: string) => {
  const updated = getCustomWorkTypes().filter((t) => t.toLowerCase() !== name.toLowerCase());
  try {
    localStorage.setItem(WORK_TYPES_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
};

// =================== LABOUR SKILL CATEGORIES ===================
export const DEFAULT_LABOUR_CATEGORIES: WorkStatusOption[] = [
  'Electrician',
  'Senior Wireman',
  'Junior Wireman',
  'Helper / Lineman',
  'Cable Jointer',
  'Site Supervisor',
  'Electrical Contractor',
].map((c) => ({ id: c, label: c }));

const LABOUR_CATS_STORAGE_KEY = 'elecrm_custom_labour_categories';

const getCustomLabourCategories = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LABOUR_CATS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

const storeLabourCategories = (items: string[]) => {
  try {
    localStorage.setItem(LABOUR_CATS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

export const saveCustomLabourCategory = (name: string): string => {
  const trimmed = name.trim();
  const current = getCustomLabourCategories();
  const existing = [...DEFAULT_LABOUR_CATEGORIES.map((d) => d.id), ...current].find(
    (c) => c.toLowerCase() === trimmed.toLowerCase()
  );
  if (existing || !trimmed) return existing || trimmed;
  storeLabourCategories([...current, trimmed]);
  return trimmed;
};

export const deleteCustomLabourCategory = (name: string) =>
  storeLabourCategories(getCustomLabourCategories().filter((c) => c.toLowerCase() !== name.toLowerCase()));

/** Defaults + saved custom professions + any already used by workers */
export const getAllLabourCategories = (extra: (string | undefined | null)[] = []): WorkStatusOption[] => {
  const options: WorkStatusOption[] = [...DEFAULT_LABOUR_CATEGORIES];
  const seen = new Set(options.map((o) => o.id.toLowerCase()));
  for (const c of [...getCustomLabourCategories(), ...extra]) {
    const trimmed = (c || '').trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      options.push({ id: trimmed, label: trimmed, isCustom: true });
    }
  }
  return options;
};
