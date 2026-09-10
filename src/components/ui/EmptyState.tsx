import React from 'react';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}

/**
 * Estado vazio padrão das listas de cada tela. Existe porque, até a issue #34,
 * uma coleção vazia no Supabase caía no seed da viagem de Orlando do autor —
 * um tenant novo enxergava a viagem de outro tenant como se fosse dele. Agora
 * vazio é vazio, e esta caixa explica o que fazer em vez de mostrar um grid
 * em branco.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action }) => (
  <div className="glass-card rounded-2xl border border-dashed border-ink-700 p-8 flex flex-col items-center text-center gap-3">
    <div className="w-12 h-12 rounded-2xl bg-ink-900 border border-ink-800 flex items-center justify-center">
      <Icon className="w-6 h-6 text-ink-400" />
    </div>
    <div>
      <h3 className="text-sm font-bold text-ink-100">{title}</h3>
      <p className="text-xs text-ink-400 mt-1 max-w-sm">{description}</p>
    </div>
    {action}
  </div>
);
