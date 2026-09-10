/**
 * Isolamento entre tenants — issue #35.
 *
 * Roda contra o projeto Supabase real (não há Postgres local no CI): cria dois
 * usuários, dois tenants e verifica, com o JWT de cada um, que a RLS impede
 * ler, escrever e apagar dados do outro. Um terceiro usuário entra por convite
 * e passa a ver a viagem do tenant que o convidou.
 *
 * Tudo que é criado tem prefixo `isolation-` e é apagado no afterAll com o
 * service role — inclusive os usuários em auth.users.
 *
 * Pulado quando as credenciais não estão no ambiente, para `npm run
 * test:isolation` não quebrar em máquina sem .env.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const configured = Boolean(SUPABASE_URL && PUBLISHABLE_KEY && SECRET_KEY);

const run = crypto.randomUUID().slice(0, 8);
const PASSWORD = `Isolation!${crypto.randomUUID()}`;

interface Actor {
  email: string;
  userId: string;
  client: SupabaseClient;
  tenantId: string;
  tripId: string;
}

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function createUser(admin: SupabaseClient, label: string): Promise<{ email: string; userId: string }> {
  const email = `isolation-${run}-${label}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Isolation ${label}` } });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
  return { email, userId: data.user.id };
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn(${email}): ${error.message}`);
  return client;
}

async function setupActor(admin: SupabaseClient, label: string): Promise<Actor> {
  const { email, userId } = await createUser(admin, label);
  const client = await signIn(email);

  // Mesmo caminho do app: RPC SECURITY DEFINER, nunca INSERT direto em tenants.
  const { data: tenantId, error: tenantErr } = await client.rpc('create_tenant_with_owner', { p_name: `isolation-${run}-${label}` });
  if (tenantErr || typeof tenantId !== 'string') throw new Error(`create_tenant_with_owner(${label}): ${tenantErr?.message}`);

  const { data: trip, error: tripErr } = await client
    .from('trips')
    .insert({ tenant_id: tenantId, title: `Viagem ${label}`, destination_main: 'Teste', start_date: '2027-01-10', end_date: '2027-01-20' })
    .select('id')
    .single();
  if (tripErr || !trip) throw new Error(`insert trip(${label}): ${tripErr?.message}`);

  const { error: partErr } = await client
    .from('participants')
    .insert({ trip_id: trip.id, full_name: `Pessoa ${label}`, birth_date: '1990-01-01', relationship: 'Teste' });
  if (partErr) throw new Error(`insert participant(${label}): ${partErr.message}`);

  return { email, userId, client, tenantId, tripId: trip.id };
}

describe.skipIf(!configured)('isolamento entre tenants (RLS)', () => {
  let admin: SupabaseClient;
  let a: Actor;
  let b: Actor;
  const createdUserIds: string[] = [];
  const createdTenantIds: string[] = [];

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    a = await setupActor(admin, 'a');
    b = await setupActor(admin, 'b');
    createdUserIds.push(a.userId, b.userId);
    createdTenantIds.push(a.tenantId, b.tenantId);

    // Dado sensível de tenant B, inserido por fora da UI (como o bot faz).
    await admin.from('whatsapp_messages').insert({ tenant_id: b.tenantId, direction: 'inbound', sender_phone: '5511999990000', body: 'segredo do tenant B' });
    await admin.from('ai_usage_logs').insert({ tenant_id: b.tenantId, user_name: '5511999990000', function_name: 'whatsapp_bot', provider: 'gemini', model: 'x' });
  });

  afterAll(async () => {
    if (!admin) return;
    for (const tenantId of createdTenantIds) await admin.from('tenants').delete().eq('id', tenantId);
    for (const userId of createdUserIds) await admin.auth.admin.deleteUser(userId);
  });

  it('cada usuário vê apenas as viagens do próprio tenant', async () => {
    const { data: tripsA } = await a.client.from('trips').select('id, tenant_id');
    const { data: tripsB } = await b.client.from('trips').select('id, tenant_id');
    expect(tripsA?.map(t => t.id)).toEqual([a.tripId]);
    expect(tripsB?.map(t => t.id)).toEqual([b.tripId]);
  });

  it('buscar a viagem do outro tenant pelo id devolve zero linhas (não erro)', async () => {
    const { data, error } = await a.client.from('trips').select('id').eq('id', b.tripId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('participantes, mensagens do WhatsApp e logs de IA do outro tenant são invisíveis', async () => {
    const { data: parts } = await a.client.from('participants').select('id').eq('trip_id', b.tripId);
    const { data: msgs } = await a.client.from('whatsapp_messages').select('id').eq('tenant_id', b.tenantId);
    const { data: logs } = await a.client.from('ai_usage_logs').select('id').eq('tenant_id', b.tenantId);
    expect(parts).toEqual([]);
    expect(msgs).toEqual([]);
    expect(logs).toEqual([]);
  });

  it('não dá para criar uma viagem dentro do tenant do outro', async () => {
    const { error } = await a.client
      .from('trips')
      .insert({ tenant_id: b.tenantId, title: 'Invasão', destination_main: 'X', start_date: '2027-01-01', end_date: '2027-01-02' });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501'); // row-level security violation
  });

  it('update e delete na viagem do outro tenant não afetam nenhuma linha', async () => {
    await a.client.from('trips').update({ title: 'hackeado' }).eq('id', b.tripId);
    await a.client.from('trips').delete().eq('id', b.tripId);
    const { data } = await admin.from('trips').select('title').eq('id', b.tripId).single();
    expect(data?.title).toBe('Viagem b');
  });

  it('não dá para ler a lista de membros nem convidar para o tenant do outro', async () => {
    const { data: members } = await a.client.from('memberships').select('user_id').eq('tenant_id', b.tenantId);
    expect(members).toEqual([]);
    const { error } = await a.client.from('tenant_invites').insert({ tenant_id: b.tenantId, email: 'x@example.com', role: 'admin' });
    expect(error).not.toBeNull();
  });

  it('delete_tenant recusa quem não é admin do tenant', async () => {
    const { error } = await a.client.rpc('delete_tenant', { p_tenant_id: b.tenantId });
    expect(error).not.toBeNull();
    const { data } = await admin.from('tenants').select('id').eq('id', b.tenantId);
    expect(data).toHaveLength(1);
  });

  it('usuário convidado passa a ver a viagem do tenant que o convidou — e só dela', async () => {
    const cEmail = `isolation-${run}-c@example.com`;
    const { error: inviteErr } = await a.client.from('tenant_invites').insert({ tenant_id: a.tenantId, email: cEmail, role: 'participant' });
    expect(inviteErr).toBeNull();

    // Cadastro depois do convite: handle_new_user resolve o convite pendente.
    const c = await createUser(admin, 'c');
    createdUserIds.push(c.userId);
    const cClient = await signIn(c.email);

    const { data: tripsC } = await cClient.from('trips').select('id');
    expect(tripsC?.map(t => t.id)).toEqual([a.tripId]);

    const { data: fromB } = await cClient.from('trips').select('id').eq('id', b.tripId);
    expect(fromB).toEqual([]);
  });

  it('admin apaga o próprio tenant e a cascata leva mensagens e logs junto', async () => {
    const { error } = await b.client.rpc('delete_tenant', { p_tenant_id: b.tenantId });
    expect(error).toBeNull();
    const { data: msgs } = await admin.from('whatsapp_messages').select('id').eq('tenant_id', b.tenantId);
    const { data: logs } = await admin.from('ai_usage_logs').select('id').eq('tenant_id', b.tenantId);
    const { data: trips } = await admin.from('trips').select('id').eq('tenant_id', b.tenantId);
    expect(msgs).toEqual([]);
    expect(logs).toEqual([]);
    expect(trips).toEqual([]);
  });
});

if (!configured) {
  describe('isolamento entre tenants (RLS)', () => {
    it.skip('pulado: defina SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY para rodar', () => {});
  });
}
