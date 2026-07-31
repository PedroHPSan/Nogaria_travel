import { useState } from 'react';
import type { ReactNode } from 'react';
import { TripProvider, useTrip } from './context/TripContext';
import { TripWizard } from './features/onboarding/TripWizard';
import { AuthProvider } from './context/AuthContext';
import { AuthGate } from './features/auth/AuthGate';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import type { NavTab } from './components/Navigation';
import { DashboardView } from './features/dashboard/DashboardView';
import { ParticipantsView } from './features/participants/ParticipantsView';
import { LogisticsView } from './features/logistics/LogisticsView';
import { ItineraryView } from './features/itinerary/ItineraryView';
import { TimelineView } from './features/timeline/TimelineView';
import { GiftCardsView } from './features/financial/GiftCardsView';
import { PurchasesView } from './features/purchases/PurchasesView';
import { TasksDecisionsView } from './features/tasks_decisions/TasksDecisionsView';
import { DocumentsView } from './features/documents/DocumentsView';
import { AuditView } from './features/audits/AuditView';
import { AiCopilotView } from './features/ai/AiCopilotView';
import { DailyBriefingView } from './features/briefing/DailyBriefingView';
import { WriteFailureBanner } from './components/WriteFailureBanner';

function MainAppContent() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const { auditFindings } = useTrip();

  const unresolvedAuditCount = auditFindings.filter(f => !f.resolved).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      <Header
        onOpenAudit={() => setActiveTab('audit')}
        onOpenAi={() => setActiveTab('ai')}
      />

      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        auditCount={unresolvedAuditCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 pt-2">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigate={(tab) => setActiveTab(tab)}
          />
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

        {activeTab === 'timeline' && (
          <TimelineView />
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
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <p className="text-sm text-slate-400">Carregando suas viagens…</p>
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
    <AuthProvider>
      <AuthGate>
        <TripProvider>
          <AppOuWizard>
            <MainAppContent />
          </AppOuWizard>
        </TripProvider>
      </AuthGate>
    </AuthProvider>
  );
}

export default App;
