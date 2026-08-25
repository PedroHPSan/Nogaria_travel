// Adapter de envio via Meta WhatsApp Cloud API (oficial).
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages

const GRAPH_API = 'https://graph.facebook.com/v21.0';

export interface MetaSendResult {
  waMessageId: string | null;
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
