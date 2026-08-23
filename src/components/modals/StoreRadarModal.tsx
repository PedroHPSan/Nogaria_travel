import React, { useState } from 'react';
import { BaseModal } from './BaseModal';
import { searchStores, type StorePlace } from '../../services/api/placesService';
import { Search, MapPin, Star, ExternalLink, Check, Sparkles } from 'lucide-react';

interface StoreRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStore?: (storeName: string, storeAddress?: string) => void;
  initialQuery?: string;
  destination?: string;
}

const POPULAR_QUERIES = [
  { label: '🍎 Apple Stores', query: 'Apple Store' },
  { label: '💻 Best Buy Tech', query: 'Best Buy' },
  { label: '🧸 Carter\'s Infantil', query: "Carter's Outlet" },
  { label: '🛍️ Sawgrass Mills', query: 'Sawgrass Mills Outlet' },
  { label: '🎯 Super Target (Kissimmee)', query: 'Super Target Kissimmee' },
  { label: '🏰 Disney Springs Lojas', query: 'Disney Springs' },
];

export const StoreRadarModal: React.FC<StoreRadarModalProps> = ({
  isOpen,
  onClose,
  onSelectStore,
  initialQuery = '',
  destination = 'Orlando, FL',
}) => {
  const [query, setQuery] = useState(initialQuery || 'Apple Store');
  const [selectedDestination, setSelectedDestination] = useState(destination);
  const [places, setPlaces] = useState<StorePlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;

    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await searchStores(q, selectedDestination);
      setPlaces(res.places);
      setFromCache(res.fromCache);
      setHasSearched(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao consultar lojas.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (place: StorePlace) => {
    if (onSelectStore) {
      onSelectStore(place.name, place.address);
    }
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Radar de Lojas & Horários (Google Places & TripAdvisor)"
      subtitle="Pesquisa controlada de lojas, outlets, horários e avaliações com proteção Free Tier."
    >
      <div className="space-y-4 text-xs">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Digite a loja ou produto (ex: Best Buy, Carter's, Nike Outlet)"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-accent-500 font-medium"
            />
          </div>

          <select
            value={selectedDestination}
            onChange={e => setSelectedDestination(e.target.value)}
            className="px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-accent-500"
          >
            <option value="Orlando, FL">Orlando / Kissimmee</option>
            <option value="Miami, FL">Miami / Aventura</option>
            <option value="Sunrise, FL">Sunrise (Sawgrass Mills)</option>
            <option value="Fort Lauderdale, FL">Fort Lauderdale</option>
          </select>

          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-accent-600/30"
          >
            {isLoading ? (
              <span>Buscando...</span>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Buscar</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-ink-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-accent-400" /> Sugestões:
          </span>
          {POPULAR_QUERIES.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setQuery(item.query);
                handleSearch(item.query);
              }}
              className="px-2.5 py-1 rounded-lg bg-ink-900 hover:bg-ink-800 border border-ink-800 text-ink-300 text-[11px] transition"
            >
              {item.label}
            </button>
          ))}
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Results List */}
        {hasSearched && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-ink-400 text-[11px]">
              <span>
                {places.length} lojas encontradas em <strong>{selectedDestination}</strong>
              </span>
              {fromCache && (
                <span className="text-success-400 font-mono text-[10px]">
                  ⚡ Resposta obtida do cache local (Custo zero de API)
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {places.length === 0 ? (
                <div className="p-6 text-center text-ink-400 bg-ink-950/50 rounded-xl border border-ink-900">
                  Nenhuma loja encontrada para este termo. Tente outro nome ou destino.
                </div>
              ) : (
                places.map(p => (
                  <div
                    key={p.placeId}
                    className="p-3 rounded-xl bg-ink-950 border border-ink-800 hover:border-accent-500/50 transition flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{p.name}</h4>
                        {p.isOpenNow !== undefined && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.isOpenNow
                                ? 'bg-success-500/10 text-success-400 border border-success-500/30'
                                : 'bg-danger-500/10 text-danger-400 border border-danger-500/30'
                            }`}
                          >
                            {p.isOpenNow ? 'Aberto Agora' : 'Fechado no momento'}
                          </span>
                        )}
                      </div>

                      <p className="text-ink-400 text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-ink-500 shrink-0" />
                        {p.address}
                      </p>

                      <div className="flex items-center gap-3 pt-1 text-[11px]">
                        {p.rating && (
                          <span className="flex items-center gap-1 font-bold text-warning-400">
                            <Star className="w-3 h-3 fill-warning-400" />
                            {p.rating}
                            {p.userRatingsTotal && (
                              <span className="text-ink-500 font-normal">
                                ({p.userRatingsTotal.toLocaleString()} avaliações)
                              </span>
                            )}
                          </span>
                        )}

                        {p.mapsUrl && (
                          <a
                            href={p.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-400 hover:text-accent-300 flex items-center gap-1 font-semibold"
                          >
                            Ver no Maps <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {onSelectStore && (
                      <button
                        type="button"
                        onClick={() => handleSelect(p)}
                        className="px-3 py-1.5 rounded-lg bg-accent-600/20 hover:bg-accent-600 text-accent-300 hover:text-white font-bold text-xs transition shrink-0 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Selecionar
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

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
