import React from 'react';

interface ViewHeaderProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * Standard top-of-view header: title + subtitle on the left, action
 * buttons (add/search/etc.) on the right. Repeated verbatim across every
 * feature view — see issue #13 §5 (shared components).
 */
export const ViewHeader: React.FC<ViewHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-black bg-gradient-to-r from-amber-400 via-rose-400 to-info-400 bg-clip-text text-transparent flex items-center gap-2 drop-shadow-sm">
          {title}
        </h2>
        <p className="text-xs text-ink-400 mt-1">{subtitle}</p>
      </div>

      {actions && (
        <div className="flex items-center gap-2 self-start sm:self-auto">{actions}</div>
      )}
    </div>
  );
};
