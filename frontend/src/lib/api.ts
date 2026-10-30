import { supabase } from './supabase';
import {
  Labour,
  WorkSite,
  Work,
  Quotation,
  Expense,
  ExpenseTotals,
  PolevarReportResponse,
  PolevarSheetSummary,
  WorkPolevarData,
  DashboardStats,
  CloudSyncSettings,
  CompanySettings,
  CloudSyncResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.message) {
        errorMsg = Array.isArray(errorJson.message)
          ? errorJson.message.join(', ')
          : errorJson.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Labours API
export const api = {
  labours: {
    list: (search?: string) =>
      fetchWithAuth<Labour[]>(`/labours${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    get: (id: string) => fetchWithAuth<Labour>(`/labours/${id}`),
    create: (data: Partial<Labour>) =>
      fetchWithAuth<Labour>('/labours', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Labour>) =>
      fetchWithAuth<Labour>(`/labours/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchWithAuth<void>(`/labours/${id}`, {
        method: 'DELETE',
      }),
  },

  workSites: {
    list: (search?: string) =>
      fetchWithAuth<WorkSite[]>(`/work-sites${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    get: (id: string) => fetchWithAuth<WorkSite>(`/work-sites/${id}`),
    create: (data: Partial<WorkSite>) =>
      fetchWithAuth<WorkSite>('/work-sites', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<WorkSite>) =>
      fetchWithAuth<WorkSite>(`/work-sites/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchWithAuth<void>(`/work-sites/${id}`, {
        method: 'DELETE',
      }),
  },

  works: {
    list: (filters?: {
      search?: string;
      status?: string;
      workSiteId?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.search) params.append('search', filters.search);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.workSiteId) params.append('workSiteId', filters.workSiteId);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      const q = params.toString();
      return fetchWithAuth<Work[]>(`/works${q ? `?${q}` : ''}`);
    },
    get: (id: string) => fetchWithAuth<Work>(`/works/${id}`),
    create: (data: any) =>
      fetchWithAuth<Work>('/works', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      fetchWithAuth<Work>(`/works/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchWithAuth<void>(`/works/${id}`, {
        method: 'DELETE',
      }),
    getPolevar: (id: string) =>
      fetchWithAuth<WorkPolevarData>(`/works/${id}/polevar`),
    updatePolevar: (id: string, data: WorkPolevarData) =>
      fetchWithAuth<WorkPolevarData>(`/works/${id}/polevar`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    updateDailyDetails: (id: string, dailyDetails: any[]) =>
      fetchWithAuth<Work>(`/works/${id}/daily-details`, {
        method: 'PUT',
        body: JSON.stringify({ dailyDetails }),
      }),
    options: () =>
      fetchWithAuth<Array<{ id: string; workCode: string; name: string; workSite?: { name: string } }>>('/works/options'),
  },

  quotations: {
    list: (search?: string) =>
      fetchWithAuth<Quotation[]>(`/quotations${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    get: (id: string) => fetchWithAuth<Quotation>(`/quotations/${id}`),
    create: (data: any) =>
      fetchWithAuth<Quotation>('/quotations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      fetchWithAuth<Quotation>(`/quotations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchWithAuth<void>(`/quotations/${id}`, {
        method: 'DELETE',
      }),
  },

  expenses: {
    summary: (filters?: {
      startDate?: string;
      endDate?: string;
      type?: string;
      category?: string;
      search?: string;
      workId?: string;
      workCode?: string;
      paymentMode?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.workId) params.append('workId', filters.workId);
      if (filters?.workCode) params.append('workCode', filters.workCode);
      if (filters?.paymentMode) params.append('paymentMode', filters.paymentMode);
      const q = params.toString();
      return fetchWithAuth<{
        items: (Expense & { isDailyWorkEntry?: boolean })[];
        works: Array<{ id: string; workCode: string; name: string; siteName?: string; siteId?: string; section?: string }>;
        totals: {
          count: number;
          incomeReceived: number;
          incomeToGet: number;
          expenseOutflow: number;
          netCashBalance: number;
        };
      }>(`/expenses/summary${q ? `?${q}` : ''}`);
    },
    list: (filters?: {
      startDate?: string;
      endDate?: string;
      type?: string;
      category?: string;
      search?: string;
      workId?: string;
      workCode?: string;
      paymentMode?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.workId) params.append('workId', filters.workId);
      if (filters?.workCode) params.append('workCode', filters.workCode);
      if (filters?.paymentMode) params.append('paymentMode', filters.paymentMode);
      const q = params.toString();
      return fetchWithAuth<Expense[]>(`/expenses${q ? `?${q}` : ''}`);
    },
    totals: (filters?: {
      startDate?: string;
      endDate?: string;
      type?: string;
      category?: string;
      search?: string;
      workId?: string;
      workCode?: string;
      paymentMode?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.workId) params.append('workId', filters.workId);
      if (filters?.workCode) params.append('workCode', filters.workCode);
      if (filters?.paymentMode) params.append('paymentMode', filters.paymentMode);
      const q = params.toString();
      return fetchWithAuth<ExpenseTotals>(`/expenses/totals${q ? `?${q}` : ''}`);
    },
    get: (id: string) => fetchWithAuth<Expense>(`/expenses/${id}`),
    create: (data: Partial<Expense>) =>
      fetchWithAuth<Expense>('/expenses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Expense>) =>
      fetchWithAuth<Expense>(`/expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchWithAuth<void>(`/expenses/${id}`, {
        method: 'DELETE',
      }),
  },

  polevar: {
    getSheets: (filters?: { workSiteId?: string; section?: string; search?: string }) => {
      const params = new URLSearchParams();
      if (filters?.workSiteId) params.append('workSiteId', filters.workSiteId);
      if (filters?.section) params.append('section', filters.section);
      if (filters?.search) params.append('search', filters.search);
      const q = params.toString();
      return fetchWithAuth<PolevarSheetSummary[]>(`/polevar/sheets${q ? `?${q}` : ''}`);
    },
    getReport: (filters?: {
      startDate?: string;
      endDate?: string;
      workCode?: string;
      workSiteId?: string;
      search?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.workCode) params.append('workCode', filters.workCode);
      if (filters?.workSiteId) params.append('workSiteId', filters.workSiteId);
      if (filters?.search) params.append('search', filters.search);
      const q = params.toString();
      return fetchWithAuth<PolevarReportResponse>(`/polevar/report${q ? `?${q}` : ''}`);
    },
  },

  dashboard: {
    stats: () => fetchWithAuth<DashboardStats>('/dashboard/stats'),
  },

  companySettings: {
    get: () => fetchWithAuth<CompanySettings>('/company-settings'),
    update: (data: Partial<CompanySettings>) =>
      fetchWithAuth<CompanySettings>('/company-settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  cloudSync: {
    getSettings: () => fetchWithAuth<CloudSyncSettings>('/cloud-sync/settings'),
    updateSettings: (data: {
      googleSheetWebhookUrl?: string;
      googleSheetUrl?: string;
      autoSync?: boolean;
    }) =>
      fetchWithAuth<CloudSyncSettings>('/cloud-sync/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    push: (webhookUrl?: string) =>
      fetchWithAuth<CloudSyncResponse>('/cloud-sync/push', {
        method: 'POST',
        body: JSON.stringify({ webhookUrl }),
      }),
    getTemplate: () => fetchWithAuth<{ template: string }>('/cloud-sync/template'),
  },
};

