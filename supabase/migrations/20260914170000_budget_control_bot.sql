-- Controle de orçamento pelo bot: organizador registra gastos pelo WhatsApp
-- conforme acontecem, e recebe diariamente (junto do daily-digest) o custo
-- estimado do roteiro do dia + uma pergunta sobre o gasto real.

-- Mesmo padrão de can_manage_itinerary (migration 20260914120000): flag por
-- participante, não por tenant, porque nem todo organizador do roteiro é
-- quem cuida do dinheiro da viagem.
alter table public.participants
  add column if not exists can_manage_budget boolean not null default false;

comment on column public.participants.can_manage_budget is
  'Autoriza a tool add_expense do bot (registrar gasto pelo WhatsApp) e o recebimento do checkin diário de orçamento. Ausente/undefined equivale a false.';

-- Mesmo critério de seed do can_manage_itinerary — sem isto ninguém consegue
-- usar a feature no dia do deploy.
update public.participants
set can_manage_budget = true
where is_minor = false
  and whatsapp_phone is not null
  and can_manage_budget = false;

-- 'budget_checkin': pergunta diária de gastos enviada só a quem tem
-- can_manage_budget, junto do daily-digest — mesmo motivo de 'alert' já
-- existir: loadHistory filtra kind = 'chat', então isto entraria no
-- histórico de conversa do modelo como se fosse um turno da família.
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_kind_check;
alter table public.whatsapp_messages
  add constraint whatsapp_messages_kind_check
  check (kind in ('chat', 'digest', 'reminder', 'checkin', 'alert', 'budget_checkin'));
