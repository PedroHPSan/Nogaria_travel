/**
 * Arredonda para duas casas decimais (RN-07c).
 * Mesma convenção do giftCardCalculator.ts, para que os dois módulos
 * nunca divirjam em centavos.
 */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Multiplicador de conversão USD -> BRL, já incluindo IOF e spread do cartão.
 * Ex.: câmbio 5.62 com IOF 3.38% e spread 0 => 5.809956
 */
export const fxMultiplier = (rate: number, iofPct: number, spreadPct: number): number =>
  rate * (1 + iofPct / 100 + spreadPct / 100);
