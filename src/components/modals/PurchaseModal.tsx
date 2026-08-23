import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { StoreRadarModal } from './StoreRadarModal';
import { Search } from 'lucide-react';
import type { PurchaseItem, Participant } from '../../types/database.types';
import type { PurchaseVerdict } from '../../types/purchase.types';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (purchase: any) => void;
  initialData?: PurchaseItem | null;
  participants: Participant[];
  tripId: string;
}

const CATEGORIES: { id: PurchaseItem['category']; label: string }[] = [
  { id: 'electronics', label: '📱 Eletrônicos & Apple' },
  { id: 'clothing', label: '👕 Roupas & Acessórios' },
  { id: 'footwear', label: '👟 Calçados & Tênis' },
  { id: 'kids', label: '🧸 Itens Infantis' },
  { id: 'collectibles', label: '🎴 Cartas Pokémon / Colecionáveis' },
  { id: 'cosmetics', label: '💄 Cosméticos & Perfumes' },
  { id: 'gifts', label: '🎁 Presentes' },
  { id: 'personal', label: '👤 Uso Pessoal' },
  { id: 'resale', label: '💼 Revenda / Empresarial' }
];

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  participants,
  tripId
}) => {
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState<PurchaseItem['category']>('electronics');
  const [brand, setBrand] = useState('');
  const [storeName, setStoreName] = useState('');
  const [targetParticipantId, setTargetParticipantId] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [priority, setPriority] = useState<PurchaseItem['priority']>('high');
  const [quantity, setQuantity] = useState<number>(1);
  const [targetPriceUsd, setTargetPriceUsd] = useState<number | ''>(100);
  const [priceFoundUsd, setPriceFoundUsd] = useState<number | ''>('');
  const [brlEquivalent, setBrlEquivalent] = useState<number | ''>('');
  const [giftCardEligible, setGiftCardEligible] = useState(true);
  const [status, setStatus] = useState<PurchaseItem['status']>('planned');
  const [linkUrl, setLinkUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [verdictOverride, setVerdictOverride] = useState<PurchaseVerdict | ''>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState('');
  const [isStoreRadarOpen, setIsStoreRadarOpen] = useState(false);

  useEffect(() => {
    setError('');
    if (initialData) {
      setProductName(initialData.product_name || '');
      setCategory(initialData.category || 'electronics');
      setBrand(initialData.brand || '');
      setStoreName(initialData.store_name || '');
      setTargetParticipantId(initialData.target_participant_id || '');
      setBeneficiaryId(initialData.beneficiary_id || '');
      setPriority(initialData.priority || 'high');
      setQuantity(initialData.quantity || 1);
      setTargetPriceUsd(initialData.target_price_usd ?? 100);
      setPriceFoundUsd(initialData.price_found_usd ?? '');
      setBrlEquivalent(initialData.brl_equivalent_price ?? '');
      setGiftCardEligible(initialData.gift_card_eligible ?? true);
      setStatus(initialData.status || 'planned');
      setLinkUrl(initialData.link_url || '');
      setNotes(initialData.notes || '');
      setVerdictOverride(initialData.verdict_override ?? '');
      setOverrideReason(initialData.override_reason ?? '');
    } else {
      setProductName('');
      setCategory('electronics');
      setBrand('Apple');
      setStoreName('Apple Store Millenia');
      setTargetParticipantId(participants.find(p => p.nickname === 'Pedro')?.id || participants[0]?.id || '');
      setBeneficiaryId('');
      setPriority('high');
      setQuantity(1);
      setTargetPriceUsd(100);
      setPriceFoundUsd('');
      setBrlEquivalent('');
      setGiftCardEligible(true);
      setStatus('planned');
      setLinkUrl('');
      setNotes('');
      setVerdictOverride('');
      setOverrideReason('');
    }
  }, [initialData, isOpen, participants]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !targetParticipantId) return;

    if (verdictOverride !== '' && !overrideReason.trim()) {
      setError('Explique o motivo ao sobrepor a recomendação do motor.');
      return;
    }

    onSave({
      trip_id: tripId,
      product_name: productName.trim(),
      category,
      brand: brand.trim() || undefined,
      store_name: storeName.trim() || undefined,
      target_participant_id: targetParticipantId,
      beneficiary_id: beneficiaryId || undefined,
      priority,
      quantity: Number(quantity) || 1,
      target_price_usd: Number(targetPriceUsd) || 0,
      price_found_usd: priceFoundUsd !== '' ? Number(priceFoundUsd) : undefined,
      brl_equivalent_price: brlEquivalent !== '' ? Number(brlEquivalent) : undefined,
      gift_card_eligible: giftCardEligible,
      status,
      link_url: linkUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      verdict_override: verdictOverride === '' ? undefined : verdictOverride,
      override_reason: verdictOverride === '' ? undefined : overrideReason.trim()
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Item de Compra' : 'Cadastrar Compra Planejada'}
      subtitle="Defina prioridades, estimativas de preço EUA x Brasil, elegibilidade a gift card e beneficiário."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-ink-300 font-semibold mb-1">Nome do Produto *</label>
            <input
              type="text"
              required
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="Ex: iPhone Pro Max 512GB / Apple Watch Ultra"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Categoria *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            >
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Marca / Fabricante</label>
            <input
              type="text"
              value={brand}
              onChange={e => setBrand(e.target.value)}
              placeholder="Ex: Apple, Nike, Adidas, Pokémon, Carter's"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-ink-300 font-semibold">Loja Alvo (Física ou Online)</label>
              <button
                type="button"
                onClick={() => setIsStoreRadarOpen(true)}
                className="text-[11px] text-accent-400 hover:text-accent-300 font-bold flex items-center gap-1 transition"
              >
                <Search className="w-3 h-3" />
                Buscar Loja
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                placeholder="Ex: Apple Store Aventura, Target, Best Buy"
                className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Comprador / Responsável *</label>
            <select
              required
              value={targetParticipantId}
              onChange={e => setTargetParticipantId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            >
              <option value="">-- Selecione o Responsável --</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Beneficiário do Produto</label>
            <select
              value={beneficiaryId}
              onChange={e => setBeneficiaryId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            >
              <option value="">-- Próprio Comprador / Família --</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Preço Alvo (US$) *</label>
            <input
              type="number"
              required
              min="0"
              step="5"
              value={targetPriceUsd}
              onChange={e => setTargetPriceUsd(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-bold text-success-400"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Preço Encontrado (US$)</label>
            <input
              type="number"
              min="0"
              step="5"
              value={priceFoundUsd}
              onChange={e => setPriceFoundUsd(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Preço Brasil Ref. (R$)</label>
            <input
              type="number"
              min="0"
              step="50"
              value={brlEquivalent}
              onChange={e => setBrlEquivalent(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: R$ 11.499"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Quantidade</label>
            <input
              type="number"
              min="1"
              max="50"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Nível de Prioridade</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            >
              <option value="high">🔥 Alta Prioridade (Essencial)</option>
              <option value="medium">⚡ Média Prioridade</option>
              <option value="low">💡 Baixa / Se Sobrar Orçamento</option>
            </select>
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Status da Compra</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            >
              <option value="planned">Planejado</option>
              <option value="online_ordered">Pedido Online Feito</option>
              <option value="delivered_hotel">Entregue no Hotel</option>
              <option value="bought">Comprado na Loja Física</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-ink-950/60 border border-ink-800 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-ink-200 font-medium">
            <input
              type="checkbox"
              checked={giftCardEligible}
              onChange={e => setGiftCardEligible(e.target.checked)}
              className="w-4 h-4 rounded text-info-600 focus:ring-info-500 bg-ink-900 border-ink-700"
            />
            Elegível para pagamento com Gift Card (Desconto Extra)
          </label>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Link do Produto (URL)</label>
          <input
            type="url"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="Ex: https://www.apple.com/shop/buy-iphone/iphone-16-pro"
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
          />
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Observações do Produto</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Compra condicionada a promoção ou opção de comprar aparelho usado de outro participante."
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-ink-300 mb-1">
            Sobrepor o veredito do motor (opcional)
          </label>
          <select
            className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-ink-800 text-sm text-ink-100"
            value={verdictOverride}
            onChange={e => setVerdictOverride(e.target.value as PurchaseVerdict | '')}
          >
            <option value="">Usar a recomendação do motor</option>
            <option value="COMPRAR_EUA">Comprar nos EUA</option>
            <option value="COMPRAR_BRASIL">Comprar no Brasil</option>
            <option value="AGUARDAR_PRECO">Aguardar preço</option>
          </select>
        </div>

        {verdictOverride !== '' && (
          <div>
            <label className="block text-[11px] font-semibold text-ink-300 mb-1">
              Motivo da decisão manual
            </label>
            <textarea
              className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-ink-800 text-sm text-ink-100"
              rows={2}
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="Ex.: prefiro garantia nacional"
            />
          </div>
        )}

        {error && <p className="text-xs text-danger-400">{error}</p>}

        <div className="pt-3 border-t border-ink-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold shadow-lg shadow-accent-600/30"
          >
            Salvar Compra
          </button>
        </div>
      </form>

      <StoreRadarModal
        isOpen={isStoreRadarOpen}
        onClose={() => setIsStoreRadarOpen(false)}
        onSelectStore={(selectedStore, address) => {
          setStoreName(selectedStore);
          if (address && !notes.includes(address)) {
            setNotes(prev => (prev ? `${prev}\nEndereço: ${address}` : `Endereço: ${address}`));
          }
        }}
        initialQuery={brand || productName || storeName || 'Apple Store'}
      />
    </BaseModal>
  );
};
