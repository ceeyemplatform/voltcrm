import React, { useEffect, useState } from 'react';
import {
  Users,
  MapPin,
  Briefcase,
  Clock,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  RefreshCw,
  AlertCircle,
  Plus,
  Building2,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { WorkSite, DashboardStats, Work } from '../types';
import { StatCard } from '../components/common/StatCard';
import { FinancialChart } from '../components/dashboard/FinancialChart';
import { PrintHeader } from '../components/common/PrintHeader';
import { WorkPrintView } from '../components/work/WorkPrintView';
import { PageHeader } from '../components/common/PageHeader';
import { StatusBadge } from '../components/common/Badges';
import { Skeleton } from '../components/common/Skeleton';
import { cashTotals, CashTotals } from '../lib/payments';

interface DashboardPageProps {
  onNavigateToWorks: () => void;
  onNavigateToWorkSites: (siteId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToWorks,
  onNavigateToWorkSites,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSites, setRecentSites] = useState<WorkSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkForPrint, setSelectedWorkForPrint] = useState<Work | null>(null);
  const [cash, setCash] = useState<CashTotals | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.dashboard.stats();
      setStats(data);
      if (data.recentWorkSites && data.recentWorkSites.length > 0) {
        setRecentSites(data.recentWorkSites.slice(0, 5));
      } else {
        // Fallback fetch
        try {
          const siteList = await api.workSites.list();
          setRecentSites(siteList.slice(0, 5));
        } catch {}
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const loadCash = () => {
    api.expenses
      .summary()
      .then((d) => setCash(cashTotals(d.items)))
      .catch(() => {});
  };

  useEffect(() => {
    loadStats();
    loadCash();
  }, []);

  const totalWorks = stats?.cards.totalWorks ?? 0;
  const pendingWorks = stats?.cards.pendingWorks ?? 0;
  const totalSites = stats?.cards.totalWorkSites ?? 0;
  const totalLabours = stats?.cards.totalLabours ?? 0;

  const isInitialLoad = loading && !stats;

  const ListSkeleton = () => (
    <div className="divide-y divide-slate-300">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );

  const EmptyState = ({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) => (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Contracts, active jobs, manpower and this month's earnings at a glance."
        secondaryActions={
          <button
            type="button"
            onClick={() => {
              loadStats();
              loadCash();
            }}
            disabled={loading}
            className="btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
        primaryAction={{
          label: 'New Work Entry',
          onClick: onNavigateToWorks,
          icon: Plus,
        }}
      />

      {/* Print Only Header */}
      <div className="print-only">
        <PrintHeader
          title="EXECUTIVE OPERATIONS & FINANCIAL SUMMARY"
          date={new Date().toISOString()}
          subtitle="Monthly overview of active contracts, workforce allocation, income and expenses."
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* PRIMARY METRIC CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        <StatCard title="Total Works" value={totalWorks} icon={Briefcase} variant="blue" onClick={onNavigateToWorks} loading={isInitialLoad} />
        <StatCard title="Work Sites" value={totalSites} icon={MapPin} variant="accent" onClick={() => onNavigateToWorkSites()} loading={isInitialLoad} />
        <StatCard title="Pending Execution" value={pendingWorks} icon={Clock} variant="purple" onClick={onNavigateToWorks} loading={isInitialLoad} />
        <StatCard title="Registered Workforce" value={totalLabours} icon={Users} variant="success" loading={isInitialLoad} />
      </div>

      {/* FINANCIAL METRIC CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        <StatCard
          title="Quotation Pipeline"
          value={`₹${(stats?.cards.totalQuotationValue ?? 0).toLocaleString()}`}
          subtitle="Active estimates value"
          icon={FileSpreadsheet}
          variant="default"
          loading={isInitialLoad}
        />
        <StatCard
          title="This Month Income"
          value={`₹${(stats?.cards.thisMonthIncome ?? 0).toLocaleString()}`}
          subtitle="Customer receipts"
          icon={TrendingUp}
          variant="success"
          loading={isInitialLoad}
        />
        <StatCard
          title="This Month Expense"
          value={`₹${(stats?.cards.thisMonthExpense ?? 0).toLocaleString()}`}
          subtitle="Materials & wages"
          icon={TrendingDown}
          variant="danger"
          loading={isInitialLoad}
        />
        <StatCard
          title="Net Profit"
          value={`₹${(stats?.cards.thisMonthProfit ?? 0).toLocaleString()}`}
          subtitle="Operational margin"
          icon={IndianRupee}
          variant={(stats?.cards.thisMonthProfit ?? 0) >= 0 ? 'success' : 'danger'}
          loading={isInitialLoad}
        />
      </div>

      {/* CHART & STATUS SUMMARY */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 sm:p-6 lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Monthly Income vs Expense</h3>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Cash inflow against project expense over the past 6 months
            </p>
          </div>
          {isInitialLoad ? (
            <div className="flex h-[240px] items-end gap-3 px-2 pt-6">
              {[45, 70, 55, 85, 60, 75].map((h, i) => (
                <div key={i} className="flex flex-1 items-end gap-1.5">
                  <div className="skeleton w-full rounded-t-md" style={{ height: `${h}%` }} />
                  <div className="skeleton w-full rounded-t-md" style={{ height: `${h * 0.7}%` }} />
                </div>
              ))}
            </div>
          ) : (
            <FinancialChart data={stats?.monthlyFinancials || []} />
          )}
        </div>

        <div className="card flex flex-col p-5 sm:p-6">
          <h3 className="text-base font-semibold text-slate-900">Execution Status</h3>
          <p className="mt-0.5 text-[13px] text-slate-500">Live status across all work orders</p>

          <div className="mt-5 flex-1 space-y-2.5">
            {[
              { label: 'Pending execution', value: stats?.cards.pendingWorks ?? 0, unit: 'jobs', icon: Clock, tint: 'bg-amber-50 text-amber-600 ring-amber-100' },
              { label: 'Workforce registered', value: stats?.cards.totalLabours ?? 0, unit: 'workers', icon: Users, tint: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
              { label: 'Client work sites', value: stats?.cards.totalWorkSites ?? 0, unit: 'locations', icon: MapPin, tint: 'bg-blue-50 text-blue-600 ring-blue-100' },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg border border-slate-300 px-3.5 py-3"
              >
                <span className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${row.tint}`}>
                    <row.icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-slate-700">{row.label}</span>
                </span>
                {isInitialLoad ? (
                  <Skeleton className="h-4 w-14" />
                ) : (
                  <span className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-900">{row.value}</span> {row.unit}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/60 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <Clock className="h-3.5 w-3.5" />
              Pending payments
            </p>
            {cash ? (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-500">To pay (wages & expenses)</span>
                  <span className="font-mono text-sm font-semibold text-rose-700">₹{cash.pendingOut.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500">To get from clients</span>
                  <span className="font-mono text-sm font-semibold text-emerald-700">₹{cash.toGet.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/expense';
              }}
              className="btn-ghost -ml-2 mt-2 text-blue-600 no-print"
            >
              Open expense tracker
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* RECENT WORK SITES & RECENT WORK ORDERS */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-300 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent Work Sites</h3>
              <p className="text-[13px] text-slate-500">Active project sites & zones</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToWorkSites()}
              className="btn-ghost text-blue-600 hover:!text-blue-700"
            >
              View all ({totalSites})
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {isInitialLoad ? (
            <ListSkeleton />
          ) : recentSites.length === 0 ? (
            <EmptyState icon={MapPin} text="No work sites registered yet." />
          ) : (
            <ul className="divide-y divide-slate-300">
              {recentSites.slice(0, 5).map((site) => (
                <li key={site.id}>
                  <button
                    type="button"
                    onClick={() => onNavigateToWorkSites(site.id)}
                    className="group flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition hover:bg-slate-50/70"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-blue-600">
                          {site.name}
                        </span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                          {site.section && <span className="truncate">{site.section}</span>}
                          {site.section && site.address && <span className="text-slate-300">•</span>}
                          {site.address && <span className="truncate">{site.address}</span>}
                          {!site.section && !site.address && 'No location set'}
                        </span>
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        <Briefcase className="h-3 w-3" />
                        {site._count?.works ?? site.works?.length ?? 0}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-300 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent Work Orders</h3>
              <p className="text-[13px] text-slate-500">Latest job assignments & progress</p>
            </div>
            <button
              type="button"
              onClick={onNavigateToWorks}
              className="btn-ghost text-blue-600 hover:!text-blue-700"
            >
              View all ({totalWorks})
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {isInitialLoad ? (
            <ListSkeleton />
          ) : !stats?.recentWorks || stats.recentWorks.length === 0 ? (
            <EmptyState icon={Briefcase} text="No work orders recorded yet." />
          ) : (
            <ul className="divide-y divide-slate-300">
              {stats.recentWorks.slice(0, 5).map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedWorkForPrint(w)}
                    className="group flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition hover:bg-slate-50/70"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-blue-600">
                        {w.name}
                      </span>
                      <span className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                        <span className="font-mono">{w.workCode}</span>
                        <span className="text-slate-300">•</span>
                        <span className="truncate">{w.workSite?.name || 'Unassigned'}</span>
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-3">
                      <StatusBadge status={w.status} />
                      <span className="hidden w-24 text-right font-mono text-sm font-semibold text-slate-900 sm:block">
                        ₹{Number(w.contractorAmount || 0).toLocaleString()}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Printable modal if selected */}
      {selectedWorkForPrint && (
        <WorkPrintView
          work={selectedWorkForPrint}
          onClose={() => setSelectedWorkForPrint(null)}
        />
      )}
    </div>
  );
};
