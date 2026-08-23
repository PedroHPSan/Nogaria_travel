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
        <h2 className="text-xl font-bold text-white flex items-center gap-2">{title}</h2>
        <p className="text-xs text-ink-400">{subtitle}</p>
      </div>

      {actions && (
        <div className="flex items-center gap-2 self-start sm:self-auto">{actions}</div>
      )}
    </div>
  );
};
