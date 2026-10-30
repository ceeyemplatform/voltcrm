import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { CompanySettings, PanEntry } from '../types';
import { useAuth } from './AuthContext';

/** Shown until the user saves their own company details */
export const DEFAULT_COMPANY: CompanySettings = {
  companyName: 'POWERVOLT ELECTRICAL CONTRACTORS',
  tagline: 'Govt. Licensed Electrical Contractors & Engineers | HT/LT Line Work & Substations',
  regNo: 'EC-IND-49201',
  gstin: '27AABCP1234F1Z8',
  phone: '+91 98765 43210',
  email: '',
  address: '',
  signatoryName: '',
  logo: null,
  pans: [],
};

interface CompanyContextValue {
  /** Saved details, or the defaults when nothing has been saved */
  company: CompanySettings;
  pans: PanEntry[];
  defaultPan?: PanEntry;
  save: (data: Partial<CompanySettings>) => Promise<CompanySettings>;
  /** Adds a PAN to the saved list (no-op when already there) and returns it */
  addPan: (pan: string) => Promise<string>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY);

  useEffect(() => {
    if (!session) {
      setCompany(DEFAULT_COMPANY);
      return;
    }
    api.companySettings
      .get()
      .then((saved) => setCompany(saved?.id ? saved : DEFAULT_COMPANY))
      .catch(() => setCompany(DEFAULT_COMPANY));
  }, [session]);

  const save = useCallback(async (data: Partial<CompanySettings>) => {
    const saved = await api.companySettings.update(data);
    setCompany(saved);
    return saved;
  }, []);

  const pans = useMemo(() => (Array.isArray(company.pans) ? company.pans : []), [company.pans]);

  const addPan = useCallback(
    async (raw: string) => {
      const pan = raw.trim().toUpperCase();
      if (!pan || pans.some((p) => p.pan === pan)) return pan;
      const id = crypto.randomUUID ? crypto.randomUUID() : `pan_${Date.now()}`;
      // The first saved PAN becomes the default; header fields are saved too so defaults stick
      await save({
        ...(company.id ? {} : DEFAULT_COMPANY),
        logo: company.logo || '',
        pans: [...pans, { id, pan, label: '', isDefault: pans.length === 0 }],
      });
      return pan;
    },
    [company, pans, save]
  );

  return (
    <CompanyContext.Provider value={{ company, pans, defaultPan: pans.find((p) => p.isDefault), save, addPan }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within a CompanyProvider');
  return ctx;
};
