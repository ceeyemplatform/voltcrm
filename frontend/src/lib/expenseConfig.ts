// Configuration & Dynamic Extensible Options for Financial Transactions (Expense Tracker & Work Entry)

export interface OptionItem {
  id: string;
  label: string;
  isCustom?: boolean;
}

export const DEFAULT_PAYMENT_MODES: OptionItem[] = [
  { id: 'Cash', label: 'Cash' },
  { id: 'UPI / GPay', label: 'UPI / GPay / PhonePe' },
  { id: 'Bank Transfer', label: 'Bank Transfer / NEFT / IMPS' },
  { id: 'Cheque', label: 'Cheque' },
];

export const DEFAULT_EXPENSE_CATEGORIES: OptionItem[] = [
  { id: 'Materials & Consumables', label: 'Materials & Consumables' },
  { id: 'Daily Labour Advance', label: 'Daily Labour Advance / Wages' },
  { id: 'Subcontractor Bill', label: 'Subcontractor Bill' },
  { id: 'Diesel & Generator Fuel', label: 'Diesel & Generator Fuel' },
  { id: 'Tools & Equipment Rental', label: 'Tools & Equipment Rental' },
  { id: 'Vehicle & Transport', label: 'Vehicle & Transport' },
  { id: 'Site Tea & Refreshments', label: 'Site Tea & Refreshments' },
  { id: 'Permits & Electricity Board Fees', label: 'Permits & EB Fees' },
  { id: 'Office & Admin', label: 'Office & Admin' },
  { id: 'Miscellaneous Expense', label: 'Miscellaneous Expense' },
];

export const DEFAULT_INCOME_CATEGORIES: OptionItem[] = [
  { id: 'Client Advance', label: 'Client Advance' },
  { id: 'Milestone / Running Bill', label: 'Milestone / Running Bill' },
  { id: 'Final Work Settlement', label: 'Final Work Settlement' },
  { id: 'Retention Money Release', label: 'Retention Money Release' },
  { id: 'Design & Consultation Fee', label: 'Design & Consultation Fee' },
  { id: 'Miscellaneous Income', label: 'Miscellaneous Income' },
];

const MODES_STORAGE_KEY = 'elecrm_custom_payment_modes';
const EXPENSE_CATS_STORAGE_KEY = 'elecrm_custom_expense_categories';
const INCOME_CATS_STORAGE_KEY = 'elecrm_custom_income_categories';

function getStored(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStored(key: string, items: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore
  }
}

// =================== PAYMENT MODES ===================
export const getCustomPaymentModes = (): string[] => getStored(MODES_STORAGE_KEY);

export const saveCustomPaymentMode = (name: string): string[] => {
  const trimmed = name.trim();
  if (!trimmed) return getCustomPaymentModes();
  const current = getCustomPaymentModes();
  const isDefault = DEFAULT_PAYMENT_MODES.some(
    (d) => d.id.toLowerCase() === trimmed.toLowerCase() || d.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (isDefault) return current;
  if (!current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    const updated = [...current, trimmed];
    saveStored(MODES_STORAGE_KEY, updated);
    return updated;
  }
  return current;
};

export const deleteCustomPaymentMode = (name: string): string[] => {
  const current = getCustomPaymentModes();
  const updated = current.filter((c) => c.toLowerCase() !== name.toLowerCase());
  saveStored(MODES_STORAGE_KEY, updated);
  return updated;
};

export const getAllPaymentModes = (extraModes: (string | undefined | null)[] = []): OptionItem[] => {
  const custom = getCustomPaymentModes();
  const options: OptionItem[] = [...DEFAULT_PAYMENT_MODES];
  const seen = new Set<string>(DEFAULT_PAYMENT_MODES.map((d) => d.id.toLowerCase()));

  for (const c of custom) {
    if (!seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase());
      options.push({ id: c, label: c, isCustom: true });
    }
  }

  for (const extra of extraModes) {
    if (extra && !seen.has(extra.toLowerCase())) {
      seen.add(extra.toLowerCase());
      options.push({ id: extra, label: extra, isCustom: true });
    }
  }

  return options;
};

// =================== EXPENSE CATEGORIES ===================
export const getCustomExpenseCategories = (): string[] => getStored(EXPENSE_CATS_STORAGE_KEY);

export const saveCustomExpenseCategory = (name: string): string[] => {
  const trimmed = name.trim();
  if (!trimmed) return getCustomExpenseCategories();
  const current = getCustomExpenseCategories();
  const isDefault = DEFAULT_EXPENSE_CATEGORIES.some(
    (d) => d.id.toLowerCase() === trimmed.toLowerCase() || d.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (isDefault) return current;
  if (!current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    const updated = [...current, trimmed];
    saveStored(EXPENSE_CATS_STORAGE_KEY, updated);
    return updated;
  }
  return current;
};

export const deleteCustomExpenseCategory = (name: string): string[] => {
  const current = getCustomExpenseCategories();
  const updated = current.filter((c) => c.toLowerCase() !== name.toLowerCase());
  saveStored(EXPENSE_CATS_STORAGE_KEY, updated);
  return updated;
};

export const getAllExpenseCategories = (extraCats: (string | undefined | null)[] = []): OptionItem[] => {
  const custom = getCustomExpenseCategories();
  const options: OptionItem[] = [...DEFAULT_EXPENSE_CATEGORIES];
  const seen = new Set<string>(DEFAULT_EXPENSE_CATEGORIES.map((d) => d.id.toLowerCase()));

  for (const c of custom) {
    if (!seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase());
      options.push({ id: c, label: c, isCustom: true });
    }
  }

  for (const extra of extraCats) {
    if (extra && !seen.has(extra.toLowerCase())) {
      seen.add(extra.toLowerCase());
      options.push({ id: extra, label: extra, isCustom: true });
    }
  }

  return options;
};

// =================== INCOME CATEGORIES ===================
export const getCustomIncomeCategories = (): string[] => getStored(INCOME_CATS_STORAGE_KEY);

export const saveCustomIncomeCategory = (name: string): string[] => {
  const trimmed = name.trim();
  if (!trimmed) return getCustomIncomeCategories();
  const current = getCustomIncomeCategories();
  const isDefault = DEFAULT_INCOME_CATEGORIES.some(
    (d) => d.id.toLowerCase() === trimmed.toLowerCase() || d.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (isDefault) return current;
  if (!current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    const updated = [...current, trimmed];
    saveStored(INCOME_CATS_STORAGE_KEY, updated);
    return updated;
  }
  return current;
};

export const deleteCustomIncomeCategory = (name: string): string[] => {
  const current = getCustomIncomeCategories();
  const updated = current.filter((c) => c.toLowerCase() !== name.toLowerCase());
  saveStored(INCOME_CATS_STORAGE_KEY, updated);
  return updated;
};

export const getAllIncomeCategories = (extraCats: (string | undefined | null)[] = []): OptionItem[] => {
  const custom = getCustomIncomeCategories();
  const options: OptionItem[] = [...DEFAULT_INCOME_CATEGORIES];
  const seen = new Set<string>(DEFAULT_INCOME_CATEGORIES.map((d) => d.id.toLowerCase()));

  for (const c of custom) {
    if (!seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase());
      options.push({ id: c, label: c, isCustom: true });
    }
  }

  for (const extra of extraCats) {
    if (extra && !seen.has(extra.toLowerCase())) {
      seen.add(extra.toLowerCase());
      options.push({ id: extra, label: extra, isCustom: true });
    }
  }

  return options;
};

