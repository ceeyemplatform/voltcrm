export interface Labour {
  id: string;
  userId: string;
  name: string;
  address?: string;
  contact?: string;
  category?: string;
  hourlyRate?: number;
  dailyWage?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkSite {
  id: string;
  userId: string;
  name: string;
  section?: string;
  address?: string;
  contact?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  works?: Work[];
  quotations?: Quotation[];
  _count?: {
    works: number;
    quotations: number;
  };
}

export interface WorkLabour {
  id?: string;
  workId?: string;
  labourId?: string;
  labourName: string;
  category?: string;
  wage: number;
}

export interface WorkMaterial {
  id?: string;
  workId?: string;
  materialName: string;
  quantityIssued: number;
  quantityUsed: number;
  variance: number;
  remarks?: string;
}

export interface DailyLabourMember {
  id?: string;
  labourId?: string;
  name: string;
  category?: string;
  hourlyRate?: number;
  hoursWorked?: number;
  wage: number;
  isAdditional?: boolean;
  /** Optional: unset means no payment status was recorded */
  paymentStatus?: PayStatus;
  /** How this worker was paid, when given */
  paymentMode?: string;
}

export type PayStatus = 'paid' | 'pending';

export interface DailyOtherExpense {
  id: string;
  description: string;
  amount: number;
  /** Optional: unset falls back to the day's site expense status */
  paymentStatus?: PayStatus;
  /** How this expense was paid, when given */
  paymentMode?: string;
}

export interface DailyWorkDetail {
  id: string;
  date: string;
  workDone: string;
  labourCount?: number;
  labourDetails?: string;
  labourMembers?: DailyLabourMember[];
  additionalMembersCount?: number;
  totalDailyWage?: number;
  otherExpenses?: DailyOtherExpense[];
  totalOtherExpenses?: number;
  totalDailyCost?: number;
  materialsUsed?: string;
  remarks?: string;
  /** @deprecated single mode/status from before wages and site expenses were tracked apart */
  paymentMode?: string;
  /** @deprecated see paymentMode */
  paymentStatus?: PayStatus;
  /** Mode used to pay the day's wages (optional) */
  wagesPaymentMode?: string;
  /** @deprecated day-level site expense mode/status; items now carry their own */
  otherPaymentMode?: string;
  otherPaymentStatus?: PayStatus;
  /** Set on logs saved with per-worker payment tracking; older logs count as paid */
  paymentTracking?: boolean;
  createdAt?: string;
}

export interface Work {
  id: string;
  userId: string;
  date: string;
  endDate?: string;
  workCode: string;
  name: string;
  workOrder?: string;
  woDate?: string;
  contractorAmount?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
  gstMillNumber?: string;
  gstDate?: string;
  electricalSection?: string;
  typeOfWork?: string;
  workSiteId?: string;
  workSite?: WorkSite;
  labours?: WorkLabour[];
  materials?: WorkMaterial[];
  polevarData?: WorkPolevarData;
  dailyDetails?: DailyWorkDetail[];
  createdAt: string;
  updatedAt: string;
}

export interface PolevarColumn {
  id: string;
  name: string;
  category: 'materials' | 'labour' | 'takenBack';
}

export interface PolevarLocationRow {
  id: string;
  location: string;
  values: Record<string, number | ''>;
}

export interface WorkPolevarData {
  title?: string;
  columns: PolevarColumn[];
  rows: PolevarLocationRow[];
}

export type QuotationItemType = 'BOTH' | 'SUPPLY' | 'LABOUR';

export interface QuotationItem {
  id?: string;
  quotationId?: string;
  description: string;
  unit?: string;
  qty: number;
  rate: number;
  amount: number;
  itemType?: QuotationItemType | string;
  supplyRate?: number;
  labourRate?: number;
}

export interface QuotationPage {
  id: string;
  /** Formatted text as HTML */
  html: string;
}

export interface Quotation {
  id: string;
  userId: string;
  quotationNo: string;
  date: string;
  clientName: string;
  address?: string;
  workSiteId?: string;
  workSite?: WorkSite;
  subtotal: number;
  gstPercent: number;
  total: number;
  /** ITEMS: priced line items (default); WRITTEN: free text pages only */
  kind?: 'ITEMS' | 'WRITTEN' | string;
  /** PAN number printed on the quotation */
  pan?: string | null;
  /** Free text pages, printed after the items */
  pages?: QuotationPage[] | null;
  items?: QuotationItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  userId: string;
  date: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  remarks?: string;
  workId?: string;
  workCode?: string;
  workName?: string;
  personName?: string; // Who given cash / paid by / received from
  paymentMode?: string; // Mode of transaction (Cash, UPI, etc.)
  isFlagged?: boolean; // Orange flag for income
  isPending?: boolean; // Daily log wages not yet paid
  /** Settlement status: income received/to get, expense given/pending; partial when some workers are unpaid */
  paymentStatus?: PayStatus | 'partial';
  /** Amount still owed or still to collect */
  pendingAmount?: number;
  /** For rows built from a work's daily log */
  dailyId?: string;
  dailyPart?: 'wages' | 'other';
  /** Site expense item id within the daily log */
  dailyItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseTotals {
  income: number;
  expense: number;
  balance: number;
  count: number;
}

export interface PolevarRow {
  id: string;
  workId: string;
  workCode: string;
  workName: string;
  workDate: string;
  workStatus: string;
  workSiteId?: string;
  workSiteName: string;
  materialName: string;
  quantityIssued: number;
  quantityUsed: number;
  variance: number;
  remarks?: string;
}

export interface PolevarSheetSummary {
  workId: string;
  workCode: string;
  workName: string;
  workDate: string;
  workStatus: string;
  section: string | null;
  workSiteId: string | null;
  workSiteName: string | null;
  title: string | null;
  locationCount: number;
  itemCount: number;
  totals: { materials: number; labour: number; takenBack: number };
  updatedAt: string;
}

export interface PolevarReportResponse {
  summary: {
    totalRows: number;
    totalIssued: number;
    totalUsed: number;
    totalVariance: number;
  };
  rows: PolevarRow[];
}

export interface DashboardStats {
  cards: {
    totalLabours: number;
    totalWorkSites: number;
    totalWorks: number;
    pendingWorks: number;
    totalQuotationValue: number;
    thisMonthIncome: number;
    thisMonthExpense: number;
    thisMonthProfit: number;
  };
  recentWorks: Work[];
  recentWorkSites?: WorkSite[];
  monthlyFinancials: {
    month: string;
    income: number;
    expense: number;
    profit: number;
  }[];
}

export interface PanEntry {
  id: string;
  pan: string;
  label?: string;
  isDefault?: boolean;
}

/** Company details shown in the header of every print and PDF */
export interface CompanySettings {
  id?: string;
  companyName?: string | null;
  tagline?: string | null;
  regNo?: string | null;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  signatoryName?: string | null;
  /** Logo as a data URL; the default icon is used when empty */
  logo?: string | null;
  pans?: PanEntry[] | null;
}

export interface CloudSyncSettings {
  id?: string;
  userId?: string;
  googleSheetWebhookUrl?: string | null;
  googleSheetUrl?: string | null;
  lastSyncedAt?: string | null;
  autoSync?: boolean;
}

export interface CloudSyncResponse {
  success: boolean;
  lastSyncedAt: string;
  summary: {
    totalWorks: number;
    totalDailyLogs: number;
    totalLabours: number;
    totalSites: number;
    totalPolevarRows: number;
    totalQuotations: number;
    totalExpenses: number;
  };
}

