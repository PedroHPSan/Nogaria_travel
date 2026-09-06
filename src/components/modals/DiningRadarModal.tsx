import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { searchBudgetDining, type DiningPlace } from '../../services/api/placesService';
import { Utensils, DollarSign, Star, MapPin, ExternalLink, Sparkles, Heart, Baby } from 'lucide-react';

interface DiningRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDestination?: string;
}

export const DiningRadarModal: React.FC<DiningRadarModalProps> = ({
  isOpen,
  onClose,
  initialDestination = 'Orlando / Kissimmee',
}) => {
  const [destination, setDestination] = useState(initialDestination);
  const [maxPrice, setMaxPrice] = useState<1 | 2>(1); // Default strictly to $ (Super Econômico)
  const [places, setPlaces] = useState<DiningPlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadDining = async (dest = destination, price = maxPrice) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await searchBudgetDining(dest, price);
      setPlaces(res.places);
      setFromCache(res.fromCache);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar opções de alimentação.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDining(initialDestination, maxPrice);
    }
  }, [isOpen, initialDestination, maxPrice]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Radar Gastronômico Econômico (Refeições Baratas & Custo-Benefício)"
      subtitle="Filtro estrito para gastar o mínimo possível em alimentação para a família em Orlando e Miami."
    >
      <div className="space-y-4 text-xs">
        {/* Destination & Price Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2 flex items-center gap-2">
            <select
              value={destination}
              onChange={e => {
                setDestination(e.target.value);
                loadDining(e.target.value, maxPrice);
              }}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-warning-500 font-semibold"
            >
              <option value="Orlando / Kissimmee">Orlando / Kissimmee (Base Disney & Universal)</option>
              <option value="Miami Beach, FL">Miami Beach / South Beach</option>
              <option value="Sunrise, FL">Sunrise (Sawgrass Mills Outlet)</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-ink-950 p-1 rounded-xl border border-ink-800">
            <button
              type="button"
              onClick={() => {
                setMaxPrice(1);
                loadDining(destination, 1);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                maxPrice === 1
                  ? 'bg-success-600 text-white shadow-md'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              $ Barato (&lt; $12)
            </button>

            <button
              type="button"
              onClick={() => {
                setMaxPrice(2);
                loadDining(destination, 2);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                maxPrice === 2
                  ? 'bg-info-600 text-white shadow-md'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              $$ Até $20
            </button>
          </div>
        </div>

        {/* Family & Budget Strategy Banner */}
        <div className="p-3 rounded-xl bg-warning-500/10 border border-warning-500/30 flex items-start gap-2.5 text-warning-200 text-xs">
          <Sparkles className="w-4 h-4 text-warning-400 shrink-0 mt-0.5" />
          <div>
            <strong>Estratégia de Máxima Economia:</strong> Priorize comprar frango assado e snacks no Target/Walmart para dias de parque, e utilize combos gigantes (Panda Express / Chipotle / Cicis Buffet) para dividir refeições fartas entre adultos e crianças.
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Results List */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-ink-400 text-[11px]">
            <span>
              Opções selecionadas em <strong>{destination}</strong>
            </span>
            {fromCache && (
              <span className="text-success-400 font-mono text-[10px]">
                ⚡ Dados em cache (Custo zero de API)
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-ink-400">
              <Utensils className="w-6 h-6 animate-pulse mx-auto mb-2 text-warning-400" />
              Buscando melhores restaurantes econômicos...
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
              {places.map(p => (
                <div
                  key={p.placeId}
                  className="p-3.5 rounded-xl bg-ink-950 border border-ink-800 hover:border-warning-500/40 transition space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-ink-100 text-sm">{p.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-500/10 text-success-400 border border-success-500/30">
                          {p.priceEstimate}
                        </span>
                      </div>
                      <p className="text-ink-400 text-xs mt-0.5">{p.cuisine}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.kidFriendly && (
                        <span
                          title="Ideal para crianças (Gabriela 4 anos)"
                          className="px-2 py-0.5 rounded-md bg-accent-500/10 text-accent-300 border border-accent-500/20 text-[10px] flex items-center gap-1 font-semibold"
                        >
                          <Baby className="w-3 h-3" /> Kids
                        </span>
                      )}
                      {p.lactoseFreeFriendly && (
                        <span
                          title="Opções sem lactose para Débora"
                          className="px-2 py-0.5 rounded-md bg-info-500/10 text-info-300 border border-info-500/20 text-[10px] flex items-center gap-1 font-semibold"
                        >
                          <Heart className="w-3 h-3" /> Sem Lactose
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Budget Saving Tip */}
                  <div className="p-2 rounded-lg bg-ink-900/80 border border-ink-800 text-[11px] text-warning-300 flex items-start gap-1.5">
                    <span className="font-bold shrink-0">💡 Dica de Economia:</span>
                    <span>{p.budgetSavingTip}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-ink-400 border-t border-ink-900">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-ink-500 shrink-0" />
                      <span className="truncate max-w-xs">{p.address}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {p.rating && (
                        <span className="flex items-center gap-1 font-bold text-warning-400">
                          <Star className="w-3 h-3 fill-warning-400" />
                          {p.rating}
                          {p.userRatingsTotal && (
                            <span className="text-ink-500 font-normal">
                              ({p.userRatingsTotal.toLocaleString()})
                            </span>
                          )}
                        </span>
                      )}

                      {p.mapsUrl && (
                        <a
                          href={p.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-warning-400 hover:text-warning-300 flex items-center gap-1 font-semibold"
                        >
                          Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-ink-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
