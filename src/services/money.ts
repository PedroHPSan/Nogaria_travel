/**
 * Arredonda para duas casas decimais (RN-07c).
 * Usa Math.round em vez do Number(x.toFixed(2)) do giftCardCalculator.ts:
 * toFixed depende da representação binária do número e devolve o centavo de
 * baixo em alguns valores de meio centavo. O rateio de cota precisa de
 * meio-para-cima determinístico, porque a soma dos impostos por item tem de
 * fechar exatamente com o imposto total do participante.
 */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Multiplicador de conversão USD -> BRL, já incluindo IOF e spread do cartão.
 * Ex.: câmbio 5.62 com IOF 3.38% e spread 0 => 5.809956
 */
export const fxMultiplier = (rate: number, iofPct: number, spreadPct: number): number =>
  rate * (1 + iofPct / 100 + spreadPct / 100);
