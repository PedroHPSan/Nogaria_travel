import React, { useState } from 'react';
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
  Volume2,
  Clock,
  FileSpreadsheet,
  MoreHorizontal,
  X
} from 'lucide-react';
import { useTrip } from '../context/TripContext';

export type NavTab =
  | 'dashboard'
  | 'briefing'
  | 'dre'
  | 'participants'
  | 'logistics'
  | 'itinerary'
  | 'timeline'
  | 'purchases'
  | 'financial'
  | 'tasks_decisions'
  | 'documents'
  | 'audit'
  | 'ai';

type NavGroup = 'hoje' | 'planejamento' | 'dinheiro' | 'controle';

interface NavigationProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  auditCount: number;
}

interface TabDef {
  id: NavTab;
  group: NavGroup;
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const GROUP_LABELS: Record<NavGroup, string> = {
  hoje: 'Hoje',
  planejamento: 'Roteiro',
  dinheiro: 'Dinheiro',
  controle: 'Mais'
};

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  auditCount
}) => {
  const { participants, tasks } = useTrip();
  const [openSheet, setOpenSheet] = useState<NavGroup | null>(null);

  const pendingTaskCount = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;

  const tabs: TabDef[] = [
    { id: 'dashboard', group: 'hoje', label: 'Visão Geral', short: 'Hoje', icon: LayoutDashboard },
    { id: 'briefing', group: 'hoje', label: 'Briefing do Dia', short: 'Briefing', icon: Volume2 },
    { id: 'itinerary', group: 'planejamento', label: 'Roteiro & Atrações', short: 'Roteiro', icon: CalendarDays },
    { id: 'timeline', group: 'planejamento', label: 'Cronologia', short: 'Cronologia', icon: Clock },
    { id: 'logistics', group: 'planejamento', label: 'Logística', short: 'Logística', icon: Plane },
    { id: 'participants', group: 'planejamento', label: `Grupo (${participants.length})`, short: 'Grupo', icon: Users },
    { id: 'dre', group: 'dinheiro', label: 'DRE & Orçamento', short: 'DRE', icon: FileSpreadsheet },
    { id: 'financial', group: 'dinheiro', label: 'Gift Cards & Milhas', short: 'Gift Cards', icon: CreditCard },
    { id: 'purchases', group: 'dinheiro', label: 'Compras & Malas', short: 'Compras', icon: ShoppingBag },
    { id: 'tasks_decisions', group: 'controle', label: 'Pendências', short: 'Pendências', icon: CheckSquare, badge: pendingTaskCount > 0 ? pendingTaskCount : undefined },
    { id: 'audit', group: 'controle', label: 'Auditoria', short: 'Auditoria', icon: ShieldCheck, badge: auditCount > 0 ? auditCount : undefined },
    { id: 'documents', group: 'controle', label: 'Vouchers & PDF', short: 'Documentos', icon: FileText }
  ];

  const groupOrder: NavGroup[] = ['hoje', 'planejamento', 'dinheiro', 'controle'];
  const tabsByGroup = (group: NavGroup) => tabs.filter(t => t.group === group);
  const groupBadge = (group: NavGroup) =>
    tabsByGroup(group).reduce((sum, t) => sum + (t.badge ?? 0), 0);

  const selectTab = (tab: NavTab) => {
    setActiveTab(tab);
    setOpenSheet(null);
  };

  const onMobileGroupTap = (group: NavGroup) => {
    const groupTabs = tabsByGroup(group);
    if (groupTabs.length === 1) {
      selectTab(groupTabs[0].id);
      return;
    }
    setOpenSheet(current => (current === group ? null : group));
  };

  return (
    <>
      {/* Desktop Top Sub-nav Bar */}
      <div className="hidden md:block glass-panel border-b border-slate-800 px-4 py-2 mb-6 sticky top-[61px] z-30">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
          {groupOrder.map((group, groupIdx) => (
            <React.Fragment key={group}>
              {groupIdx > 0 && <span className="w-px h-5 bg-slate-800 mx-1.5 shrink-0" />}
              {tabsByGroup(group).map(tab => {
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
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Mobile Bottom Floating Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-slate-800 px-1 py-2 flex items-center justify-around shadow-2xl">
        {groupOrder.map(group => {
          const groupTabs = tabsByGroup(group);
          const isSingle = groupTabs.length === 1;
          const single = groupTabs[0];
          const Icon = isSingle ? single.icon : (group === 'controle' ? MoreHorizontal : groupTabs[0].icon);
          const isActive = isSingle ? activeTab === single.id : groupTabs.some(t => t.id === activeTab);
          const badge = groupBadge(group);
          return (
            <button
              key={group}
              onClick={() => onMobileGroupTap(group)}
              className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition relative min-w-[56px] ${
                isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[11px] mt-1 tracking-tight leading-none truncate max-w-[64px]">
                {GROUP_LABELS[group]}
              </span>
              {badge > 0 && (
                <span className="absolute top-0 right-1 w-3.5 h-3.5 text-[8px] font-bold rounded-full bg-rose-500 text-white flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile group sheet */}
      {openSheet && (
        <div className="md:hidden fixed inset-0 z-[60] flex items-end" onClick={() => setOpenSheet(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full glass-panel border-t border-slate-800 rounded-t-2xl px-3 pt-3 pb-24 max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-sm font-semibold text-slate-200">{GROUP_LABELS[openSheet]}</span>
              <button onClick={() => setOpenSheet(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {tabsByGroup(openSheet).map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => selectTab(tab.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
