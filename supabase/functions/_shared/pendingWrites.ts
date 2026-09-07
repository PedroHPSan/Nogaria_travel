// Confirmação em duas fases para escritas destrutivas do bot (mover horário,
// marcar concluído). "Confirme antes de escrever" era só instrução de system
// prompt — um modelo estatístico não é um mecanismo de controle. Aqui a
// intenção validada e já resolvida (ids, não texto) fica no banco; a segunda
// chamada aplica exatamente o que foi mostrado à família, nunca uma
// reinterpretação dos argumentos da vez seguinte.
//
// Chave é sender_phone, não um token que o modelo precisa "lembrar": o
// histórico do bot só persiste texto (whatsapp_messages.body), nunca
// resultado de tool, e a confirmação chega numa mensagem do WhatsApp
// SEGUINTE — outro round de Gemini, sem o contents[] da primeira chamada.
// Buscar a pendência pelo telefone é o que faz a confirmação sobreviver esse
// corte de contexto.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const EXPIRATION_MINUTES = 10;

export interface PendingWrite {
  toolName: string;
  payload: Record<string, unknown>;
  preview: string;
}

/**
 * Grava (ou substitui) a pendência do telefone. Uma família só tem uma ação
 * pendente por vez — pedir uma segunda enquanto a primeira está aberta
 * substitui a anterior, que é o comportamento certo ("deixa pra lá, quero
 * outra coisa" não deveria exigir cancelar explicitamente).
 */
export async function stagePendingWrite(
  supabase: SupabaseClient,
  input: { tenantId: string; tripId: string; senderPhone: string } & PendingWrite,
): Promise<void> {
  const { error } = await supabase.from('pending_writes').upsert(
    {
      tenant_id: input.tenantId,
      trip_id: input.tripId,
      sender_phone: input.senderPhone,
      tool_name: input.toolName,
      payload: input.payload,
      preview: input.preview,
      expires_at: new Date(Date.now() + EXPIRATION_MINUTES * 60_000).toISOString(),
    },
    { onConflict: 'sender_phone' },
  );
  if (error) throw new Error(`Erro ao registrar confirmação pendente: ${error.message}`);
}

/**
 * Consome a pendência (se houver, do MESMO tool_name e ainda não expirada) e
 * a apaga — uma confirmação só se aplica uma vez. `toolName` diferente do
 * pedido original é tratado como "não achei" em vez de aplicar por engano:
 * o modelo pode ter mudado de assunto entre as duas mensagens.
 */
export async function consumePendingWrite(
  supabase: SupabaseClient,
  input: { senderPhone: string; toolName: string },
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('pending_writes')
    .select('id, payload, expires_at')
    .eq('sender_phone', input.senderPhone)
    .eq('tool_name', input.toolName)
    .maybeSingle();
  if (error) throw new Error(`Erro ao buscar confirmação pendente: ${error.message}`);
  if (!data) return null;

  await supabase.from('pending_writes').delete().eq('id', data.id);

  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.payload as Record<string, unknown>;
}
