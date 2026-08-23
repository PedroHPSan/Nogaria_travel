import React from 'react';

export type SubTabAccent = 'blue' | 'emerald' | 'amber' | 'purple';

// Literal class strings (not template-interpolated) so Tailwind's build-time
// scanner can find and generate them — see index.css / Tailwind v4 content scan.
const ACCENT_ACTIVE_CLASS: Record<SubTabAccent, string> = {
  blue: 'bg-info-600 text-white shadow-md',
  emerald: 'bg-success-600 text-white shadow-md',
  amber: 'bg-warning-600 text-white shadow-md',
  purple: 'bg-accent-600 text-white shadow-md'
};

export interface SubTabItem<T extends string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: SubTabAccent;
}

interface SubTabsProps<T extends string> {
  items: SubTabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
}

/**
 * Pill-style sub-tab switcher: same wrapper/button anatomy repeated across
 * LogisticsView, PurchasesView, TasksDecisionsView, GiftCardsView, and
 * DREView's mode toggle inside ItineraryView. Each tab picks its own
 * accent color to match the domain color it already used.
 */
export function SubTabs<T extends string>({ items, activeId, onChange, className = '' }: SubTabsProps<T>) {
  return (
    <div className={`flex items-center gap-1.5 p-1 rounded-xl bg-ink-900 border border-ink-800 self-start sm:self-auto ${className}`}>
      {items.map(item => {
        const Icon = item.icon;
        const isActive = activeId === item.id;
        const activeClass = ACCENT_ACTIVE_CLASS[item.accent ?? 'blue'];
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              isActive ? activeClass : 'text-ink-400 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
