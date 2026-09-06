# Plano: Sistema de Avatar + Mods Estéticos + Tom do Bot WhatsApp

> Documento de handoff para o Antigravity implementar. Decisões já validadas com o Pedro (ver seção 0). Segue as convenções de `CLAUDE.md` (5 lugares para nova entidade, currency em USD, padrão View/Modal, etc).

## 0. Decisões validadas

- **Avatar**: galeria de ilustrações preset **+** fallback de emoji/cor (não upload de foto — sem custo de storage).
- **Alcance visual**: avatar aparece em **todas** as telas que hoje mostram participante — Participantes, Roteiro (list/timeline/calendário), DRE/divisão de custos, Tarefas.
- **Mods estéticos**: tema "clima de férias/parque" (paleta mais viva, ilustrações) **+** gamificação leve (badges/conquistas, micro-animação de celebração).
- **Tom do bot WhatsApp**: leve e caloroso, com emojis pontuais, mantendo objetividade — persona de "assistente de viagem da família".

---

## 1. Sistema de Avatar

### 1.1 Modelo de dados

`Participant` ganha 3 campos novos (todos opcionais, com fallback):

```ts
// database.types.ts
interface Participant {
  // ...existentes
  avatar_preset_id?: string | null;   // id de uma ilustração da galeria (ex: 'explorer-1')
  avatar_emoji?: string | null;       // fallback: emoji escolhido (ex: '🦁')
  avatar_color?: string | null;       // hex ou token de paleta para o fundo do avatar
}
```

Regra de resolução de exibição: `avatar_preset_id` presente → renderiza ilustração; senão `avatar_emoji` → emoji sobre `avatar_color`; senão iniciais do `nickname` sobre `avatar_color` (fallback atual implícito).

### 1.2 Supabase (participants já está wired)

- Migração nova `supabase/migrations/2026XXXXXXXXXX_participant_avatar.sql`:
  ```sql
  alter table participants
    add column avatar_preset_id text,
    add column avatar_emoji text,
    add column avatar_color text;
  ```
- Atualizar `participantMapper.ts` (map DB ↔ TS) para incluir os 3 campos nas duas direções.
- Sem RLS nova necessária — usa as policies existentes de `participants`.

### 1.3 Seed / mock

- `initialMockData.ts`: atribuir preset/emoji/cor default para os participantes seed (Pedro, Gabi, etc.) para não nascerem só com iniciais.

### 1.4 Galeria de presets

- Novo arquivo `src/services/avatarPresets.ts`: array estático `AVATAR_PRESETS` com ~12–16 entradas `{ id, label, render: 'emoji' | 'svg', value }`. Para não introduzir dependência nova nem custo de asset, a v1 usa **emoji temáticos de parque/viagem** (montanha-russa, sol, mala, avião, sorvete, etc.) como "presets", cada um com uma paleta de cor sugerida — ou seja, tecnicamente preset = emoji curado + cor combinada, o que também simplifica o dado (poderíamos até unificar `avatar_preset_id` e `avatar_emoji` num único campo — decisão de implementação, ver Abertos).

### 1.5 Componentes novos

- `src/components/Avatar.tsx` — componente puro `<Avatar participant={p} size="sm"|"md"|"lg" />`, aplica a regra de resolução do §1.1. Usado em todos os pontos do §1.6.
- `src/components/modals/AvatarPickerModal.tsx` (ou seção dentro do modal de edição de participante existente) — grid de presets + color picker + input de emoji custom, com preview ao vivo usando `<Avatar />`.

### 1.6 Pontos de integração (usar `<Avatar />` em vez do texto/inicial atual)

- `src/features/participants/*View.tsx` (card do participante) — plugar `AvatarPickerModal` no modal de criar/editar.
- `src/features/itinerary/ItineraryView.tsx`, `DayTimeline.tsx`, `MonthCalendar.tsx` — badges de `participant_status` (hoje provavelmente iniciais/ícone genérico).
- DRE / divisão de custos (feature financeira) — lista de participantes por item de despesa.
- `TasksView` (ou equivalente) — responsável/atribuído por tarefa.
- `Navigation.tsx` ou header, se houver seletor de "participante ativo".

### 1.7 Sequência de implementação sugerida

