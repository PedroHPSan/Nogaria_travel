import React from 'react';

export type KpiAccent = 'blue' | 'emerald' | 'amber' | 'purple';

// Literal class strings (not template-interpolated) so Tailwind's build-time
// scanner can find and generate them — see index.css / Tailwind v4 content scan.
const ACCENT_CLASSES: Record<KpiAccent, { border: string; text: string; bg: string; bar: string; hoverBorder: string }> = {
  blue: { border: 'border-info-500/20', text: 'text-info-400', bg: 'bg-info-500/10', bar: 'bg-info-500', hoverBorder: 'hover:border-info-500/40' },
  emerald: { border: 'border-success-500/20', text: 'text-success-400', bg: 'bg-success-500/10', bar: 'bg-success-500', hoverBorder: 'hover:border-success-500/40' },
  amber: { border: 'border-warning-500/20', text: 'text-warning-400', bg: 'bg-warning-500/10', bar: 'bg-warning-500', hoverBorder: 'hover:border-warning-500/40' },
  purple: { border: 'border-accent-500/20', text: 'text-accent-400', bg: 'bg-accent-500/10', bar: 'bg-accent-500', hoverBorder: 'hover:border-accent-500/40' }
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
        <div className="mt-3 w-full bg-ink-800 h-1.5 rounded-full overflow-hidden">
          <div className={`${c.bar} h-full rounded-full`} style={{ width: `${progress}%` }} />
        </div>
      )}
      {footer && (
        <div className="mt-3 text-[11px] text-ink-400 pt-2 border-t border-ink-800 flex justify-between">
          {footer}
        </div>
      )}
    </div>
  );
};
