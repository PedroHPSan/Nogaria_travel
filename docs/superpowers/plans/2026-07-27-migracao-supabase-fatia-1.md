# Migração para Supabase — Fatia 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar `trips` e `participants` do `localStorage` e pô-los no Supabase, com escrita otimista e falha visível, mais um wizard que guia o primeiro cadastro.

**Architecture:** Diretório novo `src/data/` com um hook por coleção e mappers puros. Escrita otimista: aplica local, chama o banco, reverte e registra se falhar. IDs `uuid` gerados no cliente para não haver janela de reconciliação. As outras 14 coleções continuam no `localStorage` — o `TripContext` fica híbrido de propósito.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind v4, Vitest 2, `@supabase/supabase-js`, e (novos) `jsdom` + `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-07-27-migracao-supabase-fatia-1-design.md`

## Global Constraints

- **`verbatimModuleSyntax` ligado** — todo import de tipo usa `import type { X } from '...'`. Import normal de um tipo quebra o build.
- **`noUnusedLocals` e `noUnusedParameters` ligados** — variável ou parâmetro não usado **falha o `npm run build`**, e o `npm run dev` não avisa. Rode `npm run build` antes de cada commit.
- **`erasableSyntaxOnly` ligado** — proibido `enum` e propriedades de parâmetro em construtor. Use uniões de string literal.
- **Moeda:** todo valor monetário guardado é USD, exceto campos explicitamente BRL.
- **Sem lib de formulário:** validação manual, seguindo o padrão dos modais existentes. Nada de Zod ou React Hook Form.
- **Estilo:** classes cruas do Tailwind (`slate-*`, `emerald-*`, `rose-*`, `amber-*`, `purple-*`) sobre fundo escuro, mais `.glass-card` / `.glass-panel`. Não usar os tokens de `tailwind.config.js` — esse arquivo está morto sob Tailwind v4.
- **Ícones:** `lucide-react`.
- **UI em português (pt-BR).**
- **`npm run lint`** deve terminar com exatamente 2 warnings conhecidos (`react/only-export-components` em `TripContext.tsx` e `AuthContext.tsx`). Mais que isso é regressão.
- **Determinismo nos testes:** nenhuma função de derivação pode ler o relógio internamente. Data "hoje" entra sempre por parâmetro.
- **IDs:** gerados por `newId()` de `src/services/ids.ts` (`crypto.randomUUID()`). Nunca `` `prefix-${Date.now()}` ``.

---

### Task 1: Infraestrutura de teste com jsdom

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Modify: `tsconfig.node.json`
- Test: `src/data/setup.test.tsx`

**Interfaces:**
- Produces: ambiente de teste capaz de renderizar hooks React. Todas as tasks seguintes que testam hooks dependem disto.

- [ ] **Step 1: Instalar as dependências de teste**

```bash
npm install -D jsdom@^25.0.1 @testing-library/react@^16.1.0 @testing-library/dom@^10.4.0
```

- [ ] **Step 2: Permitir arquivos de teste `.tsx` e ambiente por arquivo**

Substitua `vitest.config.ts` inteiro por:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Ambiente padrão continua node: a suíte de funções puras não paga o custo do DOM.
    // Arquivos que precisam de DOM declaram `// @vitest-environment jsdom` no topo.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

- [ ] **Step 3: Pôr o vitest.config.ts no grafo do tsc**

Em `tsconfig.node.json`, troque a última linha:

```json
  "include": ["vite.config.ts", "vitest.config.ts"]
```

- [ ] **Step 4: Escrever o teste que prova o ambiente**

Crie `src/data/setup.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

describe('ambiente de teste de hooks', () => {
  it('renderiza um hook e aplica atualizações de estado', () => {
    const { result } = renderHook(() => {
      const [n, setN] = useState(0);
      return { n, setN };
    });

    expect(result.current.n).toBe(0);
    act(() => result.current.setN(3));
    expect(result.current.n).toBe(3);
  });
});
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run src/data/setup.test.tsx`
Expected: 1 teste passando. Se falhar com "document is not defined", o docblock `@vitest-environment jsdom` não está na primeira linha do arquivo.

- [ ] **Step 6: Confirmar que a suíte inteira e o build seguem verdes**

Run: `npm test && npm run build && npm run lint`
Expected: 85 testes passando (84 anteriores + 1 novo), build sem erro, lint com exatamente 2 warnings conhecidos.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.node.json src/data/setup.test.tsx
git commit -m "Add jsdom test environment for React hook tests"
```

---

### Task 2: Mappers puros de Trip e Participant

**Files:**
- Create: `src/data/mappers/tripMapper.ts`
- Create: `src/data/mappers/participantMapper.ts`
- Test: `src/data/mappers/tripMapper.test.ts`
- Test: `src/data/mappers/participantMapper.test.ts`

**Interfaces:**
- Consumes: tipos `Trip` e `Participant` de `src/types/database.types.ts`
- Produces:
  - `tripFromRow(row: TripRow): Trip`
  - `tripToInsert(trip: Trip): TripRow`
  - `deriveAge(birthDate: string, today: string): number`
  - `participantFromRow(row: ParticipantRow, today: string): Participant`
  - `participantToInsert(p: Participant, today: string): ParticipantRow`
  - tipos `TripRow` e `ParticipantRow` exportados

**Contexto que você precisa saber:** o Postgres **não tem** as colunas `age` nem `quota_eligible` em `participants` — só `birth_date`. `age` é derivada na leitura. `quota_eligible` não é mapeada nesta fatia: ninguém a edita hoje e `customsQuota.ts:40` a lê como `participant.quota_eligible !== false`, então ausente significa elegível, que é o comportamento atual. `is_minor` **é** coluna, mas também é derivada de `birth_date` na leitura e recalculada na escrita, para que a coluna nunca contradiga a data.

- [ ] **Step 1: Escrever os testes que falham**

Crie `src/data/mappers/participantMapper.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  deriveAge,
  participantFromRow,
  participantToInsert,
  type ParticipantRow,
} from './participantMapper';

const row: ParticipantRow = {
  id: '11111111-1111-4111-8111-111111111111',
  trip_id: '22222222-2222-4222-8222-222222222222',
  full_name: 'Débora Palheta',
  nickname: 'Débora',
  birth_date: '2014-03-10',
  is_minor: false,
  relationship: 'Filha de Bárbara',
  responsible_participant_id: null,
  passport_number: null,
  passport_expiry: null,
  visa_status: 'valid',
  dietary_restrictions: null,
  height_cm: null,
  notes: null,
  budget_limit_usd: 600,
  avatar_color: 'bg-purple-500',
};

describe('deriveAge', () => {
  it('conta o aniversário já ocorrido no ano', () => {
    expect(deriveAge('2014-03-10', '2026-07-27')).toBe(12);
  });

  it('não conta o aniversário que ainda não chegou', () => {
    expect(deriveAge('2014-12-25', '2026-07-27')).toBe(11);
  });

  it('conta o aniversário que é exatamente hoje', () => {
    expect(deriveAge('2014-07-27', '2026-07-27')).toBe(12);
  });

  it('trata 29 de fevereiro em ano não bissexto', () => {
    expect(deriveAge('2016-02-29', '2026-02-28')).toBe(9);
    expect(deriveAge('2016-02-29', '2026-03-01')).toBe(10);
  });

  it('devolve 0 para data de nascimento no futuro em vez de número negativo', () => {
    expect(deriveAge('2030-01-01', '2026-07-27')).toBe(0);
  });

  it('devolve 0 para data vazia', () => {
    expect(deriveAge('', '2026-07-27')).toBe(0);
  });
});

