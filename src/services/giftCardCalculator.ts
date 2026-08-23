export interface GiftCardFinancials {
  nominalValue: number;
  paidAmount: number;
  cashbackPct: number;
  cashbackAmount: number;
  netCost: number;
  effectiveSavings: number;
  effectiveSavingsPct: number;
}

/**
 * Calculates exact liquid cost, cashbacks, and effective savings for gift cards.
 * Example: A $50 gift card bought for $35 with 4% cashback on the $35 purchase:
 * - Cashback Amount: $35 * 0.04 = $1.40
 * - Net Cost: $35 - $1.40 = $33.60
 * - Effective Savings: $50 - $33.60 = $16.40
 * - Effective Savings %: ($16.40 / $50) * 100 = 32.8%
 */
export function calculateGiftCardFinancials(
  nominalValue: number,
  paidAmount: number,
  cashbackPct: number = 0
): GiftCardFinancials {
  const safeNominal = Math.max(0, nominalValue);
  const safePaid = Math.max(0, paidAmount);
  const safeCashbackPct = Math.max(0, cashbackPct);

  const cashbackAmount = Number((safePaid * (safeCashbackPct / 100)).toFixed(2));
  const netCost = Number((safePaid - cashbackAmount).toFixed(2));
  const effectiveSavings = Number((safeNominal - netCost).toFixed(2));
  const effectiveSavingsPct = safeNominal > 0
    ? Number(((effectiveSavings / safeNominal) * 100).toFixed(2))
    : 0;

  return {
    nominalValue: safeNominal,
    paidAmount: safePaid,
    cashbackPct: safeCashbackPct,
    cashbackAmount,
    netCost,
    effectiveSavings,
    effectiveSavingsPct
  };
}

/**
 * Aggregate savings across a portfolio of gift cards (already-persisted
 * records, each carrying its own denormalized nominal_value/net_cost).
 */
export function calculateGiftCardPortfolioSavings(
  giftCards: Array<{ nominal_value: number; net_cost: number }>
): { totalNominal: number; totalNetCost: number; totalSavings: number; avgSavingsPct: number } {
  const totalNominal = giftCards.reduce((sum, g) => sum + g.nominal_value, 0);
  const totalNetCost = giftCards.reduce((sum, g) => sum + g.net_cost, 0);
  const totalSavings = totalNominal - totalNetCost;
  const avgSavingsPct = totalNominal > 0 ? (totalSavings / totalNominal) * 100 : 0;

  return { totalNominal, totalNetCost, totalSavings, avgSavingsPct };
}

export function calculateGiftCardNetCost(
  nominalValue: number,
  paidAmount: number,
  cashbackPct: number = 0
) {
  const fin = calculateGiftCardFinancials(nominalValue, paidAmount, cashbackPct);
  return {
    cashbackValue: fin.cashbackAmount,
    netCost: fin.netCost,
    effectiveSavingsUSD: fin.effectiveSavings,
    effectiveSavingsPct: fin.effectiveSavingsPct
  };
}


/**
 * Calculates net flight cost considering miles/points acquisition cost, club fees, taxes, and cash comparison.
 */
export function calculateFlightMileValue(
  cashPriceUSD: number,
  pointsAmount: number,
  pointAcquisitionCostPerThousandBRL: number,
  taxesUSD: number,
  exchangeRateBRLUSD: number = 5.60
): {
  pointsValueUSD: number;
  totalCostUSD: number;
  savingsUSD: number;
  savingsPct: number;
} {
  const pointsCostBRL = (pointsAmount / 1000) * pointAcquisitionCostPerThousandBRL;
  const pointsValueUSD = pointsCostBRL / exchangeRateBRLUSD;
  const totalCostUSD = pointsValueUSD + taxesUSD;
  const savingsUSD = cashPriceUSD - totalCostUSD;
  const savingsPct = cashPriceUSD > 0 ? (savingsUSD / cashPriceUSD) * 100 : 0;

  return {
    pointsValueUSD: Number(pointsValueUSD.toFixed(2)),
    totalCostUSD: Number(totalCostUSD.toFixed(2)),
    savingsUSD: Number(savingsUSD.toFixed(2)),
    savingsPct: Number(savingsPct.toFixed(2))
  };
}
