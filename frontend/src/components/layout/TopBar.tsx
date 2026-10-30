import React, { useState } from 'react';
import {
  PanelLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  Download,
  Cloud,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PageId } from './Sidebar';
import { CloudSyncModal } from '../common/CloudSyncModal';

interface TopBarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onToggleSidebar: () => void;
  onPrintPage?: () => void;
}

const PAGE_LABELS: Record<PageId, string> = {
  dashboard: 'Overview',
  work: 'Work Entry',
  quotation: 'Quotations',
  polevar: 'Polevar Report',
  expense: 'Expenses',
  labour: 'Labour',
  'work-site': 'Work Sites',
  settings: 'Print Header',
};

export const TopBar: React.FC<TopBarProps> = ({
  currentPage,
  onNavigate,
  onToggleSidebar,
  onPrintPage,
}) => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [cloudSyncOpen, setCloudSyncOpen] = useState(false);

  const currentPageLabel = PAGE_LABELS[currentPage] || 'Overview';
  const userDisplayName = user?.email?.split('@')[0] || 'VoltCRM User';
  const userInitials = (userDisplayName.slice(0, 2) || 'VC').toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-300 bg-white/90 px-4 backdrop-blur-md transition-colors sm:px-6 no-print">
      {/* Left: Sidebar Toggle + Breadcrumb */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="btn-icon h-9 w-9"
          title="Toggle sidebar"
        >
          <PanelLeft className="h-[18px] w-[18px]" />
        </button>
        <span className="hidden h-5 w-px bg-slate-200 sm:block" />

        <nav className="flex min-w-0 items-center gap-1.5 text-sm">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`truncate transition-colors hover:text-slate-900 ${
              currentPage === 'dashboard' ? 'font-medium text-slate-900' : 'text-slate-500'
            }`}
          >
            Dashboard
          </button>

          {currentPage !== 'dashboard' && (
            <>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
              <span className="truncate font-medium text-slate-900">{currentPageLabel}</span>
            </>
          )}
        </nav>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setCloudSyncOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-slate-50"
          title="Sync with Google Sheets"
        >
          <Cloud className="h-3.5 w-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Sync Cloud</span>
        </button>

        {onPrintPage && (
          <button
            type="button"
            onClick={onPrintPage}
            className="btn-icon hidden h-9 w-9 md:inline-flex"
            title="Download this page as PDF"
          >
            <Download className="h-[18px] w-[18px]" />
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="btn-icon h-9 w-9"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="h-[18px] w-[18px] text-amber-400" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </button>

        <div className="relative ml-1">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex h-9 w-9 select-none items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:ring-blue-300"
            title={userDisplayName}
          >
            {userInitials}
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-300 bg-white p-1.5 shadow-lg">
                <div className="px-2.5 py-2">
                  <p className="truncate text-xs font-semibold text-slate-900">{userDisplayName}</p>
                  <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
                </div>
                <div className="my-1 border-t border-slate-300" />
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {cloudSyncOpen && (
        <CloudSyncModal isOpen={cloudSyncOpen} onClose={() => setCloudSyncOpen(false)} />
      )}
    </header>
  );
};