describe('participantFromRow', () => {
  it('deriva age e is_minor da data de nascimento, ignorando a coluna is_minor', () => {
    const p = participantFromRow(row, '2026-07-27');
    expect(p.age).toBe(12);
    expect(p.is_minor).toBe(true);
  });

  it('converte null do banco em undefined do TS', () => {
    const p = participantFromRow(row, '2026-07-27');
    expect(p.responsible_participant_id).toBeUndefined();
    expect(p.passport_number).toBeUndefined();
    expect(p.dietary_restrictions).toBeUndefined();
  });

  it('preserva os campos que atravessam sem tradução', () => {
    const p = participantFromRow(row, '2026-07-27');
    expect(p.id).toBe(row.id);
    expect(p.trip_id).toBe(row.trip_id);
    expect(p.full_name).toBe('Débora Palheta');
    expect(p.budget_limit_usd).toBe(600);
    expect(p.avatar_color).toBe('bg-purple-500');
  });
});

describe('participantToInsert', () => {
  it('não envia age, que não é coluna', () => {
    const p = participantFromRow(row, '2026-07-27');
    const insert = participantToInsert(p, '2026-07-27');
    expect('age' in insert).toBe(false);
  });

  it('não envia quota_eligible, que não é coluna', () => {
    const p = { ...participantFromRow(row, '2026-07-27'), quota_eligible: false };
    const insert = participantToInsert(p, '2026-07-27');
    expect('quota_eligible' in insert).toBe(false);
  });

  it('recalcula is_minor na escrita para a coluna nunca contradizer a data', () => {
    const p = { ...participantFromRow(row, '2026-07-27'), is_minor: false };
    expect(participantToInsert(p, '2026-07-27').is_minor).toBe(true);
  });

  it('converte undefined do TS em null do banco', () => {
    const p = participantFromRow(row, '2026-07-27');
    const insert = participantToInsert(p, '2026-07-27');
    expect(insert.nickname).toBe('Débora');
    expect(insert.passport_number).toBeNull();
    expect(insert.height_cm).toBeNull();
  });
});
```

Crie `src/data/mappers/tripMapper.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tripFromRow, tripToInsert, type TripRow } from './tripMapper';

const row: TripRow = {
  id: '33333333-3333-4333-8333-333333333333',
  tenant_id: '44444444-4444-4444-8444-444444444444',
  title: 'Miami e Orlando 2026',
  destination_main: 'Orlando, Miami e Fort Lauderdale, EUA',
  start_date: '2026-09-05',
  end_date: '2026-09-20',
  cover_image: null,
  currency_base: 'USD',
  status: 'planning',
  created_at: '2026-07-27T10:00:00Z',
  updated_at: '2026-07-27T10:00:00Z',
};

describe('tripFromRow', () => {
  it('converte null em undefined nos campos opcionais', () => {
    expect(tripFromRow(row).cover_image).toBeUndefined();
  });

  it('preserva os campos obrigatórios', () => {
    const t = tripFromRow(row);
    expect(t.id).toBe(row.id);
    expect(t.tenant_id).toBe(row.tenant_id);
    expect(t.title).toBe('Miami e Orlando 2026');
    expect(t.start_date).toBe('2026-09-05');
    expect(t.currency_base).toBe('USD');
    expect(t.status).toBe('planning');
  });
});

