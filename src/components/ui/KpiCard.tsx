import React from 'react';

export type KpiAccent = 'blue' | 'emerald' | 'amber' | 'purple';

// Literal class strings (not template-interpolated) so Tailwind's build-time
// scanner can find and generate them — see index.css / Tailwind v4 content scan.
const ACCENT_CLASSES: Record<KpiAccent, { border: string; text: string; bg: string; bar: string; hoverBorder: string }> = {
  blue: { border: 'border-blue-500/20', text: 'text-blue-400', bg: 'bg-blue-500/10', bar: 'bg-blue-500', hoverBorder: 'hover:border-blue-500/40' },
  emerald: { border: 'border-emerald-500/20', text: 'text-emerald-400', bg: 'bg-emerald-500/10', bar: 'bg-emerald-500', hoverBorder: 'hover:border-emerald-500/40' },
  amber: { border: 'border-amber-500/20', text: 'text-amber-400', bg: 'bg-amber-500/10', bar: 'bg-amber-500', hoverBorder: 'hover:border-amber-500/40' },
  purple: { border: 'border-purple-500/20', text: 'text-purple-400', bg: 'bg-purple-500/10', bar: 'bg-purple-500', hoverBorder: 'hover:border-purple-500/40' }
};

interface KpiCardProps {
  accent: KpiAccent;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  /** Rendered as a bordered-top strip below the value. Mutually exclusive with `progress`. */
  footer?: React.ReactNode;
  /** 0-100. Renders a progress bar instead of `footer`. */
  progress?: number;
  onClick?: () => void;
  className?: string;
}

/**
 * Small stat card (icon + label + big value + optional footer/progress bar).
 * Same anatomy repeated across DashboardView and DREView's KPI rows —
 * see issue #13 §5 (shared components).
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  accent,
  icon: Icon,
  label,
  value,
  sublabel,
  footer,
  progress,
  onClick,
  className = ''
}) => {
  const c = ACCENT_CLASSES[accent];

  return (
    <div
      onClick={onClick}
      className={`glass-card p-5 rounded-2xl border ${c.border} relative overflow-hidden ${
        onClick ? `cursor-pointer ${c.hoverBorder} transition` : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${c.text}`}>{label}</span>
        <div className={`w-8 h-8 rounded-lg ${c.bg} ${c.text} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
        {sublabel && <div className={`text-xs ${c.text} font-medium mt-1`}>{sublabel}</div>}
      </div>
      {progress !== undefined && (
        <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div className={`${c.bar} h-full rounded-full`} style={{ width: `${progress}%` }} />
        </div>
      )}
      {footer && (
        <div className="mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
          {footer}
        </div>
      )}
    </div>
  );
};
