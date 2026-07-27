# Migração para Supabase — Fatia 1: fundação e wizard de primeira viagem

**Data:** 2026-07-27
**Escopo:** primeira de seis fatias da migração do `TripContext` do `localStorage` para o Supabase.

## Problema

O app tem autenticação real, isolamento multi-tenant e o schema completo das ~19 entidades vivo no Postgres com RLS. Mas todo dado de viagem mora no `localStorage` de um navegador: o `TripContext` tem 39 referências a `localStorage` e zero ao `supabase`.

Duas consequências concretas, ambas verificadas:

1. **Nada é compartilhado entre membros do tenant.** Convidar alguém para o time não dá acesso a nenhum dado de viagem, porque não existe dado de viagem no banco.
2. **A pesquisa de preços com IA não funciona.** A Edge Function `price-research` valida acesso chamando `is_trip_member(trip_id)` contra o Postgres, mas o `trip_id` que o cliente envia é uma string do `localStorage`. Consulta ao banco em 2026-07-27: `trips: 0`, `participants: 0`, `purchase_items: 0`. A função devolve 403 corretamente — está protegendo um recurso que nunca foi cadastrado.

O segundo item é uma contradição estrutural que nenhuma verificação headless pegaria: cada metade estava certa isoladamente, e ninguém checou que o dado enviado pelo cliente existe no banco consultado pela função.

## Decisões tomadas no brainstorm

| Questão | Decisão |
|---|---|
| Objetivo | Migração completa como fundação; colaboração e destrave da IA como consequência |
| Escritas | Otimistas, com falha visível e persistente |
| Dados atuais do `localStorage` | **Começar limpo** — não serão importados |
| Escopo do wizard | Viagem + participantes |
| Testes | Mappers puros + `jsdom` para os hooks |
| Estrutura | Um hook por coleção; primitivo compartilhado extraído só na fatia 2 |

Começar limpo elimina o passo mais perigoso do projeto — remapear IDs legíveis (`trip-miami-orlando-2026`, `p-pedro`) para `uuid` reescrevendo todas as referências entre tabelas. Em troca, a viagem que hoje está no navegador do Pedro não vai para o banco.

## Decomposição das seis fatias

1. **Fundação + wizard** (este spec) — o padrão da camada de dados provado em `trips` e `participants`
2. **Domínio de compras** — `purchase_items`, `price_quotes`, `purchase_assumptions`, `gift_cards`; destrava a IA
3. **Logística** — `flights`, `accommodations`, `transports`, `itinerary`, `luggages`
4. **Financeiro e resto** — `expenses`, `tasks`, `decisions`, `loyalty`, configs de IA
5. **Documentos** — `documents` + Supabase Storage
6. **Colaboração** — realtime ou refetch, conflito de edição

Cada fatia tem seu próprio spec, plano e execução. O padrão desenhado aqui é copiado pelas fatias 2 a 4.

## Arquitetura

Diretório novo `src/data/`, que corrige de passagem a inversão de dependência apontada em revisão anterior (hoje o `TripContext` importa de `src/features/`). A direção passa a ser `context/` → `data/` → `services/`.

```
src/data/
  useTripsData.ts
  useParticipantsData.ts
  mappers/
    tripMapper.ts
    participantMapper.ts
```

### Mappers

Funções puras traduzindo entre linha do Postgres e tipo TS. Resolvem duas divergências reais:

- **`participants` não tem coluna `age`** — só `birth_date`. O mapper deriva a idade na leitura. Isso elimina o gotcha documentado no `CLAUDE.md`: hoje `age` é campo guardado e o `auditEngine` lê direto, então alterar a data de nascimento sem alterar a idade quebra regras de restrição etária em silêncio. Derivada, a idade nunca fica velha, e nenhum consumidor precisa mudar.
- **IDs viram `uuid`**, gerados pelo cliente (ver abaixo).

### Corte limpo, sem escrita dupla

`trips` e `participants` saem do `localStorage` e passam a ler e escrever exclusivamente no Supabase. As outras 14 coleções permanecem no `localStorage`. O `TripContext` fica híbrido durante a transição — isso é esperado, não dívida. Manter duas fontes vivas para a mesma coleção convida à divergência silenciosa.

### Escopo por tenant

Os hooks leem `activeTenantId` do `AuthContext`; as consultas filtram por ele e a RLS reforça no banco. O `activeTripId` continua no `localStorage`: "qual viagem estou olhando" é preferência de interface, não dado compartilhado.

Hoje `activeTripId` inicializa com `trips[0]?.id || INITIAL_TRIP.id` (`TripContext.tsx:360`). Ao começar limpo, esse fallback aponta para uma viagem semeada que não existe mais — precisa virar "nenhuma viagem ativa" e deixar o wizard resolver.

### Superfície de CRUD preservada

Os nomes e assinaturas das funções expostas pelo `useTrip()` **não mudam**. As telas continuam chamando `createTrip(dados)`, `addParticipant(dados)`, `updateParticipant(id, patch)` e `deleteParticipant(id)` exatamente como hoje, sem `await` e sem estado de carregamento próprio — é o que torna a escrita otimista barata em termos de mudança.

Vale registrar a superfície real de `trips` hoje: apenas `createTrip` e `setActiveTripId`. Não existe `updateTrip` nem `deleteTrip`, e esta fatia **não** os acrescenta — criar isso é decisão de produto, não requisito da migração.

## Caminho de escrita

### IDs gerados no cliente

