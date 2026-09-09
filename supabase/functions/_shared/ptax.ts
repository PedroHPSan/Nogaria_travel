// Parser puro da resposta da API Olinda (Banco Central) para a PTAX USD/BRL.
// Sem I/O: a edge function `exchange-rate-sync` faz o fetch e chama daqui.

/** Linha do OData `CotacaoDolarPeriodo` como o BCB devolve. */
export interface PtaxRow {
  cotacaoCompra: number;
  cotacaoVenda: number;
  dataHoraCotacao: string; // "2026-09-08 13:09:31.123"
  tipoBoletim?: string; // "Abertura" | "Intermediário" | "Fechamento PTAX" (CotacaoDolarPeriodo devolve só fechamento)
}

export interface DailyRate {
  date: string; // YYYY-MM-DD
  rate: number;
}

/** Data `MM-DD-YYYY` que o Olinda exige nos parâmetros da query. */
export function toOlindaDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${m}-${d}-${y}`;
}

/** URL do OData para o intervalo [start, end] (datas ISO), ordenado do mais recente. */
export function buildPtaxUrl(startIso: string, endIso: string): string {
  const base = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/';
  const path =
    `CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
    `?@dataInicial='${toOlindaDate(startIso)}'&@dataFinalCotacao='${toOlindaDate(endIso)}'` +
    `&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao,tipoBoletim&$orderby=dataHoraCotacao%20desc`;
  return base + path;
}

function isPtaxRow(value: unknown): value is PtaxRow {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.cotacaoVenda === 'number' && Number.isFinite(v.cotacaoVenda) && v.cotacaoVenda > 0 && typeof v.dataHoraCotacao === 'string';
}

/**
 * Extrai uma taxa por dia (venda, boletim de fechamento quando houver o campo).
 * Fronteira de dados: tudo que não bate com o formato esperado é descartado,
 * nunca lançado — um dia malformado não pode derrubar a sincronização dos outros.
 */
export function parsePtaxResponse(payload: unknown): DailyRate[] {
  if (!payload || typeof payload !== 'object') return [];
  const rows = (payload as { value?: unknown }).value;
  if (!Array.isArray(rows)) return [];

  const byDate = new Map<string, number>();
  for (const raw of rows) {
    if (!isPtaxRow(raw)) continue;
    if (raw.tipoBoletim && raw.tipoBoletim !== 'Fechamento PTAX' && raw.tipoBoletim !== 'Fechamento') continue;
    const date = raw.dataHoraCotacao.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    // Linhas já vêm do mais recente para o mais antigo; a primeira de cada dia vence.
    if (!byDate.has(date)) byDate.set(date, Number(raw.cotacaoVenda.toFixed(6)));
  }

  return Array.from(byDate.entries())
    .map(([date, rate]) => ({ date, rate }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
