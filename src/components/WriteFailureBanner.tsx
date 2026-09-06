import React from 'react';
import { AlertTriangle, RotateCw, X } from 'lucide-react';
import type { WriteFailure } from '../data/useWriteFailures';

interface Props {
  failures: WriteFailure[];
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}

export const WriteFailureBanner: React.FC<Props> = ({ failures, onRetry, onDismiss }) => {
  if (failures.length === 0) return null;

  return (
    <div className="sticky top-0 z-50 border-b border-danger-500/40 bg-danger-950/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-2.5">
        <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-danger-200">
          <AlertTriangle size={16} />
          {failures.length === 1
            ? 'Não foi possível salvar 1 alteração.'
            : `Não foi possível salvar ${failures.length} alterações.`}
        </div>

        <ul className="space-y-1">
          {failures.map(f => (
            <li key={f.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-danger-100/80">
                {f.entity} "{f.label}" — falha ao {f.operation}.
              </span>
              <span className="flex shrink-0 gap-2">
                <button
                  onClick={() => onRetry(f.id)}
                  className="flex items-center gap-1 rounded border border-danger-400/40 px-2 py-0.5 font-semibold text-danger-200 hover:bg-danger-500/20"
                >
                  <RotateCw size={12} /> Tentar de novo
                </button>
                <button
                  onClick={() => onDismiss(f.id)}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-danger-300/70 hover:bg-danger-500/10"
                >
                  <X size={12} /> Descartar
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
