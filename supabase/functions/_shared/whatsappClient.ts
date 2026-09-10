// Adapter de envio via Meta WhatsApp Cloud API (oficial).
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages

const GRAPH_API = 'https://graph.facebook.com/v21.0';

export interface MetaSendResult {
  waMessageId: string | null;
}

/** Teto pra não mandar um PDF de 40 MB inline pro Gemini (e pra memória da function). */
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

/**
 * Baixa uma mídia recebida pelo webhook. A Meta exige dois passos: o id da
 * mídia resolve pra uma URL temporária (GET /{media_id}), e a URL só serve o
 * binário com o mesmo bearer — sem o token ela responde 401.
 */
export async function downloadMedia(input: { mediaId: string; accessToken: string }): Promise<{ mimeType: string; base64: string; bytes: number }> {
  const headers = { Authorization: `Bearer ${input.accessToken}` };
  const meta = await fetch(`${GRAPH_API}/${input.mediaId}`, { headers });
  if (!meta.ok) throw new Error(`Meta media lookup retornou HTTP ${meta.status}`);
  const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!info.url) throw new Error('Meta não devolveu URL da mídia.');
  if ((info.file_size ?? 0) > MAX_MEDIA_BYTES) throw new Error('Arquivo grande demais para leitura.');

  const file = await fetch(info.url, { headers });
  if (!file.ok) throw new Error(`Download da mídia retornou HTTP ${file.status}`);
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.byteLength > MAX_MEDIA_BYTES) throw new Error('Arquivo grande demais para leitura.');

  let binary = '';
  for (let i = 0; i < buffer.byteLength; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  }
  return { mimeType: info.mime_type ?? file.headers.get('content-type') ?? 'application/octet-stream', base64: btoa(binary), bytes: buffer.byteLength };
}

/** Envia mensagem de texto 1:1. `to` é o telefone em formato internacional só com dígitos (ex: 5511998887777). */
export async function sendTextMessage(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}): Promise<MetaSendResult> {
  const response = await fetch(`${GRAPH_API}/${input.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to,
      type: 'text',
      text: { preview_url: false, body: input.text },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Meta Cloud API retornou HTTP ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const data = (await response.json()) as { messages?: { id?: string }[] };
  return { waMessageId: data.messages?.[0]?.id ?? null };
}
