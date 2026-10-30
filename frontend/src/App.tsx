import React, { useState, useEffect, useCallback, useRef } from 'react';
import { buildFileName, fileDate, printWithFileName } from './lib/print';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { LandingPage } from './components/landing/LandingPage';
import { Layout } from './components/layout/Layout';
import { PageId } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { LabourPage } from './pages/LabourPage';
import { WorkSitePage } from './pages/WorkSitePage';
import { WorkPage } from './pages/WorkPage';
import { QuotationPage } from './pages/QuotationPage';
import { ExpensePage } from './pages/ExpensePage';
import { PolevarPage } from './pages/PolevarPage';
import { SettingsPage } from './pages/SettingsPage';

const PAGE_FILE_LABELS: Record<PageId, string> = {
  dashboard: 'Dashboard',
  quotation: 'Quotations',
  work: 'Work Entries',
  polevar: 'Polevar Reports',
  expense: 'Expenses',
  labour: 'Labour',
  'work-site': 'Work Sites',
  settings: 'Settings',
};

const VALID_PAGES: PageId[] = [
  'dashboard',
  'quotation',
  'work',
  'polevar',
  'expense',
  'labour',
  'work-site',
  'settings',
];

type Route = { page: PageId; siteId: string | null; workId: string | null; logId: string | null };

const parseRouteFromLocation = (): Route => {
  try {
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
    if (!rawHash) {
      return { page: 'dashboard', siteId: null, workId: null, logId: null };
    }
    const [pathPart, queryPart] = rawHash.split('?');
    const page = VALID_PAGES.includes(pathPart as PageId)
      ? (pathPart as PageId)
      : 'dashboard';
    const sp = new URLSearchParams(queryPart || '');
    return { page, siteId: sp.get('siteId'), workId: sp.get('workId'), logId: sp.get('logId') };
  } catch {
    return { page: 'dashboard', siteId: null, workId: null, logId: null };
  }
};

export function AppContent() {
  const { session, loading } = useAuth();
  const initialRoute = parseRouteFromLocation();
  const [currentPage, setCurrentPage] = useState<PageId>(initialRoute.page);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(initialRoute.siteId);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(initialRoute.workId);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(initialRoute.logId);
  // Address while signed out: #/login and #/signup open the form, anything else the landing page
  const [publicHash, setPublicHash] = useState(window.location.hash);

  // Synchronize state when browser back/forward or hash changes
  useEffect(() => {
    const handlePopState = () => {
      setPublicHash(window.location.hash);
      const { page, siteId, workId, logId } = parseRouteFromLocation();
      setCurrentPage(page);
      setSelectedSiteId(siteId);
      setSelectedWorkId(workId);
      setSelectedLogId(logId);
    };

    window.addEventListener('hashchange', handlePopState);
    window.addEventListener('popstate', handlePopState);

    // Ensure URL hash reflects the initial page if bare URL
    if (!window.location.hash) {
      window.history.replaceState(null, '', `#/${initialRoute.page}`);
    }

    return () => {
      window.removeEventListener('hashchange', handlePopState);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigateTo = useCallback(
    (page: PageId, params?: { siteId?: string | null; workId?: string | null }) => {
      const siteId = params?.siteId || null;
      const workId = params?.workId || null;
      setCurrentPage(page);
      setSelectedSiteId(siteId);
      setSelectedWorkId(workId);
      setSelectedLogId(null);
      const query = new URLSearchParams();
      if (siteId) query.set('siteId', siteId);
      if (workId) query.set('workId', workId);
      const qs = query.toString();
      const hash = qs ? `#/${page}?${qs}` : `#/${page}`;
      if (window.location.hash !== hash) {
        window.history.pushState(null, '', hash);
      }
    },
    []
  );

  const handleNavigateToSite = (siteId?: string) => {
    navigateTo('work-site', { siteId });
  };

  // Signing in always starts on the dashboard; refreshing the page while signed in keeps the current page
  const hadSession = useRef<boolean | null>(null);
  useEffect(() => {
    if (loading) return;
    const hasSession = Boolean(session);
    if (hadSession.current === false && hasSession) navigateTo('dashboard');
    // Signed out: signing out lands on the sign-in form; anything else that isn't the
    // sign-in or sign-up form shows the landing page, not the last page that was open
    const onAuthForm = ['#/login', '#/signup'].includes(window.location.hash);
    if (!hasSession && hadSession.current === true) {
      window.history.replaceState(null, '', '#/login');
      setPublicHash('#/login');
    } else if (!hasSession && !onAuthForm && window.location.hash !== '#/') {
      window.history.replaceState(null, '', '#/');
      setPublicHash('#/');
    }
    hadSession.current = hasSession;
  }, [session, loading, navigateTo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-4">
        <div className="h-9 w-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Authenticating VoltCRM...
        </span>
      </div>
    );
  }

  if (!session) {
    if (publicHash === '#/login' || publicHash === '#/signup') {
      return <LoginPage key={publicHash} initialSignUp={publicHash === '#/signup'} />;
    }
    return <LandingPage />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigateToWorks={() => navigateTo('work')}
            onNavigateToWorkSites={handleNavigateToSite}
          />
        );
      case 'labour':
        return <LabourPage />;
      case 'work-site':
        return (
          <WorkSitePage
            initialSiteId={selectedSiteId}
            onClearSiteId={() => navigateTo('work-site')}
          />
        );
      case 'work':
        return (
          <WorkPage
            selectedWorkId={selectedWorkId}
            selectedLogId={selectedLogId}
            onSelectWork={(workId) => navigateTo('work', { workId })}
            onLogOpened={() => {
              // Drop logId from the URL so closing the popup or refreshing doesn't reopen it
              setSelectedLogId(null);
              if (selectedWorkId) {
                window.history.replaceState(null, '', `#/work?workId=${encodeURIComponent(selectedWorkId)}`);
              }
            }}
          />
        );
      case 'quotation':
        return <QuotationPage />;
      case 'expense':
        return <ExpensePage />;
      case 'polevar':
        return <PolevarPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return (
          <DashboardPage
            onNavigateToWorks={() => navigateTo('work')}
            onNavigateToWorkSites={handleNavigateToSite}
          />
        );
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={(page) => navigateTo(page)}
      onPrintPage={() => printWithFileName(buildFileName(PAGE_FILE_LABELS[currentPage], fileDate()))}
    >
      {renderCurrentPage()}
    </Layout>
  );
}

export default function App() {
  return <AppContent />;
}
