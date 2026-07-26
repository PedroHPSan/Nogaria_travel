import React from 'react';
import {
  LayoutDashboard,
  Users,
  Plane,
  CalendarDays,
  CreditCard,
  ShoppingBag,
  CheckSquare,
  FileText,
  ShieldCheck,
  Bot,
  Volume2
} from 'lucide-react';
import { useTrip } from '../context/TripContext';

export type NavTab =
  | 'dashboard'
  | 'briefing'
  | 'participants'
  | 'logistics'
  | 'itinerary'
  | 'purchases'
  | 'financial'
  | 'tasks_decisions'
  | 'documents'
  | 'audit'
  | 'ai';

interface NavigationProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  auditCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  auditCount
}) => {
  const { participants, tasks } = useTrip();

  const pendingTaskCount = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;

  const tabs: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'briefing', label: 'Briefing do Dia', icon: Volume2 },
    { id: 'participants', label: `Grupo (${participants.length})`, icon: Users },
    { id: 'logistics', label: 'Logística', icon: Plane },
    { id: 'itinerary', label: 'Roteiro & Atrações', icon: CalendarDays },
    { id: 'purchases', label: 'Compras & Malas', icon: ShoppingBag },
    { id: 'financial', label: 'Gift Cards & Financial', icon: CreditCard },
    { id: 'tasks_decisions', label: 'Pendências', icon: CheckSquare, badge: pendingTaskCount > 0 ? pendingTaskCount : undefined },
    { id: 'documents', label: 'Vouchers & PDF', icon: FileText },
    { id: 'audit', label: 'Auditoria', icon: ShieldCheck, badge: auditCount > 0 ? auditCount : undefined },
    { id: 'ai', label: 'IA Copilot', icon: Bot }
  ];


  return (
    <>
      {/* Desktop Top Sub-nav Bar */}
      <div className="hidden md:block glass-panel border-b border-slate-800 px-4 py-2 mb-6 sticky top-[61px] z-30">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Bottom Floating Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-slate-800 px-1 py-2 flex items-center justify-around shadow-2xl overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition relative min-w-[50px] ${
                isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] mt-1 tracking-tight leading-none truncate max-w-[52px]">
                {tab.label.split(' ')[0]}
              </span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute top-0 right-1 w-3.5 h-3.5 text-[8px] font-bold rounded-full bg-rose-500 text-white flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
};
