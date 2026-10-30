// Electrical sections / divisions shared by work sites and work entries.
// Custom sections are remembered in localStorage until a site uses them,
// after which they also come back from the saved work sites.

/** No built-in sections: the list holds the ones the user adds and those used by sites */
export const DEFAULT_SECTIONS: string[] = [];

const STORAGE_KEY = 'elecrm.customSections';

export const getCustomSections = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

export const addCustomSection = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = getCustomSections();
  if (current.includes(trimmed)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, trimmed]));
  } catch {
    // Storage unavailable; the section still lives in component state
  }
};

/** Defaults + saved custom sections + any extra (e.g. sections used by sites), de-duplicated. */
export const buildSectionList = (...extra: (string | null | undefined)[][]): string[] =>
  Array.from(
    new Set(
      [...DEFAULT_SECTIONS, ...getCustomSections(), ...extra.flat()]
        .map((s) => (s || '').trim())
        .filter(Boolean)
    )
  );
