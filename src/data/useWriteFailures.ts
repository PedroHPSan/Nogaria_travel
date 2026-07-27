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

  const retryFailure = useCallback(
    (id: string) => {
      const alvo = failures.find(f => f.id === id);
      setFailures(prev => prev.filter(f => f.id !== id));
      alvo?.retry();
    },
    [failures],
  );

  return { failures, recordFailure, dismissFailure, retryFailure };
}
