import React, { useEffect, useState } from 'react';
import { BaseModal } from './BaseModal';
import type { PurchaseAssumptions } from '../../types/database.types';
import { validateAssumptions } from '../../services/purchase/purchaseAssumptions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  assumptions: PurchaseAssumptions;
  onSave: (patch: Partial<PurchaseAssumptions>) => void;
}

// The numeric fields below are edited as free-text number inputs. A cleared
// input yields '' — which must stay distinct from a deliberate 0 (a valid
// value for card_spread_pct, default_sales_tax_pct, safety_margin_pct, etc.)
// until submit time, when a blank field is rejected explicitly.
type NumericAssumptionKey =
  | 'usd_brl_rate'
  | 'default_sales_tax_pct'
  | 'card_iof_pct'
  | 'card_spread_pct'
  | 'customs_quota_usd_per_person'
  | 'customs_excess_tax_pct'
  | 'safety_margin_pct';

type AssumptionsDraft = Omit<PurchaseAssumptions, NumericAssumptionKey> &
  Record<NumericAssumptionKey, number | ''>;

const FIELDS: Array<{ key: NumericAssumptionKey; label: string; hint: string }> = [
  { key: 'usd_brl_rate', label: 'Câmbio USD/BRL', hint: 'cotação usada em toda conversão' },
  { key: 'default_sales_tax_pct', label: 'Sales tax padrão (%)', hint: 'usada quando o estado é desconhecido' },
  { key: 'card_iof_pct', label: 'IOF do cartão (%)', hint: '3,38 no crédito internacional' },
  { key: 'card_spread_pct', label: 'Spread do cartão (%)', hint: '0 em Wise/Inter, ~4 em banco tradicional' },
  { key: 'customs_quota_usd_per_person', label: 'Cota por pessoa (US$)', hint: 'US$ 1.000 na chegada aérea' },
  { key: 'customs_excess_tax_pct', label: 'Imposto sobre excedente (%)', hint: '50% sobre o que passa da cota' },
  { key: 'safety_margin_pct', label: 'Margem de segurança (%)', hint: 'abaixo disso o veredito é indiferente' },
];

export const AssumptionsModal: React.FC<Props> = ({ isOpen, onClose, assumptions, onSave }) => {
  const [draft, setDraft] = useState<AssumptionsDraft>(assumptions);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDraft(assumptions);
      setErrors([]);
    }
  }, [isOpen, assumptions]);

  const handleSubmit = () => {
    const blanks = FIELDS.filter(f => draft[f.key] === '');
    if (blanks.length > 0) {
      return setErrors(blanks.map(f => `${f.label} não pode ficar em branco.`));
    }

    const toSave = draft as PurchaseAssumptions;
    const found = validateAssumptions(toSave);
    if (found.length > 0) return setErrors(found);
    onSave(toSave);
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Parâmetros de cálculo">
      <div className="space-y-3">
        {FIELDS.map(f => (
          <div key={String(f.key)}>
            <label className="block text-[11px] font-semibold text-ink-300 mb-1">{f.label}</label>
            <input
              className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-ink-800 text-sm text-ink-100"
              type="number"
              step="0.01"
              value={draft[f.key]}
              onChange={e => setDraft({ ...draft, [f.key]: e.target.value === '' ? '' : Number(e.target.value) })}
            />
            <p className="text-[10px] text-ink-500 mt-0.5">{f.hint}</p>
          </div>
        ))}

        <div>
          <label className="block text-[11px] font-semibold text-ink-300 mb-1">Fonte do câmbio</label>
          <input
            className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-ink-800 text-sm text-ink-100"
            value={draft.rate_source}
            onChange={e => setDraft({ ...draft, rate_source: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-ink-300 mb-1">Referência legal da cota</label>
          <textarea
            className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-ink-800 text-sm text-ink-100"
            rows={2}
            value={draft.legal_reference ?? ''}
            onChange={e => setDraft({ ...draft, legal_reference: e.target.value })}
          />
          <p className="text-[10px] text-ink-500 mt-0.5">
            Anote a norma e a data em que você conferiu — ela aparece nas premissas de cada decisão.
          </p>
        </div>

        {errors.length > 0 && (
          <ul className="space-y-1">
            {errors.map((e, i) => <li key={i} className="text-xs text-danger-400">{e}</li>)}
          </ul>
        )}

        <button onClick={handleSubmit} className="w-full py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold text-sm transition">
          Salvar parâmetros
        </button>
      </div>
    </BaseModal>
  );
};
