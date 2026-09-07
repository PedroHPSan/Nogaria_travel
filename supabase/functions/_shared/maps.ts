// Mapas/rotas do bot WhatsApp: link de navegação (grátis, sem API) + ETA
// opcional via Google Routes API. Partes puras (sem I/O) separadas do fetch,
// no mesmo corte que reminderScheduler.ts já usa, para serem testáveis sem rede.

export interface DirectionsPoint {
  /** Texto livre ("Magic Kingdom, Orlando") ou "lat,lng". */
  text: string;
  placeId?: string | null;
}

export type TravelMode = 'driving' | 'walking' | 'transit' | 'bicycling';

/**
 * Monta o deep link do Google Maps. Não exige API key nem coordenadas — aceita
 * texto livre em origin/destination — e funciona mesmo sem origin: o app do
 * celular usa a posição atual do aparelho nesse caso. É por isso que a tool
 * nunca fica "travada": sempre devolve link útil, só o ETA fica indisponível
 * sem origem resolvida.
 */
export function buildDirectionsUrl(input: {
  origin?: DirectionsPoint | null;
  destination: DirectionsPoint;
  travelMode?: TravelMode;
}): string {
  const params = new URLSearchParams();
  params.set('api', '1');
  params.set('travelmode', input.travelMode ?? 'driving');

  if (input.destination.placeId) {
    params.set('destination', input.destination.text);
    params.set('destination_place_id', input.destination.placeId);
  } else {
    params.set('destination', input.destination.text);
  }

  if (input.origin) {
    if (input.origin.placeId) {
      params.set('origin', input.origin.text);
      params.set('origin_place_id', input.origin.placeId);
    } else {
      params.set('origin', input.origin.text);
    }
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** "27 min (18,4 km)" — texto curto para caber numa frase do bot. */
export function formatEta(durationSeconds: number, distanceMeters: number): string {
  const minutes = Math.round(durationSeconds / 60);
  const km = (distanceMeters / 1000).toFixed(1).replace('.', ',');
  return `${minutes} min (${km} km)`;
}

/**
 * "que horas temos que sair" — a hora-limite de saída, dado o horário da
 * atividade, o tempo de deslocamento e a antecedência recomendada (mesma
 * coluna que os avisos de atividade já usam). Sem isso o ETA sozinho não
 * responde à pergunta real da família.
 */
export function computeLeaveBy(input: {
  activityTimeStart: string; // HH:MM ou HH:MM:SS
  etaSeconds: number;
  recommendedArrivalMinBefore?: number | null;
}): string {
  const [h, m] = input.activityTimeStart.split(':').map(Number);
  const activityMinutes = h * 60 + m;
  const bufferMinutes = input.recommendedArrivalMinBefore ?? 0;
  const travelMinutes = Math.round(input.etaSeconds / 60);
  const leaveMinutes = Math.max(0, activityMinutes - travelMinutes - bufferMinutes);
  const hh = String(Math.floor(leaveMinutes / 60) % 24).padStart(2, '0');
  const mm = String(leaveMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export interface OriginCandidate {
  text: string;
  lat?: number;
  lng?: number;
}

export interface ResolvedOrigin {
  kind: 'coords' | 'text' | 'ask';
  label?: string;
  point?: DirectionsPoint;
}

const PIN_FRESHNESS_MIN = 90;

/**
 * Precedência de origem, em ordem: local dito no texto > pin de localização
 * recente > hospedagem ativa na data > pede a localização. Pura — recebe os
 * candidatos já resolvidos pelo caller (que faz o I/O de cada um).
 */
export function resolveOrigin(input: {
  explicit: OriginCandidate | null;
  pin: { lat: number; lng: number; sharedAt: string } | null;
  accommodation: OriginCandidate | null;
  now: Date;
}): ResolvedOrigin {
  if (input.explicit) {
    return { kind: 'text', label: input.explicit.text, point: { text: input.explicit.text } };
  }

  if (input.pin) {
    const ageMin = (input.now.getTime() - new Date(input.pin.sharedAt).getTime()) / 60_000;
    if (ageMin >= 0 && ageMin <= PIN_FRESHNESS_MIN) {
      return {
        kind: 'coords',
        label: 'sua localização atual',
        point: { text: `${input.pin.lat},${input.pin.lng}` },
      };
    }
  }

  if (input.accommodation) {
    return { kind: 'text', label: input.accommodation.text, point: { text: input.accommodation.text } };
  }

  return { kind: 'ask' };
}

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/**
 * ETA via Routes API (Essentials, ~US$5/1k chamadas — uma viagem familiar não
 * chega perto do free tier de 10k/mês). Isolado do resto: se a key não está
 * configurada ou a chamada falha, o caller degrada para "só o link, sem ETA"
 * em vez de derrubar a tool inteira.
 */
export async function computeRoute(input: {
  apiKey: string;
  origin: DirectionsPoint;
  destination: DirectionsPoint;
  travelMode?: TravelMode;
}): Promise<{ durationSeconds: number; distanceMeters: number } | null> {
  const toWaypoint = (p: DirectionsPoint) =>
    p.placeId ? { placeId: p.placeId } : { address: p.text };

  const ROUTES_TRAVEL_MODE: Record<TravelMode, string> = {
    driving: 'DRIVE',
    walking: 'WALK',
    transit: 'TRANSIT',
    bicycling: 'BICYCLE',
  };

  const response = await fetch(ROUTES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': input.apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify({
      origin: { waypoint: toWaypoint(input.origin) },
      destination: { waypoint: toWaypoint(input.destination) },
      travelMode: ROUTES_TRAVEL_MODE[input.travelMode ?? 'driving'],
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { routes?: { duration?: string; distanceMeters?: number }[] };
  const route = data.routes?.[0];
  if (!route?.duration) return null;

  const durationSeconds = Number(route.duration.replace('s', ''));
  if (!Number.isFinite(durationSeconds)) return null;
  return { durationSeconds, distanceMeters: route.distanceMeters ?? 0 };
}
