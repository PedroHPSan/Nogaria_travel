-- Fundações do replanejamento facilitado (bot + tela): quem pode disparar
-- ações em lote/destrutivas via WhatsApp, e o gancho para casar itens do
-- roteiro com entidades de fontes externas (themeparks.wiki).

-- Hoje qualquer telefone que fale com o número do bot obtém o executor
-- completo de tools com service role (RLS bypassada) — ações individuais
-- (marcar feito, confirmar check-in, ajustar o próprio aviso) continuam
-- livres por decisão de produto, mas empurrar um dia inteiro ou trocar dois
-- dias é destrutivo o bastante para exigir que o telefone pertença a um
-- participante marcado como organizador do roteiro.
alter table public.participants
  add column if not exists can_manage_itinerary boolean not null default false;

comment on column public.participants.can_manage_itinerary is
  'Autoriza ações em LOTE/destrutivas do bot sobre o roteiro (replan_day: empurrar dia, trocar dias, mover dia). Ações individuais (mark_itinerary_item_done, confirm_itinerary_outcome, set_activity_reminder) não exigem isto.';

-- Seed inicial: sem isto, ninguém consegue usar a feature no dia do deploy e
-- parece bug, não ausência de configuração. Critério deliberadamente simples
-- (adulto com telefone cadastrado) — ajuste fino fica para o ParticipantModal.
update public.participants
set can_manage_itinerary = true
where is_minor = false
  and whatsapp_phone is not null
  and can_manage_itinerary = false;

-- Casamento (uma vez, preguiçoso) entre um item do roteiro e a entidade
-- correspondente na themeparks.wiki, para não depender de comparação de texto
-- a cada mensagem. null = nunca resolvido (ou sem correspondência confiável) —
-- a tool de condições nunca afirma status de um item sem isto preenchido.
alter table public.itinerary_items
  add column if not exists external_entity_id text;

create index if not exists itinerary_items_external_entity_idx
  on public.itinerary_items (external_entity_id)
  where external_entity_id is not null;

comment on column public.itinerary_items.external_entity_id is
  'Id da atração/show na themeparks.wiki (ver _shared/parkStatus.ts). Resolvido uma vez e corrigível à mão; null = sem correspondência confiável, nunca chutar.';

-- 'alert': mensagem proativa de condições (clima, parque fechado, atração em
-- manutenção) — mesmo motivo de 'digest'/'reminder'/'checkin' já existirem:
-- loadHistory filtra kind = 'chat', então um alerta com kind errado entraria
-- no histórico de conversa do modelo como se fosse um turno da família.
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_kind_check;
alter table public.whatsapp_messages
  add constraint whatsapp_messages_kind_check
  check (kind in ('chat', 'digest', 'reminder', 'checkin', 'alert'));