1. Migração SQL + mapper.
2. `avatarPresets.ts` + `Avatar.tsx` (puro, sem Supabase).
3. `AvatarPickerModal` plugado no fluxo de criar/editar participante (`updateParticipant`/`addParticipant` já existentes — só passam a persistir os 3 campos novos).
4. Substituir renderização de participante nos 5 pontos do §1.6, um de cada vez, rodando `npm run test` a cada troca.

---

## 2. Mods estéticos

### 2.1 Tema "clima de férias"

- Sem novo sistema de tema (não reativar `tailwind.config.js`, que está morto — CLAUDE.md é explícito nisso). Em vez disso: introduzir uma paleta de acento mais viva a título de "vibe de férias" nos elementos que já usam `slate-*`/`blue-*` hoje mais neutros (headers de card, barras de progresso do `coverageEngine`, badges de status) — trocar para gradientes/tons quentes (`amber-400→rose-400`, `sky-400→emerald-400`) em pontos de destaque, mantendo o restante do dark UI intacto. É um ajuste pontual de classes Tailwind, não uma re-arquitetura de tema.
- Ilustrações/emoji temáticos (sol, mala, parque) reaproveitados do `avatarPresets.ts` também podem enfeitar estados vazios (empty states) e headers de seção — reuso, não asset novo.

### 2.2 Gamificação leve

- Fonte de dados: `coverageEngine.ts` já calcula % de conclusão por dia/participante — **não precisa mudar a engine**, só consumir o resultado para UI nova.
- `src/components/BadgeCelebration.tsx` — dispara uma micro-animação (CSS keyframes, sem lib nova tipo canvas-confetti) quando a cobertura de um dia bate 100%. Simples: emojis "explodindo" com `@keyframes` + `transform`/`opacity`, removido do DOM após a animação.
- `src/components/AchievementBadge.tsx` — badge visual simples (ex: "🏆 Dia completo!", "🎢 Todos os brinquedos feitos") renderizado condicionalmente a partir do resultado de `computeCoverage`, exibido em `DayTimeline`/`MonthCalendar`.
- Tudo client-side, derivado, sem persistência nova — mesmo padrão de `auditEngine`/`coverageEngine` (recalculado, nunca salvo).

---

## 3. Tom do bot de WhatsApp

Arquivos a editar (nenhuma mudança de arquitetura, só conteúdo/prompt):

- `supabase/functions/_shared/tripContext.ts` — reescrever o system prompt: persona "assistente de viagem leve e caloroso da família", tom direto mas com emojis pontuais (não exagerar), instruir a NÃO ser formal/robótico, e a se dirigir à família com informalidade (ex: usar nomes/apelidos dos participantes quando fizer sentido).
- `supabase/functions/_shared/formatter.ts` — revisar o texto do digest diário (itinerário do dia, lembretes) para o mesmo tom: frases curtas, 1–2 emojis por mensagem relevante (☀️ manhã, 🎢 parque, ✅ tarefa, ✈️ voo), evitar bullet burocrático.
- Exemplos de antes/depois devem ser escritos e revisados por texto (não só prompt) antes do deploy, já que o LLM segue o prompt mas a resposta final pode variar — vale um teste manual via `whatsapp-webhook` local ou em produção com mensagem de teste após deploy.
- Sem mudança de schema, sem mudança nas 5 tools (`get_itinerary`, etc.) — é puramente prompt + template de texto.

---

## 4. Fora de escopo desta rodada

- Upload de foto real (avaliar depois se preset+emoji não for suficiente).
- Reativação de `tailwind.config.js` / tokens semânticos.
- Persistir conquistas/gamificação no banco (fica derivado, como o resto do audit/coverage).
- Generalizar os hardcodes de `auditEngine.ts`/`AiCopilotView.tsx` (nickname 'Pedro'/'Gabi', idade 12) — não faz parte deste pedido.

## 5. Pontos em aberto para o Antigravity decidir na implementação

- Unificar `avatar_preset_id` + `avatar_emoji` em um único campo (`avatar_value`) já que a v1 usa emoji para ambos — decisão de shape de dado, tanto faz para o produto.
- Nome/estilo exato dos badges de conquista (texto em pt-BR a definir na implementação, mantendo o tom trip-family).