O cliente gera o `uuid` com o `newId()` existente (`crypto.randomUUID()`) e o envia no insert. O Postgres aceita chave primária explícita; o `default gen_random_uuid()` permanece para outros caminhos.

Isso elimina a janela clássica da escrita otimista: sem ID temporário, não há reconciliação, e não existe momento em que uma chave estrangeira possa apontar para um ID que está prestes a mudar.

### Ciclo

1. Aplica no estado local imediatamente
2. Guarda o valor anterior (linha antiga no update, linha removida no delete)
3. Dispara a chamada ao Supabase
4. Sucesso: nada a fazer
5. Falha: reverte para o valor guardado e registra a falha

### Falha visível e persistente

Nada de toast que evapora. O contexto expõe uma lista de falhas e o shell do app mostra uma faixa enquanto houver alguma, visível de qualquer aba:

```
⚠ Não foi possível salvar 1 alteração.
  Participante "Gabriela" — falha ao atualizar.
  [Tentar de novo]  [Descartar]
```

**Semântica dos dois botões**, para não haver interpretação dupla:

- **"Tentar de novo"** reaplica a mudança no estado local e refaz a chamada, do passo 1. Se falhar outra vez, a falha volta para a lista — não há limite de tentativas nem backoff nesta fatia.
- **"Descartar"** remove apenas o aviso. A reversão já ocorreu no passo 5, então descartar nunca deixa a tela mentindo: o estado local já voltou a refletir o banco.

Essa ênfase vem da evidência do trabalho anterior: gift card gasto em dobro, câmbio corrompido contaminando toda decisão, registro de uso que desligava o próprio limite de gasto — todo defeito sério era silencioso.

### Concorrência

Última escrita vence, sem detecção de conflito. Escolha deliberada para esta fatia; conflito real é assunto da fatia 6.

## Wizard de primeira viagem

### Posição

O `AuthGate` já encadeia portões: sem sessão → `AuthScreen`; com sessão e nenhum tenant → `OnboardingScreen`; caso contrário, o app. O wizard vira o degrau seguinte: **tenant existe, nenhuma viagem** → `TripWizard`. Tela cheia, como o `OnboardingScreen`, não modal.

### Passos

1. **A viagem** — nome, destino, data de ida e de volta. Validação manual no padrão dos modais existentes: nome não vazio, volta não anterior à ida.
2. **Quem vai** — nome, apelido, data de nascimento e orçamento, com opção de adicionar mais. Pelo menos um participante para avançar.
3. **Confirmação** — resumo do que será criado; a gravação acontece aqui.

O passo 2 coleta **data de nascimento, nunca idade** — a decisão do mapper aparecendo na interface. Não existe campo de idade em lugar nenhum do sistema para ficar velho.

### Falha parcial

Grava a viagem, depois os participantes. Se um participante falhar, a viagem já existe — estado legítimo, já que viagem sem participante é válida e o usuário pode adicionar depois. A falha cai na mesma faixa persistente, nomeando quem não entrou.

Uma RPC `SECURITY DEFINER` criando tudo numa transação foi considerada e descartada: acrescenta migração e função de banco para proteger contra um estado que já é válido. Se a falha parcial incomodar na prática, a RPC entra depois sem quebrar nada.

### Reaproveitamento

Construído como componente próprio, não embutido no `AuthGate`, para que o seletor de viagens possa reabri-lo como "Nova viagem". Esta fatia liga apenas o gatilho do estado vazio.

## Testes

### Mappers — ambiente `node`

Conversão nos dois sentidos e os casos que mordem na derivação de idade: aniversário hoje, 29 de fevereiro, `birth_date` ausente, data no futuro.

### Hooks — ambiente `jsdom`

Instalar `jsdom` e `@testing-library/react`. Vitest escolhe ambiente por arquivo via docblock, então só os arquivos de hook pagam o custo do DOM.

O que os testes de hook provam:

- a escrita aparece no estado local antes da resposta do servidor
- uma falha reverte para o valor anterior, não para um valor qualquer
- a falha fica registrada e visível
- um `delete` que falha traz a linha de volta com todos os campos, não uma casca

O cliente Supabase entra por injeção, como fronteira. Não é mock da nossa lógica: o ciclo otimista testado é o código real; o que se substitui é a rede.

### Carona

O `vitest.config.ts` está fora do grafo do `tsc -b` (pendência menor anotada no trabalho anterior), então erro de tipo nele só aparece em runtime. Como esta fatia mexe na configuração de teste, ele entra no `include` do `tsconfig.node.json`.

## Fora do escopo

- As outras 14 coleções — permanecem no `localStorage`
- Realtime e detecção de conflito — fatia 6
- Upload de documentos e Storage — fatia 5
- Importar os dados atuais do `localStorage` — decisão de começar limpo
- O vazamento do ID cru no alerta de cota (`purchaseDecisionEngine.ts:355` interpola `quota_owner_id`, exibindo "A cota de p-pedro está...") — correção pontual à parte

## Restrições herdadas do projeto

- `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` ligados — `npm run dev` não avisa, só `npm run build`
- Valores monetários guardados em USD, exceto campos marcados BRL
- Sem biblioteca de formulário: validação manual
- Tailwind com classes cruas da paleta mais `.glass-card` / `.glass-panel`; os tokens de `tailwind.config.js` estão mortos sob Tailwind v4
- Ícones `lucide-react`, interface em pt-BR
- `npm run lint` termina com exatamente 2 warnings conhecidos
