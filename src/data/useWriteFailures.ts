import { useCallback, useState } from 'react';
import { newId } from '../services/ids';

export interface WriteFailure {
  id: string;
  /** Nome da entidade em pt-BR, como aparece para o usuário: "Participante", "Viagem". */
  entity: string;
  operation: 'criar' | 'atualizar' | 'excluir';
  /** Como identificar o registro na tela: o nome da pessoa, o título da viagem. */
  label: string;
  /** Reaplica a mudança local e refaz a chamada. */
  retry: () => void;
}

export function useWriteFailures() {
  const [failures, setFailures] = useState<WriteFailure[]>([]);

  const recordFailure = useCallback((f: Omit<WriteFailure, 'id'>) => {
    setFailures(prev => [...prev, { ...f, id: newId() }]);
  }, []);

  const dismissFailure = useCallback((id: string) => {
    setFailures(prev => prev.filter(f => f.id !== id));
  }, []);

  const retryFailure = useCallback((id: string) => {
    setFailures(prev => {
      const alvo = prev.find(f => f.id === id);
      if (alvo) alvo.retry();
      return prev.filter(f => f.id !== id);
    });
  }, []);

  return { failures, recordFailure, dismissFailure, retryFailure };
}
