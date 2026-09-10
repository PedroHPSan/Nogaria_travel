import { describe, expect, it } from 'vitest';
import { computeBalances, type BalanceExpense } from '../balances.ts';

const people = [
  { id: 'p1', name: 'Pedro' },
  { id: 'p2', name: 'Dé' },
  { id: 'p3', name: 'Gabi' },
];

const expense = (o: Partial<BalanceExpense>): BalanceExpense => ({
  amount_usd: 100,
  amount_brl: 500,
  paid_by_id: 'p1',
  beneficiary_ids: [],
  status: 'paid',
  ...o,
});

describe('computeBalances', () => {
  it('rateia entre os beneficiários e gera um único acerto', () => {
    const { balances, settlements } = computeBalances([expense({ beneficiary_ids: ['p1', 'p2'] })], people);
    expect(balances.find(b => b.participant_id === 'p1')).toMatchObject({ paid_brl: 500, share_brl: 250, net_brl: 250, status: 'creditor' });
    expect(balances.find(b => b.participant_id === 'p2')).toMatchObject({ net_brl: -250, status: 'debtor' });
    expect(balances.find(b => b.participant_id === 'p3')).toMatchObject({ net_brl: 0, status: 'balanced' });
    expect(settlements).toEqual([{ from_id: 'p2', from_name: 'Dé', to_id: 'p1', to_name: 'Pedro', amount_brl: 250, amount_usd: 50 }]);
  });

  it('beneficiários vazios = rateio entre todos', () => {
    const { balances } = computeBalances([expense({ amount_usd: 90, amount_brl: 450 })], people);
    expect(balances.map(b => b.share_brl)).toEqual([150, 150, 150]);
  });

  it('ignora despesas pendentes, reembolsadas ou sem pagador — só desembolso real vira dívida', () => {
    const { settlements } = computeBalances(
      [
        expense({ status: 'pending', beneficiary_ids: ['p2'] }),
        expense({ status: 'reimbursed', beneficiary_ids: ['p2'] }),
        expense({ paid_by_id: null, beneficiary_ids: ['p2'] }),
      ],
      people,
    );
    expect(settlements).toEqual([]);
  });

  it('BRL usa o valor congelado da despesa, não uma cotação global', () => {
    // Mesmo USD, câmbios diferentes na data de cada despesa.
    const { balances } = computeBalances(
      [
        expense({ amount_usd: 100, amount_brl: 500, beneficiary_ids: ['p2'] }),
        expense({ amount_usd: 100, amount_brl: 600, beneficiary_ids: ['p2'] }),
      ],
      people,
    );
    expect(balances.find(b => b.participant_id === 'p2')?.net_brl).toBe(-1100);
    expect(balances.find(b => b.participant_id === 'p2')?.net_usd).toBe(-200);
  });

  it('liquidação mínima: um devedor pode pagar dois credores', () => {
    const { settlements } = computeBalances(
      [
        expense({ paid_by_id: 'p1', amount_brl: 300, amount_usd: 60, beneficiary_ids: ['p3'] }),
        expense({ paid_by_id: 'p2', amount_brl: 200, amount_usd: 40, beneficiary_ids: ['p3'] }),
      ],
      people,
    );
    expect(settlements).toHaveLength(2);
    expect(settlements.map(s => [s.from_name, s.to_name, s.amount_brl])).toEqual([
      ['Gabi', 'Pedro', 300],
      ['Gabi', 'Dé', 200],
    ]);
  });

  it('diferenças de centavos não viram acerto', () => {
    // R$ 0,60 entre 3: pagador fica +0,40, os outros -0,20 — abaixo do meio real.
    const { settlements, balances } = computeBalances([expense({ amount_brl: 0.6, amount_usd: 0.12 })], people);
    expect(settlements).toEqual([]);
    expect(balances.every(b => b.status === 'balanced')).toBe(true);
  });
});
