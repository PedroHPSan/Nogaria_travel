import { useState } from 'react';
import type { ReactNode } from 'react';
import { TripProvider, useTrip } from './context/TripContext';
import { TripWizard } from './features/onboarding/TripWizard';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthGate } from './features/auth/AuthGate';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import type { NavTab } from './components/Navigation';
import { DashboardView } from './features/dashboard/DashboardView';
import { ParticipantsView } from './features/participants/ParticipantsView';
import { LogisticsView } from './features/logistics/LogisticsView';
import { ItineraryView } from './features/itinerary/ItineraryView';
import { GiftCardsView } from './features/financial/GiftCardsView';
import { PurchasesView } from './features/purchases/PurchasesView';
import { TasksDecisionsView } from './features/tasks_decisions/TasksDecisionsView';
import { DocumentsView } from './features/documents/DocumentsView';
import { AuditView } from './features/audits/AuditView';
import { AiCopilotView } from './features/ai/AiCopilotView';
import { DailyBriefingView } from './features/briefing/DailyBriefingView';
import { DREView } from './features/financial/DREView';
import { WriteFailureBanner } from './components/WriteFailureBanner';

const ACTIVE_TAB_SESSION_KEY = 'ANTIGRAVITY_TRAVEL_PLATFORM_V1_active_tab';
const VALID_TABS: NavTab[] = [
  'dashboard', 'briefing', 'dre', 'participants', 'logistics', 'itinerary',
  'purchases', 'financial', 'tasks_decisions', 'documents', 'audit', 'ai'
];

function getInitialTab(): NavTab {
  const fromHash = window.location.hash.replace('#', '');
  if (VALID_TABS.includes(fromHash as NavTab)) return fromHash as NavTab;
  const stored = sessionStorage.getItem(ACTIVE_TAB_SESSION_KEY);
  if (VALID_TABS.includes(stored as NavTab)) return stored as NavTab;
  return 'dashboard';
}

function MainAppContent() {
  const [activeTab, setActiveTabState] = useState<NavTab>(getInitialTab);
  const { auditFindings, participants, tasks } = useTrip();

  const unresolvedAuditCount = auditFindings.filter(f => !f.resolved).length;
  const pendingTaskCount = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;

  const setActiveTab = (tab: NavTab) => {
    setActiveTabState(tab);
    sessionStorage.setItem(ACTIVE_TAB_SESSION_KEY, tab);
    window.history.replaceState(null, '', `#${tab}`);
  };

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col font-sans antialiased selection:bg-info-600 selection:text-white">
      <Header
        onOpenAudit={() => setActiveTab('audit')}
        onOpenAi={() => setActiveTab('ai')}
      />

      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        auditCount={unresolvedAuditCount}
        participantCount={participants.length}
        pendingTaskCount={pendingTaskCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 pt-2">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'dre' && (
          <DREView />
        )}

        {activeTab === 'briefing' && (
          <DailyBriefingView />
        )}


        {activeTab === 'participants' && (
          <ParticipantsView />
        )}

        {activeTab === 'logistics' && (
          <LogisticsView />
        )}

        {activeTab === 'itinerary' && (
          <ItineraryView />
        )}

        {activeTab === 'purchases' && (
          <PurchasesView />
        )}

        {activeTab === 'financial' && (
          <GiftCardsView />
        )}

        {activeTab === 'tasks_decisions' && (
          <TasksDecisionsView />
        )}

        {activeTab === 'documents' && (
          <DocumentsView />
        )}

        {activeTab === 'audit' && (
          <AuditView />
        )}

        {activeTab === 'ai' && (
          <AiCopilotView />
        )}
      </main>
    </div>
  );
}

const AppOuWizard = ({ children }: { children: ReactNode }) => {
  const { trips, tripDataLoading, failures, dismissFailure, retryFailure } = useTrip();

  const banner = <WriteFailureBanner failures={failures} onRetry={retryFailure} onDismiss={dismissFailure} />;

  if (tripDataLoading) {
    return (
      <>
        {banner}
        <div className="flex min-h-screen items-center justify-center bg-ink-950">
          <p className="text-sm text-ink-400">Carregando suas viagens…</p>
        </div>
      </>
    );
  }

  if (trips.length === 0) {
    return (
      <>
        {banner}
        <TripWizard />
      </>
    );
  }

  return (
    <>
      {banner}
      {children}
    </>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate>
          <TripProvider>
            <AppOuWizard>
              <MainAppContent />
            </AppOuWizard>
          </TripProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
