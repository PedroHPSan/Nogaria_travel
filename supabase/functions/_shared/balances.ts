// "Quem deve pra quem" (estilo Splitwise) — módulo puro, sem imports, usado
// pelo app (dreEngine.ts) e pelo bot (tool get_balances). Vive em _shared por
// ser o único diretório que o bundler das edge functions e o Vite alcançam.
//
// Só entram desembolsos reais: despesa com status 'paid' e pagador definido.
// Itens planejados (voo, hotel, ingresso) sem pagador inflariam o "consumo"
// de todo mundo sem crédito pra ninguém, e o resultado seria todos devedores
// e nenhum acerto — foi exatamente o que o algoritmo antigo do DRE fazia.
//
// O BRL usa o valor congelado na despesa (amount_brl, câmbio do dia em que
// ela foi criada), nunca a cotação de hoje: a família paga Pix pelo que
// desembolsou de fato, não pelo câmbio do momento em que abre o app.

export interface BalanceExpense {
  amount_usd: number;
  amount_brl: number;
  paid_by_id?: string | null;
  beneficiary_ids?: string[] | null;
  status?: string;
}

export interface BalanceParticipant {
  id: string;
  name: string;
}

export interface ParticipantBalance {
  participant_id: string;
  name: string;
  paid_usd: number;
  paid_brl: number;
  share_usd: number;
  share_brl: number;
  net_usd: number;
  net_brl: number;
  status: 'creditor' | 'debtor' | 'balanced';
}

export interface Settlement {
  from_id: string;
  from_name: string;
  to_id: string;
  to_name: string;
  amount_usd: number;
  amount_brl: number;
}

export interface BalancesResult {
  balances: ParticipantBalance[];
  settlements: Settlement[];
}

const round2 = (n: number) => Number(n.toFixed(2));
/** Abaixo disto é arredondamento, não dívida. */
const EPSILON_BRL = 0.5;

export function computeBalances(expenses: BalanceExpense[], participants: BalanceParticipant[]): BalancesResult {
  const ids = new Set(participants.map(p => p.id));
  const acc = new Map<string, { paidUsd: number; paidBrl: number; shareUsd: number; shareBrl: number }>();
  for (const p of participants) acc.set(p.id, { paidUsd: 0, paidBrl: 0, shareUsd: 0, shareBrl: 0 });

  for (const e of expenses) {
    if (e.status !== 'paid' || !e.paid_by_id || !ids.has(e.paid_by_id)) continue;

    const listed = (e.beneficiary_ids ?? []).filter(id => ids.has(id));
    const beneficiaries = listed.length > 0 ? listed : participants.map(p => p.id);
    if (beneficiaries.length === 0) continue;

    const payer = acc.get(e.paid_by_id)!;
    payer.paidUsd += e.amount_usd;
    payer.paidBrl += e.amount_brl;

    const shareUsd = e.amount_usd / beneficiaries.length;
    const shareBrl = e.amount_brl / beneficiaries.length;
    for (const id of beneficiaries) {
      const b = acc.get(id)!;
      b.shareUsd += shareUsd;
      b.shareBrl += shareBrl;
    }
  }

  const balances: ParticipantBalance[] = participants.map(p => {
    const a = acc.get(p.id)!;
    const netUsd = a.paidUsd - a.shareUsd;
    const netBrl = a.paidBrl - a.shareBrl;
    return {
      participant_id: p.id,
      name: p.name,
      paid_usd: round2(a.paidUsd),
      paid_brl: round2(a.paidBrl),
      share_usd: round2(a.shareUsd),
      share_brl: round2(a.shareBrl),
      net_usd: round2(netUsd),
      net_brl: round2(netBrl),
      status: netBrl > EPSILON_BRL ? 'creditor' : netBrl < -EPSILON_BRL ? 'debtor' : 'balanced',
    };
  });

  // Liquidação gulosa em BRL (é o que a família transfere por Pix); o USD de
  // cada transferência segue a proporção usd/brl do devedor, que reflete o
  // câmbio médio das despesas que ele consumiu.
  const creditors = balances.filter(b => b.status === 'creditor').map(b => ({ ...b, remaining: b.net_brl }));
  const debtors = balances.filter(b => b.status === 'debtor').map(b => ({ ...b, remaining: -b.net_brl }));
  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amountBrl = Math.min(c.remaining, d.remaining);
    if (amountBrl > EPSILON_BRL) {
      const ratio = d.net_brl !== 0 ? d.net_usd / d.net_brl : 0;
      settlements.push({
        from_id: d.participant_id,
        from_name: d.name,
        to_id: c.participant_id,
        to_name: c.name,
        amount_brl: round2(amountBrl),
        amount_usd: round2(amountBrl * ratio),
      });
    }
    c.remaining -= amountBrl;
    d.remaining -= amountBrl;
    if (c.remaining <= EPSILON_BRL) ci++;
    if (d.remaining <= EPSILON_BRL) di++;
  }

  return { balances, settlements };
}