describe('tripToInsert', () => {
  it('converte undefined em null', () => {
    const t = tripFromRow(row);
    expect(tripToInsert(t).cover_image).toBeNull();
  });

  it('faz ida e volta sem perder informação', () => {
    expect(tripToInsert(tripFromRow(row))).toEqual(row);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run src/data/mappers`
Expected: FAIL com "Failed to load url ./participantMapper" — os arquivos ainda não existem.

- [ ] **Step 3: Implementar o mapper de Trip**

Crie `src/data/mappers/tripMapper.ts`:

```ts
import type { Trip } from '../../types/database.types';

/** Linha da tabela public.trips exatamente como o Postgres devolve. */
export interface TripRow {
  id: string;
  tenant_id: string;
  title: string;
  destination_main: string;
  start_date: string;
  end_date: string;
  cover_image: string | null;
  currency_base: 'USD' | 'BRL';
  status: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

export function tripFromRow(row: TripRow): Trip {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    title: row.title,
    destination_main: row.destination_main,
    start_date: row.start_date,
    end_date: row.end_date,
    cover_image: row.cover_image ?? undefined,
    currency_base: row.currency_base,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function tripToInsert(trip: Trip): TripRow {
  return {
    id: trip.id,
    tenant_id: trip.tenant_id,
    title: trip.title,
    destination_main: trip.destination_main,
    start_date: trip.start_date,
    end_date: trip.end_date,
    cover_image: trip.cover_image ?? null,
    currency_base: trip.currency_base,
    status: trip.status,
    created_at: trip.created_at,
    updated_at: trip.updated_at,
  };
}
```

- [ ] **Step 4: Implementar o mapper de Participant**

Crie `src/data/mappers/participantMapper.ts`:

```ts
import type { Participant } from '../../types/database.types';

/**
 * Linha da tabela public.participants exatamente como o Postgres devolve.
 * Repare no que NÃO existe: não há coluna `age` nem `quota_eligible`.
 */
export interface ParticipantRow {
  id: string;
  trip_id: string;
  full_name: string;
  nickname: string | null;
  birth_date: string;
  is_minor: boolean;
  relationship: string;
  responsible_participant_id: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  visa_status: 'valid' | 'pending' | 'exempt' | 'expired' | null;
  dietary_restrictions: string[] | null;
  height_cm: number | null;
  notes: string | null;
  budget_limit_usd: number;
  avatar_color: string;
}

/**
 * Idade em anos completos. `today` entra por parâmetro para o cálculo ser
 * determinístico em teste — nada aqui lê o relógio.
 * Datas no formato ISO `YYYY-MM-DD`.
 */
export function deriveAge(birthDate: string, today: string): number {
  if (!birthDate || !today) return 0;

  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  if (!by || !bm || !bd || !ty || !tm || !td) return 0;

  let age = ty - by;
  // Ainda não fez aniversário este ano.
  if (tm < bm || (tm === bm && td < bd)) age -= 1;

  return age > 0 ? age : 0;
}

export function participantFromRow(row: ParticipantRow, today: string): Participant {
  const age = deriveAge(row.birth_date, today);
  return {
    id: row.id,
    trip_id: row.trip_id,
    full_name: row.full_name,
    nickname: row.nickname ?? undefined,
    birth_date: row.birth_date,
    age,
    // Derivado, não lido da coluna: a data de nascimento é a única verdade.
    is_minor: age < 18,
    relationship: row.relationship,
    responsible_participant_id: row.responsible_participant_id ?? undefined,
    passport_number: row.passport_number ?? undefined,
    passport_expiry: row.passport_expiry ?? undefined,
    visa_status: row.visa_status ?? undefined,
    dietary_restrictions: row.dietary_restrictions ?? undefined,
    height_cm: row.height_cm ?? undefined,
    notes: row.notes ?? undefined,
    budget_limit_usd: row.budget_limit_usd,
    avatar_color: row.avatar_color,
  };
}

export function participantToInsert(p: Participant, today: string): ParticipantRow {
  return {
    id: p.id,
    trip_id: p.trip_id,
    full_name: p.full_name,
    nickname: p.nickname ?? null,
    birth_date: p.birth_date,
    is_minor: deriveAge(p.birth_date, today) < 18,
    relationship: p.relationship,
    responsible_participant_id: p.responsible_participant_id ?? null,
    passport_number: p.passport_number ?? null,
    passport_expiry: p.passport_expiry ?? null,
    visa_status: p.visa_status ?? null,
    dietary_restrictions: p.dietary_restrictions ?? null,
    height_cm: p.height_cm ?? null,
    notes: p.notes ?? null,
    budget_limit_usd: p.budget_limit_usd,
    avatar_color: p.avatar_color,
  };
}
```

- [ ] **Step 5: Rodar e confirmar que passam**

Run: `npx vitest run src/data/mappers`
Expected: PASS, 18 testes.

- [ ] **Step 6: Confirmar build e lint**

Run: `npm run build && npm run lint`
Expected: build sem erro, lint com exatamente 2 warnings conhecidos.

- [ ] **Step 7: Commit**

```bash
git add src/data/mappers
git commit -m "Add pure Trip and Participant mappers deriving age from birth date"
```

---

### Task 3: Registro de falhas de escrita e a faixa que as mostra

**Files:**
- Create: `src/data/useWriteFailures.ts`
- Create: `src/components/WriteFailureBanner.tsx`
- Test: `src/data/useWriteFailures.test.tsx`

**Interfaces:**
- Consumes: `newId` de `src/services/ids.ts`
- Produces:
  - tipo `WriteFailure = { id: string; entity: string; operation: 'criar' | 'atualizar' | 'excluir'; label: string; retry: () => void }`
  - `useWriteFailures(): { failures: WriteFailure[]; recordFailure(f: Omit<WriteFailure, 'id'>): void; dismissFailure(id: string): void; retryFailure(id: string): void }`
  - componente `WriteFailureBanner`

**Por que isto existe:** no trabalho anterior, todo defeito sério era silencioso. Uma escrita que falha e some é a mesma classe de problema. A faixa é persistente de propósito — nada de toast que evapora.

- [ ] **Step 1: Escrever os testes que falham**

Crie `src/data/useWriteFailures.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWriteFailures } from './useWriteFailures';

describe('useWriteFailures', () => {
  it('começa vazio', () => {
    const { result } = renderHook(() => useWriteFailures());
    expect(result.current.failures).toEqual([]);
  });

  it('registra uma falha com id próprio', () => {
    const { result } = renderHook(() => useWriteFailures());

    act(() =>
      result.current.recordFailure({
        entity: 'Participante',
        operation: 'atualizar',
        label: 'Gabriela',
        retry: () => {},
      }),
    );

    expect(result.current.failures).toHaveLength(1);
    expect(result.current.failures[0].entity).toBe('Participante');
    expect(result.current.failures[0].label).toBe('Gabriela');
    expect(result.current.failures[0].id).toBeTruthy();
  });

  it('acumula falhas em vez de substituir a anterior', () => {
    const { result } = renderHook(() => useWriteFailures());

    act(() => {
      result.current.recordFailure({ entity: 'Viagem', operation: 'criar', label: 'A', retry: () => {} });
      result.current.recordFailure({ entity: 'Participante', operation: 'criar', label: 'B', retry: () => {} });
    });

    expect(result.current.failures).toHaveLength(2);
  });

  it('descartar remove só a falha pedida', () => {
    const { result } = renderHook(() => useWriteFailures());

    act(() => {
      result.current.recordFailure({ entity: 'Viagem', operation: 'criar', label: 'A', retry: () => {} });
      result.current.recordFailure({ entity: 'Viagem', operation: 'criar', label: 'B', retry: () => {} });
    });
    const primeiro = result.current.failures[0].id;
    act(() => result.current.dismissFailure(primeiro));

    expect(result.current.failures).toHaveLength(1);
    expect(result.current.failures[0].label).toBe('B');
  });

  it('tentar de novo chama o retry guardado e remove a falha da lista', () => {
    const { result } = renderHook(() => useWriteFailures());
    const retry = vi.fn();

    act(() =>
      result.current.recordFailure({ entity: 'Viagem', operation: 'criar', label: 'A', retry }),
    );
    const id = result.current.failures[0].id;
    act(() => result.current.retryFailure(id));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(result.current.failures).toHaveLength(0);
  });

  it('tentar de novo com id inexistente não quebra', () => {
    const { result } = renderHook(() => useWriteFailures());
    act(() => result.current.retryFailure('nao-existe'));
    expect(result.current.failures).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run src/data/useWriteFailures.test.tsx`
Expected: FAIL com "Failed to load url ./useWriteFailures".

- [ ] **Step 3: Implementar o hook**

Crie `src/data/useWriteFailures.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx vitest run src/data/useWriteFailures.test.tsx`
Expected: PASS, 6 testes.

- [ ] **Step 5: Criar a faixa**

Crie `src/components/WriteFailureBanner.tsx`:

```tsx
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
    <div className="sticky top-0 z-50 border-b border-rose-500/40 bg-rose-950/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-2.5">
        <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-rose-200">
          <AlertTriangle size={16} />
          {failures.length === 1
            ? 'Não foi possível salvar 1 alteração.'
            : `Não foi possível salvar ${failures.length} alterações.`}
        </div>

        <ul className="space-y-1">
          {failures.map(f => (
            <li key={f.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-rose-100/80">
                {f.entity} "{f.label}" — falha ao {f.operation}.
              </span>
              <span className="flex shrink-0 gap-2">
                <button
                  onClick={() => onRetry(f.id)}
                  className="flex items-center gap-1 rounded border border-rose-400/40 px-2 py-0.5 font-semibold text-rose-200 hover:bg-rose-500/20"
                >
                  <RotateCw size={12} /> Tentar de novo
                </button>
                <button
                  onClick={() => onDismiss(f.id)}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-rose-300/70 hover:bg-rose-500/10"
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
```

- [ ] **Step 6: Confirmar build, lint e suíte**

Run: `npm test && npm run build && npm run lint`
Expected: testes passando, build sem erro, lint com exatamente 2 warnings conhecidos.

- [ ] **Step 7: Commit**

```bash
git add src/data/useWriteFailures.ts src/data/useWriteFailures.test.tsx src/components/WriteFailureBanner.tsx
git commit -m "Add persistent write-failure registry and banner"
```

---

### Task 4: Hook de dados de trips

**Files:**
- Create: `src/data/useTripsData.ts`
- Test: `src/data/useTripsData.test.tsx`

**Interfaces:**
- Consumes: `tripFromRow`, `tripToInsert`, `TripRow` (Task 2); `WriteFailure` e o formato de `recordFailure` (Task 3); `newId` de `src/services/ids.ts`
- Produces: `useTripsData(deps: TripsDataDeps): { trips: Trip[]; loading: boolean; createTrip(data: Omit<Trip, 'id' | 'created_at' | 'updated_at'>): string }`
  - `createTrip` devolve o `uuid` gerado, para o chamador poder ativar a viagem recém-criada.
  - `TripsDataDeps = { client: SupabaseLike; tenantId: string | null; nowIso: () => string; recordFailure: (f: Omit<WriteFailure, 'id'>) => void }`

**Sobre a injeção do cliente:** o hook recebe o cliente por parâmetro em vez de importar `supabase` direto. Isso é o que torna o ciclo otimista testável sem rede. `SupabaseLike` é um tipo estrutural mínimo definido neste arquivo — não importe tipos do `@supabase/supabase-js` para ele.

- [ ] **Step 1: Escrever os testes que falham**

Crie `src/data/useTripsData.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTripsData, type SupabaseLike } from './useTripsData';
import type { Trip } from '../types/database.types';

const TENANT = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-07-27T10:00:00.000Z';

const novaViagem: Omit<Trip, 'id' | 'created_at' | 'updated_at'> = {
  tenant_id: TENANT,
  title: 'Miami e Orlando 2026',
  destination_main: 'Orlando, EUA',
  start_date: '2026-09-05',
  end_date: '2026-09-20',
  currency_base: 'USD',
  status: 'planning',
};

/** Cliente de mentira: sem rede, com falha controlável. */
function makeClient(opts: { rows?: unknown[]; insertError?: string } = {}): SupabaseLike {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: opts.rows ?? [], error: null }),
      }),
      insert: () =>
        Promise.resolve({
          error: opts.insertError ? { message: opts.insertError } : null,
        }),
    }),
  };
}

function deps(client: SupabaseLike, recordFailure = vi.fn()) {
  return { client, tenantId: TENANT, nowIso: () => NOW, recordFailure };
}

describe('useTripsData', () => {
  it('carrega as viagens do tenant', async () => {
    const client = makeClient({
      rows: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          tenant_id: TENANT,
          title: 'Miami e Orlando 2026',
          destination_main: 'Orlando, EUA',
          start_date: '2026-09-05',
          end_date: '2026-09-20',
          cover_image: null,
          currency_base: 'USD',
          status: 'planning',
          created_at: NOW,
          updated_at: NOW,
        },
      ],
    });

    const { result } = renderHook(() => useTripsData(deps(client)));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trips).toHaveLength(1);
    expect(result.current.trips[0].title).toBe('Miami e Orlando 2026');
    expect(result.current.trips[0].cover_image).toBeUndefined();
  });

  it('aplica a criação no estado local ANTES da resposta do servidor', async () => {
    let resolver: (v: { error: null }) => void = () => {};
    const client: SupabaseLike = {
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        insert: () => new Promise(r => { resolver = r; }),
      }),
    };

    const { result } = renderHook(() => useTripsData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.createTrip(novaViagem); });

    // O insert ainda não respondeu, mas a viagem já está na tela.
    expect(result.current.trips).toHaveLength(1);
    expect(result.current.trips[0].title).toBe('Miami e Orlando 2026');

    await act(async () => { resolver({ error: null }); });
    expect(result.current.trips).toHaveLength(1);
  });

  it('devolve o uuid gerado, e ele é o id da viagem criada', async () => {
    const { result } = renderHook(() => useTripsData(deps(makeClient())));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let devolvido = '';
    act(() => { devolvido = result.current.createTrip(novaViagem); });

    expect(devolvido).toBeTruthy();
    expect(result.current.trips[0].id).toBe(devolvido);
  });

  it('reverte a criação quando o insert falha', async () => {
    const client = makeClient({ insertError: 'permission denied' });
    const { result } = renderHook(() => useTripsData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.createTrip(novaViagem); });

    await waitFor(() => expect(result.current.trips).toHaveLength(0));
  });

  it('registra a falha nomeando a viagem', async () => {
    const recordFailure = vi.fn();
    const client = makeClient({ insertError: 'permission denied' });
    const { result } = renderHook(() => useTripsData(deps(client, recordFailure)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.createTrip(novaViagem); });

    await waitFor(() => expect(recordFailure).toHaveBeenCalledTimes(1));
    expect(recordFailure.mock.calls[0][0]).toMatchObject({
      entity: 'Viagem',
      operation: 'criar',
      label: 'Miami e Orlando 2026',
    });
  });

  it('não consulta o banco sem tenant ativo', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseLike;

    const { result } = renderHook(() =>
      useTripsData({ client, tenantId: null, nowIso: () => NOW, recordFailure: vi.fn() }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(from).not.toHaveBeenCalled();
    expect(result.current.trips).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run src/data/useTripsData.test.tsx`
Expected: FAIL com "Failed to load url ./useTripsData".

- [ ] **Step 3: Implementar o hook**

Crie `src/data/useTripsData.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import type { Trip } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import { newId } from '../services/ids';
import { tripFromRow, tripToInsert, type TripRow } from './mappers/tripMapper';

/**
 * Tipo estrutural mínimo do cliente Supabase — só o que este hook usa.
 * Existe para o teste poder injetar um cliente sem rede.
 */
export interface SupabaseLike {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
    insert: (values: unknown) => Promise<{ error: { message: string } | null }>;
  };
}

export interface TripsDataDeps {
  client: SupabaseLike;
  tenantId: string | null;
  /** Injetado para o teste controlar o tempo. */
  nowIso: () => string;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
}

export function useTripsData({ client, tenantId, nowIso, recordFailure }: TripsDataDeps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tenantId) {
      setTrips([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('trips')
      .select('*')
      .eq('tenant_id', tenantId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data) setTrips((data as TripRow[]).map(tripFromRow));
        setLoading(false);
      });

    return () => { cancelado = true; };
  }, [client, tenantId]);

  const createTrip = useCallback(
    (data: Omit<Trip, 'id' | 'created_at' | 'updated_at'>): string => {
      const agora = nowIso();
      const trip: Trip = { ...data, id: newId(), created_at: agora, updated_at: agora };

      const escrever = () => {
        setTrips(prev => [...prev, trip]);
        client
          .from('trips')
          .insert(tripToInsert(trip))
          .then(({ error }) => {
            if (!error) return;
            setTrips(prev => prev.filter(t => t.id !== trip.id));
            recordFailure({
              entity: 'Viagem',
              operation: 'criar',
              label: trip.title,
              retry: escrever,
            });
          });
      };

      escrever();
      return trip.id;
    },
    [client, nowIso, recordFailure],
  );

  return { trips, loading, createTrip };
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx vitest run src/data/useTripsData.test.tsx`
Expected: PASS, 6 testes.

- [ ] **Step 5: Confirmar build e lint**

Run: `npm run build && npm run lint`
Expected: build sem erro, lint com exatamente 2 warnings conhecidos.

- [ ] **Step 6: Commit**

```bash
git add src/data/useTripsData.ts src/data/useTripsData.test.tsx
git commit -m "Add optimistic trips data hook backed by Supabase"
```

---

### Task 5: Hook de dados de participants

**Files:**
- Create: `src/data/useParticipantsData.ts`
- Test: `src/data/useParticipantsData.test.tsx`

**Interfaces:**
- Consumes: `participantFromRow`, `participantToInsert`, `ParticipantRow`, `deriveAge` (Task 2); `SupabaseLike` de `./useTripsData` (Task 4); `WriteFailure` (Task 3); `newId`
- Produces: `useParticipantsData(deps: ParticipantsDataDeps): { participants: Participant[]; loading: boolean; addParticipant(data: Omit<Participant, 'id' | 'age' | 'is_minor'>): void; updateParticipant(id: string, patch: Partial<Participant>): void; deleteParticipant(id: string): void }`
  - `ParticipantsDataDeps = { client: SupabaseLike; tripId: string | null; today: string; recordFailure: (f: Omit<WriteFailure, 'id'>) => void }`
  - `addParticipant` **não** recebe `age` nem `is_minor`: os dois são derivados de `birth_date`.

**Atenção:** `SupabaseLike` da Task 4 só tem `select`/`insert`. Esta task precisa também de `update` e `delete`, então **estenda o tipo em `useTripsData.ts`** acrescentando os dois métodos, em vez de criar um segundo tipo. Os testes da Task 4 continuam passando porque o cliente de mentira deles só precisa implementar o que usa.

- [ ] **Step 1: Estender SupabaseLike**

Em `src/data/useTripsData.ts`, substitua a interface `SupabaseLike` por:

```ts
export interface SupabaseLike {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
    insert: (values: unknown) => Promise<{ error: { message: string } | null }>;
    update: (values: unknown) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
}
```

Nos testes da Task 4 (`useTripsData.test.tsx`), o `makeClient` e o cliente inline precisam devolver esses dois métodos a mais para satisfazer o tipo. Acrescente a ambos:

```ts
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
```

- [ ] **Step 2: Escrever os testes que falham**

Crie `src/data/useParticipantsData.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useParticipantsData } from './useParticipantsData';
import type { SupabaseLike } from './useTripsData';
import type { Participant } from '../types/database.types';

