import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Briefcase,
  FileSpreadsheet,
  Receipt,
  Boxes,
  Zap,
  X,
  LogOut,
  ChevronsUpDown,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type PageId =
  | 'dashboard'
  | 'labour'
  | 'work-site'
  | 'work'
  | 'quotation'
  | 'expense'
  | 'polevar'
  | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
}

type NavItem = {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Platform',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'work', label: 'Work Entry', icon: Briefcase },
      { id: 'work-site', label: 'Work Sites', icon: MapPin },
      { id: 'labour', label: 'Labour', icon: Users },
    ],
  },
  {
    title: 'Finance & Reports',
    items: [
      { id: 'quotation', label: 'Quotations', icon: FileSpreadsheet },
      { id: 'expense', label: 'Expenses', icon: Receipt },
      { id: 'polevar', label: 'Polevar Report', icon: Boxes },
    ],
  },
  {
    title: 'Settings',
    items: [{ id: 'settings', label: 'Print Header', icon: Settings }],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  isOpen,
  onClose,
  isCollapsed = false,
}) => {
  const { user, signOut } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const email = user?.email || '';
  const displayName = email ? email.split('@')[0] : 'VoltCRM User';
  const initials = (displayName.slice(0, 2) || 'VC').toUpperCase();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden no-print"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex w-64 flex-col border-r border-slate-300 bg-white transition-all duration-300 lg:translate-x-0 no-print ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-[72px]' : ''}`}
      >
        {/* Brand */}
        <div
          className={`flex h-16 items-center justify-between px-5 ${
            isCollapsed ? 'lg:justify-center lg:px-0' : ''
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-600/20">
              <Zap className="h-4 w-4 fill-white" />
            </div>
            <span
              className={`text-lg font-bold tracking-tight text-slate-900 ${
                isCollapsed ? 'lg:hidden' : ''
              }`}
            >
              Volt<span className="text-blue-600">CRM</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon lg:hidden"
            title="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto px-3 py-3 ${isCollapsed ? 'lg:px-3' : ''}`}>
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-5">
              <div
                className={`px-3 pb-1.5 text-xs font-medium text-slate-400 ${
                  isCollapsed ? 'lg:hidden' : ''
                }`}
              >
                {group.title}
              </div>
              {isCollapsed && <div className="mx-3 mb-2 hidden border-t border-slate-300 lg:block" />}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onNavigate(item.id);
                        onClose();
                      }}
                      title={isCollapsed ? item.label : undefined}
                      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-slate-100 font-semibold text-slate-900'
                          : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      } ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-600" />
                      )}
                      <Icon
                        className={`h-[18px] w-[18px] flex-shrink-0 ${
                          isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'
                        }`}
                      />
                      <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="relative border-t border-slate-300 p-3">
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute bottom-full left-3 right-3 z-50 mb-2 min-w-[200px] rounded-xl border border-slate-300 bg-white p-1.5 shadow-lg">
                <div className="px-2.5 py-2">
                  <p className="truncate text-xs font-semibold text-slate-900">{displayName}</p>
                  <p className="truncate text-[11px] text-slate-500">{email}</p>
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
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition hover:bg-slate-50 ${
              isCollapsed ? 'lg:justify-center lg:p-1' : ''
            }`}
            title={isCollapsed ? email : undefined}
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-300">
              {initials}
            </span>
            <span className={`min-w-0 flex-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <span className="block truncate text-sm font-semibold text-slate-900">
                {displayName}
              </span>
              <span className="block truncate text-xs text-slate-500">{email}</span>
            </span>
            <ChevronsUpDown
              className={`h-4 w-4 flex-shrink-0 text-slate-400 ${isCollapsed ? 'lg:hidden' : ''}`}
            />
          </button>
        </div>
      </aside>
    </>
  );
};
