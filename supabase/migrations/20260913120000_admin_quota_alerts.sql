-- Aviso de franquia hoje só chega pro usuário que mandou a mensagem, como
-- rodapé (#27). Quem administra a conta não fica sabendo até a família
-- reclamar. admin_alert_phone é opcional: sem ele, o comportamento não muda.
alter table public.whatsapp_configs
  add column if not exists admin_alert_phone text;

comment on column public.whatsapp_configs.admin_alert_phone is
  'Telefone (formato internacional, só dígitos) que recebe aviso de franquia (90%/100%) separado do rodapé enviado ao usuário. Nulo desativa o aviso ao admin.';
