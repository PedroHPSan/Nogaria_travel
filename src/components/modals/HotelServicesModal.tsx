import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { searchHotelServices, type HotelServicePlace } from '../../services/api/placesService';
import { MapPin, Star, ExternalLink, ShieldCheck, Clock } from 'lucide-react';

interface HotelServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotelName?: string;
  hotelCity?: string;
}

export const HotelServicesModal: React.FC<HotelServicesModalProps> = ({
  isOpen,
  onClose,
  hotelName = 'Celebration Suites (Kissimmee)',
  hotelCity = 'Kissimmee',
}) => {
  const [destination, setDestination] = useState(
    hotelCity.includes('Miami') ? 'Miami Beach, FL' : 'Orlando / Kissimmee'
  );
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'pharmacy' | 'supermarket' | 'gas_station'>('all');
  const [places, setPlaces] = useState<HotelServicePlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadServices = async (dest = destination, cat = categoryFilter) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await searchHotelServices(dest, cat);
      setPlaces(res.places);
      setFromCache(res.fromCache);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar serviços próximos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const dest = hotelCity.includes('Miami') ? 'Miami Beach, FL' : 'Orlando / Kissimmee';
      setDestination(dest);
      loadServices(dest, categoryFilter);
    }
  }, [isOpen, hotelCity, categoryFilter]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Serviços & Farmácias ao Redor do Hotel`}
      subtitle={`Localização de suporte essencial para ${hotelName} (Supermercados, Farmácias 24h e Postos).`}
    >
      <div className="space-y-4 text-xs">
        {/* Category Filters */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('all');
              loadServices(destination, 'all');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
              categoryFilter === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos os Serviços
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('supermarket');
              loadServices(destination, 'supermarket');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1 ${
              categoryFilter === 'supermarket'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🛒 Supermercados & Target
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('pharmacy');
              loadServices(destination, 'pharmacy');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1 ${
              categoryFilter === 'pharmacy'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            💊 Farmácias 24h & Saúde
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('gas_station');
              loadServices(destination, 'gas_station');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1 ${
              categoryFilter === 'gas_station'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⛽ Postos & Conveniência
          </button>
        </div>

        {/* Essential Family Notice */}
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-2.5 text-blue-200 text-xs">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <strong>Dica de Segurança Familiar:</strong> Em caso de febre ou indisposição da Gabriela (4a) ou Débora (12a), a <strong>Walgreens 24h</strong> possui farmacêutico de plantão para medicamentos infantis (ibuprofeno, antialérgicos, etc.).
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Results List */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>
              {places.length} locais de apoio encontrados na região de <strong>{destination}</strong>
            </span>
            {fromCache && (
              <span className="text-emerald-400 font-mono text-[10px]">
                ⚡ Dados em cache (Custo zero)
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Carregando serviços próximos...</div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
              {places.map(p => (
                <div
                  key={p.placeId}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/40 transition space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{p.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300">
                          {p.categoryLabel}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        {p.address}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.is24Hours && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Aberto 24 Horas
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
                    <span className="text-blue-400 font-bold">Utilidade:</span> {p.urgencyTip}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-900">
                    <div className="flex items-center gap-3">
                      {p.rating && (
                        <span className="flex items-center gap-1 font-bold text-amber-400">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {p.rating}
                          {p.userRatingsTotal && (
                            <span className="text-slate-500 font-normal">
                              ({p.userRatingsTotal.toLocaleString()})
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    {p.mapsUrl && (
                      <a
                        href={p.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                      >
                        Abrir Rota no Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