const TRIP = '22222222-2222-4222-8222-222222222222';
const TODAY = '2026-07-27';

const linhaDebora = {
  id: '11111111-1111-4111-8111-111111111111',
  trip_id: TRIP,
  full_name: 'Débora Palheta',
  nickname: 'Débora',
  birth_date: '2014-03-10',
  is_minor: true,
  relationship: 'Filha de Bárbara',
  responsible_participant_id: null,
  passport_number: 'AB123456',
  passport_expiry: '2030-01-01',
  visa_status: 'valid',
  dietary_restrictions: ['sem lactose'],
  height_cm: 150,
  notes: 'alérgica a amendoim',
  budget_limit_usd: 600,
  avatar_color: 'bg-purple-500',
};

const nova: Omit<Participant, 'id' | 'age' | 'is_minor'> = {
  trip_id: TRIP,
  full_name: 'Gabriela Palheta',
  nickname: 'Gabi',
  birth_date: '2022-05-01',
  relationship: 'Filha de Pedro',
  budget_limit_usd: 400,
  avatar_color: 'bg-orange-500',
};

function makeClient(opts: { rows?: unknown[]; error?: string } = {}): SupabaseLike {
  const err = opts.error ? { message: opts.error } : null;
  return {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: opts.rows ?? [], error: null }) }),
      insert: () => Promise.resolve({ error: err }),
      update: () => ({ eq: () => Promise.resolve({ error: err }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: err }) }),
    }),
  };
}

