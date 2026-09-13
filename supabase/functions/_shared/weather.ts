// Previsão do tempo do destino, para o digest diário do WhatsApp. Open-Meteo:
// sem API key, geocodifica o texto livre de destination_main e busca a
// previsão do dia. Melhor esforço — qualquer falha (destino não geocodificado,
// rede fora) devolve null e o digest sai sem o bloco de clima, nunca quebra.
const GEOCODE_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 8_000;

export interface WeatherSummary {
  tempMaxC: number;
  tempMinC: number;
  precipitationProbabilityMax: number;
  description: string;
}

// Subconjunto dos WMO weather codes (https://open-meteo.com/en/docs) — só os
// que aparecem com alguma frequência nos destinos típicos deste app.
const WEATHER_CODE_PT: Record<number, string> = {
  0: 'céu limpo',
  1: 'poucas nuvens',
  2: 'parcialmente nublado',
  3: 'nublado',
  45: 'neblina',
  48: 'neblina com geada',
  51: 'garoa fraca',
  53: 'garoa',
  55: 'garoa forte',
  61: 'chuva fraca',
  63: 'chuva',
  65: 'chuva forte',
  71: 'neve fraca',
  73: 'neve',
  75: 'neve forte',
  80: 'pancadas de chuva fracas',
  81: 'pancadas de chuva',
  82: 'pancadas de chuva fortes',
  95: 'tempestade',
  96: 'tempestade com granizo',
  99: 'tempestade forte com granizo',
};

function describeWeatherCode(code: number): string {
  return WEATHER_CODE_PT[code] ?? 'tempo variável';
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function geocode(destination: string): Promise<{ latitude: number; longitude: number } | null> {
  const url = `${GEOCODE_ENDPOINT}?name=${encodeURIComponent(destination)}&count=1&language=pt&format=json`;
  const data = (await fetchJson(url)) as { results?: { latitude: number; longitude: number }[] };
  const first = data.results?.[0];
  return first ? { latitude: first.latitude, longitude: first.longitude } : null;
}

/** Previsão do dia (min/max/chuva) para o destino, ou null se não der pra resolver. */
export async function fetchDailyWeather(input: {
  destination: string;
  dateIso: string;
  timeZone: string;
}): Promise<WeatherSummary | null> {
  try {
    const point = await geocode(input.destination);
    if (!point) return null;

    const url =
      `${FORECAST_ENDPOINT}?latitude=${point.latitude}&longitude=${point.longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
      `&timezone=${encodeURIComponent(input.timeZone)}&start_date=${input.dateIso}&end_date=${input.dateIso}`;
    const data = (await fetchJson(url)) as {
      daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[]; weathercode?: number[] };
    };
    const daily = data.daily;
    if (!daily?.temperature_2m_max?.length) return null;

    return {
      tempMaxC: Math.round(daily.temperature_2m_max[0]),
      tempMinC: Math.round(daily.temperature_2m_min?.[0] ?? daily.temperature_2m_max[0]),
      precipitationProbabilityMax: daily.precipitation_probability_max?.[0] ?? 0,
      description: describeWeatherCode(daily.weathercode?.[0] ?? -1),
    };
  } catch (err) {
    console.warn(`[weather] Falha ao buscar previsão para "${input.destination}":`, err instanceof Error ? err.message : err);
    return null;
  }
}
