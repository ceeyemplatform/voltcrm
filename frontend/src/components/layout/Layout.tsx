import React, { useState } from 'react';
import { Sidebar, PageId } from './Sidebar';
import { TopBar } from './TopBar';

interface LayoutProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onPrintPage?: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentPage,
  onNavigate,
  onPrintPage,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('elecrm.sidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => {
        try {
          localStorage.setItem('elecrm.sidebarCollapsed', prev ? '0' : '1');
        } catch {
          // ignore unavailable storage
        }
        return !prev;
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
      />

      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'
        }`}
      >
        <TopBar
          currentPage={currentPage}
          onNavigate={onNavigate}
          onToggleSidebar={handleToggleSidebar}
          onPrintPage={onPrintPage}
        />

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
};
