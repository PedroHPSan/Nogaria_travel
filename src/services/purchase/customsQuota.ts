import type { Participant, PurchaseAssumptions, PurchaseItem } from '../../types/database.types';
import type { OwnerQuota, QuotaResult, QuotaShare, RebalanceHint } from '../../types/purchase.types';
import { round2 } from '../money';

export interface QuotaItemInput {
  id: string;
  quota_owner_id: string;
  liquido_usd: number;
}

/** De quem é a cota que este item consome (RN-08). */
export function resolveQuotaOwner(item: PurchaseItem): string {
  return item.quota_owner_id ?? item.beneficiary_id ?? item.target_participant_id;
}

/**
 * A cota é individual e não cumulativa (RN-06): cada item pertence a
 * exatamente um titular, e um bem acima da cota gera excedente ainda que
 * outro viajante tenha folga.
 */
export function allocateCustomsQuota(
  items: QuotaItemInput[],
  participants: Participant[],
  a: PurchaseAssumptions,
): QuotaResult {
  const byItem: Record<string, QuotaShare> = {};
  const byOwner: Record<string, OwnerQuota> = {};

  const grouped = new Map<string, QuotaItemInput[]>();
  for (const item of items) {
    const list = grouped.get(item.quota_owner_id);
    if (list) list.push(item);
    else grouped.set(item.quota_owner_id, [item]);
  }

  for (const [ownerId, ownerItems] of grouped) {
    const participant = participants.find(p => p.id === ownerId);
    // Default é elegível (RN-09). Titular desconhecido também recebe a cota
    // padrão — a alternativa (zero) inventaria um imposto que não existe.
    const eligible = participant ? participant.quota_eligible !== false : true;
    const quota = eligible ? a.customs_quota_usd_per_person : 0;

    const total = round2(ownerItems.reduce((sum, i) => sum + i.liquido_usd, 0));
    const excedente = round2(Math.max(0, total - quota));
    const impostoTotal = round2((excedente * a.customs_excess_tax_pct) / 100);

    byOwner[ownerId] = {
      owner_id: ownerId,
      total_usd: total,
      quota_usd: quota,
      excedente_usd: excedente,
      folga_usd: round2(Math.max(0, quota - total)),
      imposto_total_usd: impostoTotal,
    };

    let somaImpostos = 0;
    let maiorShare = -1;
    let itemDeMaiorShare = '';

    for (const item of ownerItems) {
      const share = total > 0 ? item.liquido_usd / total : 0;
      const imposto = round2((excedente * share * a.customs_excess_tax_pct) / 100);
      somaImpostos = round2(somaImpostos + imposto);

      if (share > maiorShare) {
        maiorShare = share;
        itemDeMaiorShare = item.id;
      }

      byItem[item.id] = {
        quota_owner_id: ownerId,
        total_pessoa_usd: total,
        quota_usd: quota,
        excedente_usd: excedente,
        share_pct: round2(share * 100),
        imposto_do_item_usd: imposto,
      };
    }

    // O arredondamento por item desvia do total em centavos. O resíduo vai
    // para o item de maior share, de modo que a soma feche exatamente (RN-07b).
    const residuo = round2(impostoTotal - somaImpostos);
    if (residuo !== 0 && itemDeMaiorShare) {
      const alvo = byItem[itemDeMaiorShare];
      alvo.imposto_do_item_usd = round2(alvo.imposto_do_item_usd + residuo);
    }
  }

  const rebalance: RebalanceHint[] = [];
  for (const estourado of Object.values(byOwner)) {
    if (estourado.excedente_usd <= 0) continue;
    for (const folgado of Object.values(byOwner)) {
      if (folgado.owner_id === estourado.owner_id || folgado.folga_usd <= 0) continue;
      rebalance.push({
        from_owner_id: estourado.owner_id,
        to_owner_id: folgado.owner_id,
        folga_usd: folgado.folga_usd,
      });
    }
  }

  return { byItem, byOwner, rebalance };
}