function deps(client: SupabaseLike, recordFailure = vi.fn()) {
  return { client, tripId: TRIP, today: TODAY, recordFailure };
}

describe('useParticipantsData', () => {
  it('carrega e deriva a idade da data de nascimento', async () => {
    const { result } = renderHook(() => useParticipantsData(deps(makeClient({ rows: [linhaDebora] }))));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.participants[0].age).toBe(12);
    expect(result.current.participants[0].is_minor).toBe(true);
  });

  it('adiciona no estado local imediatamente, com age derivada', async () => {
    const { result } = renderHook(() => useParticipantsData(deps(makeClient())));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.addParticipant(nova); });

    expect(result.current.participants).toHaveLength(1);
    expect(result.current.participants[0].full_name).toBe('Gabriela Palheta');
    expect(result.current.participants[0].age).toBe(4);
    expect(result.current.participants[0].is_minor).toBe(true);
  });

  it('reverte a adição quando o insert falha e registra a falha', async () => {
    const recordFailure = vi.fn();
    const { result } = renderHook(() =>
      useParticipantsData(deps(makeClient({ error: 'insert falhou' }), recordFailure)),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.addParticipant(nova); });

    await waitFor(() => expect(result.current.participants).toHaveLength(0));
    expect(recordFailure.mock.calls[0][0]).toMatchObject({
      entity: 'Participante',
      operation: 'criar',
      label: 'Gabriela Palheta',
    });
  });

  it('aplica o update local na hora e recalcula a idade', async () => {
    const { result } = renderHook(() => useParticipantsData(deps(makeClient({ rows: [linhaDebora] }))));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.updateParticipant(linhaDebora.id, { birth_date: '2000-01-01' }); });

    expect(result.current.participants[0].age).toBe(26);
    expect(result.current.participants[0].is_minor).toBe(false);
  });

  it('reverte o update para o valor ANTERIOR quando falha', async () => {
    const { result } = renderHook(() =>
      useParticipantsData(deps(makeClient({ rows: [linhaDebora], error: 'update falhou' }))),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.updateParticipant(linhaDebora.id, { full_name: 'Nome Errado' });
    });

    await waitFor(() => expect(result.current.participants[0].full_name).toBe('Débora Palheta'));
  });

  it('remove na hora e, se o delete falhar, devolve a linha COMPLETA', async () => {
    const { result } = renderHook(() =>
      useParticipantsData(deps(makeClient({ rows: [linhaDebora], error: 'delete falhou' }))),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.deleteParticipant(linhaDebora.id); });

    await waitFor(() => expect(result.current.participants).toHaveLength(1));
    const voltou = result.current.participants[0];
    expect(voltou.passport_number).toBe('AB123456');
    expect(voltou.dietary_restrictions).toEqual(['sem lactose']);
    expect(voltou.notes).toBe('alérgica a amendoim');
    expect(voltou.height_cm).toBe(150);
  });

  it('não consulta o banco sem viagem ativa', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseLike;

    const { result } = renderHook(() =>
      useParticipantsData({ client, tripId: null, today: TODAY, recordFailure: vi.fn() }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(from).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falham**

Run: `npx vitest run src/data/useParticipantsData.test.tsx`
Expected: FAIL com "Failed to load url ./useParticipantsData".

- [ ] **Step 4: Implementar o hook**

Crie `src/data/useParticipantsData.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import type { Participant } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import {
  deriveAge,
  participantFromRow,
  participantToInsert,
  type ParticipantRow,
} from './mappers/participantMapper';

export interface ParticipantsDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  /** Data de hoje em ISO `YYYY-MM-DD`, injetada para o cálculo de idade ser determinístico. */
  today: string;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
}

export function useParticipantsData({ client, tripId, today, recordFailure }: ParticipantsDataDeps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('participants')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data) {
          setParticipants((data as ParticipantRow[]).map(r => participantFromRow(r, today)));
        }
        setLoading(false);
      });

    return () => { cancelado = true; };
  }, [client, tripId, today]);

  const addParticipant = useCallback(
    (data: Omit<Participant, 'id' | 'age' | 'is_minor'>) => {
      const idade = deriveAge(data.birth_date, today);
      const p: Participant = { ...data, id: newId(), age: idade, is_minor: idade < 18 };

      const escrever = () => {
        setParticipants(prev => [...prev, p]);
        client
          .from('participants')
          .insert(participantToInsert(p, today))
          .then(({ error }) => {
            if (!error) return;
            setParticipants(prev => prev.filter(x => x.id !== p.id));
            recordFailure({
              entity: 'Participante',
              operation: 'criar',
              label: p.full_name,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, today, recordFailure],
  );

  const updateParticipant = useCallback(
    (id: string, patch: Partial<Participant>) => {
      setParticipants(prev => {
        const anterior = prev.find(x => x.id === id);
        if (!anterior) return prev;

        const bruto = { ...anterior, ...patch };
        const idade = deriveAge(bruto.birth_date, today);
        const atualizado: Participant = { ...bruto, age: idade, is_minor: idade < 18 };

        const escrever = () => {
          setParticipants(atual => atual.map(x => (x.id === id ? atualizado : x)));
          client
            .from('participants')
            .update(participantToInsert(atualizado, today))
            .eq('id', id)
            .then(({ error }) => {
              if (!error) return;
              // Reverte para o valor exato de antes, não para um valor recalculado.
              setParticipants(atual => atual.map(x => (x.id === id ? anterior : x)));
              recordFailure({
                entity: 'Participante',
                operation: 'atualizar',
                label: anterior.full_name,
                retry: escrever,
              });
            });
        };

        escrever();
        return prev.map(x => (x.id === id ? atualizado : x));
      });
    },
    [client, today, recordFailure],
  );

  const deleteParticipant = useCallback(
    (id: string) => {
      setParticipants(prev => {
        const removido = prev.find(x => x.id === id);
        if (!removido) return prev;

        const escrever = () => {
          setParticipants(atual => atual.filter(x => x.id !== id));
          client
            .from('participants')
            .delete()
            .eq('id', id)
            .then(({ error }) => {
              if (!error) return;
              // Devolve a linha inteira, não uma casca.
              setParticipants(atual => [...atual, removido]);
              recordFailure({
                entity: 'Participante',
                operation: 'excluir',
                label: removido.full_name,
                retry: escrever,
              });
            });
        };

        escrever();
        return prev.filter(x => x.id !== id);
      });
    },
    [client, recordFailure],
  );

  return { participants, loading, addParticipant, updateParticipant, deleteParticipant };
}
```

- [ ] **Step 5: Rodar e confirmar que passam**

Run: `npx vitest run src/data/`
Expected: PASS. Os testes da Task 4 continuam passando com o `SupabaseLike` estendido.

- [ ] **Step 6: Confirmar build e lint**

Run: `npm run build && npm run lint`
Expected: build sem erro, lint com exatamente 2 warnings conhecidos.

- [ ] **Step 7: Commit**

```bash
git add src/data/useParticipantsData.ts src/data/useParticipantsData.test.tsx src/data/useTripsData.ts src/data/useTripsData.test.tsx
git commit -m "Add optimistic participants data hook with rollback"
```

---

### Task 6: Ligar os hooks ao TripContext, tirando trips e participants do localStorage

**Files:**
- Modify: `src/context/TripContext.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useTripsData` (Task 4), `useParticipantsData` (Task 5), `useWriteFailures` (Task 3), `WriteFailureBanner` (Task 3)
- Produces: `useTrip()` mantém `trips`, `participants`, `createTrip`, `addParticipant`, `updateParticipant`, `deleteParticipant` com as mesmas assinaturas de hoje, mais `tripDataLoading: boolean`

**O corte é limpo:** `trips` e `participants` deixam de ter `useState` inicializado de `localStorage` e deixam de ter `useEffect` escrevendo nele. As outras 14 coleções não são tocadas.

- [ ] **Step 1: Remover a persistência local de trips e participants**

Em `src/context/TripContext.tsx`, apague os dois pares `useState` + `useEffect` de `trips` e de `participants`. Localize-os com:

```bash
grep -n "STORAGE_KEY}_trips\|STORAGE_KEY}_participants" src/context/TripContext.tsx
```

Apague também as funções `createTrip`, `addParticipant`, `updateParticipant` e `deleteParticipant` que hoje manipulam esse estado — elas vêm dos hooks agora.

- [ ] **Step 2: Chamar os hooks dentro do provider**

Acrescente os imports no topo:

```ts
import { useWriteFailures } from '../data/useWriteFailures';
import { useTripsData } from '../data/useTripsData';
import { useParticipantsData } from '../data/useParticipantsData';
import { supabase } from '../services/supabaseClient';
import type { SupabaseLike } from '../data/useTripsData';
```

Dentro do `TripProvider`, logo depois da leitura de `activeTenantId` do `useAuth()`, acrescente:

```ts
  const { failures, recordFailure, dismissFailure, retryFailure } = useWriteFailures();

  const client = supabase as unknown as SupabaseLike;
  const hoje = new Date().toISOString().split('T')[0];

  const { trips, loading: tripsLoading, createTrip } = useTripsData({
    client,
    tenantId: activeTenantId,
    nowIso: () => new Date().toISOString(),
    recordFailure,
  });
```

- [ ] **Step 3: Corrigir o activeTripId, que hoje aponta para uma viagem semeada**

Hoje a linha é `useState<string>(trips[0]?.id || INITIAL_TRIP.id)`. Com o banco vazio, `INITIAL_TRIP.id` aponta para uma viagem que não existe. Substitua por:

```ts
  const [activeTripId, setActiveTripId] = useState<string | null>(() =>
    localStorage.getItem(`${STORAGE_KEY}_activeTripId`),
  );

  // Se a viagem guardada sumiu (ou nunca existiu), cai na primeira disponível.
  const activeTripIdResolvido =
    activeTripId && trips.some(t => t.id === activeTripId) ? activeTripId : trips[0]?.id ?? null;

  useEffect(() => {
    if (activeTripIdResolvido) {
      localStorage.setItem(`${STORAGE_KEY}_activeTripId`, activeTripIdResolvido);
    }
  }, [activeTripIdResolvido]);
```

Agora chame o hook de participantes usando o id resolvido:

```ts
  const {
    participants,
    loading: participantsLoading,
    addParticipant,
    updateParticipant,
    deleteParticipant,
  } = useParticipantsData({
    client,
    tripId: activeTripIdResolvido,
    today: hoje,
    recordFailure,
  });
```

- [ ] **Step 4: Tratar o activeTrip possivelmente ausente**

Hoje o provider faz `const activeTrip = trips.find(...) ?? trips[0]` e dezenas de consumidores leem `activeTrip.id` direto. Com o banco vazio, `activeTrip` pode não existir.

**Não devolva `null` do provider.** O wizard da Task 8 usa `useTrip()` para chamar `createTrip` e `addParticipant`, então o contexto precisa existir justamente no estado "nenhuma viagem". Use um objeto de reserva:

```ts
  const activeTripEncontrada = trips.find(t => t.id === activeTripIdResolvido) ?? trips[0] ?? null;

  // Sem viagem o contexto ainda precisa existir, porque é dele que o wizard tira
  // createTrip e addParticipant. Nenhuma view chega a renderizar com este objeto:
  // o AuthGate mostra o wizard enquanto trips.length === 0 (Task 9).
  const activeTrip = activeTripEncontrada ?? {
    id: '',
    tenant_id: activeTenantId ?? '',
    title: '',
    destination_main: '',
    start_date: '',
    end_date: '',
    currency_base: 'USD' as const,
    status: 'planning' as const,
    created_at: '',
    updated_at: '',
  };
```

- [ ] **Step 5: Ajustar as assinaturas que realmente mudaram no TripContextType**

Três mudanças de tipo, todas obrigatórias — sem elas o build quebra:

```ts
  // createTrip agora devolve o uuid gerado, para o wizard poder ativar a viagem.
  createTrip: (tripData: Omit<Trip, 'id' | 'created_at' | 'updated_at'>) => string;

  // addParticipant não recebe mais age nem is_minor: os dois são derivados
  // de birth_date pelo mapper.
  addParticipant: (data: Omit<Participant, 'id' | 'age' | 'is_minor'>) => void;

  // Novos:
  tripDataLoading: boolean;
  failures: WriteFailure[];
  dismissFailure: (id: string) => void;
  retryFailure: (id: string) => void;
```

Acrescente o import do tipo: `import type { WriteFailure } from '../data/useWriteFailures';`

No objeto passado ao `Provider`, garanta que constam `trips`, `participants`, `createTrip`, `addParticipant`, `updateParticipant`, `deleteParticipant`, `setActiveTripId`, e acrescente:

```ts
        tripDataLoading: tripsLoading || participantsLoading,
        failures,
        dismissFailure,
        retryFailure,
```

- [ ] **Step 6: Mostrar a faixa de falhas no shell do app**

Em `src/App.tsx`, acrescente o import e leia os três valores novos do `useTrip()`:

```tsx
import { WriteFailureBanner } from './components/WriteFailureBanner';
```

```tsx
  const { failures, dismissFailure, retryFailure } = useTrip();
```

Renderize a faixa como primeiro filho do elemento raiz do `App`, antes do cabeçalho e da navegação, para ela ser visível de qualquer aba:

```tsx
<WriteFailureBanner failures={failures} onRetry={retryFailure} onDismiss={dismissFailure} />
```

- [ ] **Step 7: Confirmar que tudo compila e a suíte segue verde**

Run: `npm test && npm run build && npm run lint`
Expected: testes passando, build sem erro, lint com exatamente 2 warnings conhecidos. Se o build reclamar de `INITIAL_TRIP` ou `INITIAL_PARTICIPANTS` não usados, remova os imports órfãos — `noUnusedLocals` está ligado.

- [ ] **Step 8: Commit**

```bash
git add src/context/TripContext.tsx src/App.tsx
git commit -m "Move trips and participants from localStorage to Supabase"
```

---

### Task 7: ParticipantModal — data de nascimento como única verdade

**Files:**
- Modify: `src/components/modals/ParticipantModal.tsx`

**Interfaces:**
- Consumes: `addParticipant` / `updateParticipant` do `useTrip()` (Task 6)
- Produces: modal que envia `birth_date` obrigatório e nunca envia `age` nem `is_minor`

**O problema concreto:** hoje o modal tem um campo de **idade** (linha ~36, `const [age, setAge] = useState<number>(30)`) *e* um de data de nascimento (linha ~35), que podem discordar entre si. Pior: envia `birth_date: birthDate || '1990-01-01'`, um fallback silencioso. Com `birth_date not null` no Postgres, esse fallback grava uma data errada de verdade. E `is_minor` é um checkbox manual (`isMinor || Number(age) < 18`) que também pode contradizer a data.

- [ ] **Step 1: Remover o campo de idade e o checkbox de menor**

Apague os estados `age`/`setAge` e `isMinor`/`setIsMinor`, o `<input>` de idade e o checkbox de menor de idade, junto com as linhas que os populam em `useEffect` a partir de `initialData`.

- [ ] **Step 2: Derivar a idade para exibição**

Importe o helper e mostre a idade calculada ao lado do campo de data, como texto, não como campo editável:

```tsx
import { deriveAge } from '../../data/mappers/participantMapper';
```

```tsx
const hoje = new Date().toISOString().split('T')[0];
const idadeCalculada = birthDate ? deriveAge(birthDate, hoje) : null;
```

Abaixo do input de data de nascimento:

```tsx
{idadeCalculada !== null && (
  <p className="mt-1 text-[11px] text-slate-500">
    {idadeCalculada} anos
    {idadeCalculada < 18 && ' — menor de idade, informe o responsável'}
  </p>
)}
```

- [ ] **Step 3: Tornar a data de nascimento obrigatória**

No `handleSubmit`, antes do `onSave`, acrescente a validação no padrão dos outros modais:

```tsx
    if (!birthDate) {
      setError('Informe a data de nascimento.');
      return;
    }
```

Se o componente ainda não tem estado de erro, acrescente `const [error, setError] = useState('');` e renderize a mensagem acima dos botões, seguindo o padrão de `PriceQuoteModal.tsx`.

- [ ] **Step 4: Enviar sem age e sem is_minor**

No objeto do `onSave`, remova as chaves `age` e `is_minor` e troque o fallback da data:

```tsx
      birth_date: birthDate,
```

O seletor de responsável passa a aparecer com base em `idadeCalculada !== null && idadeCalculada < 18`, não no checkbox removido.

- [ ] **Step 5: Verificar no navegador**

Run: `npm run dev`

Abra a aba de Grupo, edite um participante, limpe a data de nascimento e tente salvar.
Expected: erro em pt-BR "Informe a data de nascimento.", sem salvar. Ao preencher uma data, a idade aparece calculada abaixo do campo. Se você não conseguir logar, diga isso no relatório em vez de afirmar que verificou.

- [ ] **Step 6: Confirmar build, lint e suíte**

Run: `npm test && npm run build && npm run lint`
Expected: testes passando, build sem erro, lint com exatamente 2 warnings conhecidos.

- [ ] **Step 7: Commit**

```bash
git add src/components/modals/ParticipantModal.tsx
git commit -m "Make birth date the only source of age in the participant form"
```

---

### Task 8: O wizard de primeira viagem

**Files:**
- Create: `src/features/onboarding/TripWizard.tsx`

**Interfaces:**
- Consumes: `createTrip`, `addParticipant` do `useTrip()` (Task 6); `activeTenantId` do `useAuth()`
- Produces: componente `TripWizard` — sem props; ele lê tudo do contexto e some sozinho quando a viagem existe

**Comportamento na falha parcial:** grava a viagem, depois os participantes. Se um participante falhar, a viagem já existe e a falha aparece na faixa persistente. Isso é aceitável: viagem sem participante é estado válido.

- [ ] **Step 1: Criar o componente**

Crie `src/features/onboarding/TripWizard.tsx`:

```tsx
import React, { useState } from 'react';
import { Plane, Users, Check, Plus, Trash2 } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useAuth } from '../../context/AuthContext';

interface RascunhoParticipante {
  full_name: string;
  nickname: string;
  birth_date: string;
  relationship: string;
  budget_limit_usd: string;
}

const CORES = ['bg-emerald-500', 'bg-purple-500', 'bg-blue-500', 'bg-orange-500', 'bg-rose-500'];

const participanteVazio = (): RascunhoParticipante => ({
  full_name: '',
  nickname: '',
  birth_date: '',
  relationship: '',
  budget_limit_usd: '',
});

export const TripWizard: React.FC = () => {
  const { createTrip, addParticipant, setActiveTripId } = useTrip();
  const { activeTenantId } = useAuth();

  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [erro, setErro] = useState('');

  const [titulo, setTitulo] = useState('');
  const [destino, setDestino] = useState('');
  const [ida, setIda] = useState('');
  const [volta, setVolta] = useState('');

  const [pessoas, setPessoas] = useState<RascunhoParticipante[]>([participanteVazio()]);

  const alterarPessoa = (i: number, campo: keyof RascunhoParticipante, valor: string) => {
    setPessoas(prev => prev.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p)));
  };

  const validarPasso1 = () => {
    if (!titulo.trim()) return 'Dê um nome à viagem.';
    if (!destino.trim()) return 'Informe o destino principal.';
    if (!ida) return 'Informe a data de ida.';
    if (!volta) return 'Informe a data de volta.';
    if (volta < ida) return 'A volta não pode ser anterior à ida.';
    return '';
  };

  const validarPasso2 = () => {
    if (pessoas.length === 0) return 'Adicione ao menos uma pessoa.';
    for (const p of pessoas) {
      if (!p.full_name.trim()) return 'Todo participante precisa de nome.';
      if (!p.birth_date) return `Informe a data de nascimento de ${p.full_name.trim()}.`;
    }
    return '';
  };

  const avancar = () => {
    const problema = passo === 1 ? validarPasso1() : validarPasso2();
    if (problema) return setErro(problema);
    setErro('');
    setPasso(p => (p === 1 ? 2 : 3));
  };

  const concluir = () => {
    if (!activeTenantId) return setErro('Nenhuma organização ativa.');

    const tripId = createTrip({
      tenant_id: activeTenantId,
      title: titulo.trim(),
      destination_main: destino.trim(),
      start_date: ida,
      end_date: volta,
      currency_base: 'USD',
      status: 'planning',
    });

    pessoas.forEach((p, i) => {
      addParticipant({
        trip_id: tripId,
        full_name: p.full_name.trim(),
        nickname: p.nickname.trim() || undefined,
        birth_date: p.birth_date,
        relationship: p.relationship.trim() || 'Membro do Grupo',
        budget_limit_usd: Number(p.budget_limit_usd) || 0,
        avatar_color: CORES[i % CORES.length],
      });
    });

    setActiveTripId(tripId);
  };

  const campo = 'w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="glass-panel w-full max-w-2xl rounded-2xl p-8">
        <div className="mb-6 flex items-center gap-3">
          {passo === 1 && <Plane className="text-blue-400" size={22} />}
          {passo === 2 && <Users className="text-purple-400" size={22} />}
          {passo === 3 && <Check className="text-emerald-400" size={22} />}
          <div>
            <h1 className="text-xl font-bold text-white">
              {passo === 1 && 'Sua primeira viagem'}
              {passo === 2 && 'Quem vai com você'}
              {passo === 3 && 'Confirme e comece'}
            </h1>
            <p className="text-xs text-slate-500">Passo {passo} de 3</p>
          </div>
        </div>

        {passo === 1 && (
          <div className="space-y-3">
            <input className={campo} placeholder="Nome da viagem (ex: Miami e Orlando 2026)" value={titulo} onChange={e => setTitulo(e.target.value)} />
            <input className={campo} placeholder="Destino principal (ex: Orlando, EUA)" value={destino} onChange={e => setDestino(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">
                Ida
                <input type="date" className={`${campo} mt-1`} value={ida} onChange={e => setIda(e.target.value)} />
              </label>
              <label className="text-xs text-slate-400">
                Volta
                <input type="date" className={`${campo} mt-1`} value={volta} onChange={e => setVolta(e.target.value)} />
              </label>
            </div>
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-4">
            {pessoas.map((p, i) => (
              <div key={i} className="glass-card rounded-xl p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Pessoa {i + 1}</span>
                  {pessoas.length > 1 && (
                    <button onClick={() => setPessoas(prev => prev.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-300">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className={campo} placeholder="Nome completo" value={p.full_name} onChange={e => alterarPessoa(i, 'full_name', e.target.value)} />
                  <input className={campo} placeholder="Apelido" value={p.nickname} onChange={e => alterarPessoa(i, 'nickname', e.target.value)} />
                  <label className="text-xs text-slate-400">
                    Nascimento
                    <input type="date" className={`${campo} mt-1`} value={p.birth_date} onChange={e => alterarPessoa(i, 'birth_date', e.target.value)} />
                  </label>
                  <label className="text-xs text-slate-400">
                    Orçamento (US$)
                    <input type="number" min="0" className={`${campo} mt-1`} value={p.budget_limit_usd} onChange={e => alterarPessoa(i, 'budget_limit_usd', e.target.value)} />
                  </label>
                  <input className={`${campo} col-span-2`} placeholder="Relação (ex: Pai, Filha, Amigo)" value={p.relationship} onChange={e => alterarPessoa(i, 'relationship', e.target.value)} />
                </div>
              </div>
            ))}
            <button onClick={() => setPessoas(prev => [...prev, participanteVazio()])} className="flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300">
              <Plus size={14} /> Adicionar pessoa
            </button>
          </div>
        )}

        {passo === 3 && (
          <div className="space-y-3 text-sm">
            <div className="glass-card rounded-xl p-4">
              <p className="font-bold text-white">{titulo}</p>
              <p className="text-slate-400">{destino}</p>
              <p className="mt-1 text-xs text-slate-500">{ida} até {volta}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {pessoas.length === 1 ? '1 participante' : `${pessoas.length} participantes`}
              </p>
              <ul className="space-y-1">
                {pessoas.map((p, i) => (
                  <li key={i} className="flex justify-between text-slate-300">
                    <span>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</span>
                    <span className="text-slate-500">US$ {Number(p.budget_limit_usd) || 0}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {erro && <p className="mt-4 text-sm text-rose-400">{erro}</p>}

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => { setErro(''); setPasso(p => (p === 3 ? 2 : 1)); }}
            disabled={passo === 1}
            className="rounded-lg px-4 py-2 text-sm text-slate-400 disabled:opacity-0 hover:text-slate-200"
          >
            Voltar
          </button>
          <button
            onClick={passo === 3 ? concluir : avancar}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {passo === 3 ? 'Criar viagem' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Confirmar build e lint**

Run: `npm run build && npm run lint`
Expected: build sem erro, lint com exatamente 2 warnings conhecidos. O componente ainda não é renderizado por ninguém — isso é esperado, a Task 9 o liga.

- [ ] **Step 3: Commit**

```bash
git add src/features/onboarding/TripWizard.tsx
git commit -m "Add first-trip wizard collecting trip and participants"
```

---

### Task 9: Ligar o wizard ao AuthGate

**Files:**
- Modify: `src/features/auth/AuthGate.tsx`

**Interfaces:**
- Consumes: `TripWizard` (Task 8); `trips` e `tripDataLoading` do `useTrip()` (Task 6)
- Produces: cadeia de portões completa — sem sessão, sem tenant, sem viagem, app

**Cuidado com a ordem:** o `TripWizard` usa `useTrip()`, então precisa estar **dentro** do `TripProvider`. Mas o `TripProvider` devolve `null` quando não há viagem (Task 6, Step 4). Portanto o portão de "nenhuma viagem" tem que morar dentro do provider, não antes dele.

- [ ] **Step 1: Criar o portão dentro do provider**

Em `src/features/auth/AuthGate.tsx`, envolva o conteúdo do app num componente interno que já está sob o `TripProvider`:

```tsx
import { TripWizard } from '../onboarding/TripWizard';
import { useTrip } from '../../context/TripContext';

const AppOuWizard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { trips, tripDataLoading } = useTrip();

  if (tripDataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-sm text-slate-400">Carregando suas viagens…</p>
      </div>
    );
  }

  if (trips.length === 0) return <TripWizard />;

  return <>{children}</>;
};
```

- [ ] **Step 2: Encaixar na cadeia**

No `AuthGate`, onde hoje o app é renderizado dentro do `TripProvider`, envolva-o:

```tsx
<TripProvider>
  <AppOuWizard>
    <App />
  </AppOuWizard>
</TripProvider>
```

- [ ] **Step 3: Verificar no navegador**

Run: `npm run dev`

Limpe o `localStorage` do app e recarregue com um tenant que não tenha viagem no banco.
Expected: o wizard aparece; ao concluir, o app carrega com a viagem criada e os participantes na aba de Grupo. Confirme no banco:

```bash
supabase db query --linked "select title from public.trips; select full_name, birth_date from public.participants;"
```

Se você não conseguir logar, diga isso no relatório em vez de afirmar que verificou.

- [ ] **Step 4: Confirmar build, lint e suíte**

Run: `npm test && npm run build && npm run lint`
Expected: testes passando, build sem erro, lint com exatamente 2 warnings conhecidos.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/AuthGate.tsx src/context/TripContext.tsx
git commit -m "Show the first-trip wizard when the tenant has no trips"
```

---
