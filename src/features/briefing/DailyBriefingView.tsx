import React, { useState, useEffect, useMemo } from 'react';
import { useTrip } from '../../context/TripContext';
import { sortItineraryChronologically } from '../../services/itinerarySort';
import { ViewHeader } from '../../components/ui/ViewHeader';
import {
  Volume2,
  Play,
  Pause,
  Square,
  Calendar,
  Clock,
  Sparkles,
  Copy,
  Check,
  Ruler
} from 'lucide-react';

const BRIEFING_ITEM_THRESHOLD = 8;
const BRIEFING_ITEM_LIMIT = 5;

export const DailyBriefingView: React.FC = () => {
  const {
    activeTrip,
    participants,
    itinerary,
    transports,
    accommodations,
    formatAmount,
    exchangeRate
  } = useTrip();

  // Get distinct dates from itinerary or generate trip dates
  const tripDates = useMemo(() => {
    const datesSet = new Set<string>();
    itinerary.forEach(i => {
      if (i.date) datesSet.add(i.date);
    });
    if (datesSet.size === 0) {
      datesSet.add('2026-09-10');
      datesSet.add('2026-09-11');
      datesSet.add('2026-09-15');
      datesSet.add('2026-09-19');
    }
    return Array.from(datesSet).sort();
  }, [itinerary]);

  const [selectedDate, setSelectedDate] = useState<string>(tripDates[0] || '2026-09-10');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Filter items for selected date
  const dayItems = useMemo(() => {
    return sortItineraryChronologically(itinerary.filter(i => i.date === selectedDate));
  }, [itinerary, selectedDate]);

  const dayAccommodations = useMemo(() => {
    return accommodations.filter(a => a.trip_id === activeTrip.id && a.status === 'confirmed');
  }, [accommodations, activeTrip]);

  const dayTransports = useMemo(() => {
    return transports.filter(t => {
      return (t.pickup_time && t.pickup_time.includes(selectedDate)) || (t.dropoff_time && t.dropoff_time.includes(selectedDate));
    });
  }, [transports, selectedDate]);

  // Kid warnings
  const gabi = participants.find(p => p.nickname === 'Gabi' || p.full_name.includes('Gabriela'));
  const heightRestrictedItems = dayItems.filter(i => i.min_height_cm && gabi && gabi.height_cm && i.min_height_cm > gabi.height_cm);

  // Generate Written Briefing Text
  const generateBriefingText = () => {
    const formattedDate = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const hotelName = dayAccommodations[0]?.name || 'Four Points Fort Lauderdale / Hotel Orlando';
    const city = dayAccommodations[0]?.city || 'Orlando';

    let speech = `Briefing diário para a viagem ${activeTrip.title}. `;
    speech += `Hoje é ${formattedDate}, em ${city}. `;
    speech += `Hospedagem ativa no ${hotelName}. `;

    if (dayItems.length > 0) {
      speech += `Temos ${dayItems.length} atividades programadas no Roteiro. `;
      if (dayItems.length > BRIEFING_ITEM_THRESHOLD) {
        const sTierItems = dayItems.filter(item => item.priority_tier === 'S');
        const highlightedItems = (sTierItems.length > 0 ? sTierItems : dayItems).slice(0, BRIEFING_ITEM_LIMIT);
        highlightedItems.forEach(item => {
          speech += `${item.time_start || ''}: ${item.title} em ${item.location || city}. `;
        });
        const remainingCount = dayItems.length - highlightedItems.length;
        if (remainingCount > 0) {
          speech += `...e mais ${remainingCount} atividades no parque. `;
        }
      } else {
        dayItems.forEach(item => {
          speech += `${item.time_start || ''}: ${item.title} em ${item.location || city}. `;
        });
      }
    } else {
      speech += `Dia livre para compras nos outlets e passeios flexíveis. `;
    }

    if (heightRestrictedItems.length > 0) {
      speech += `Atenção especial para a pequena Gabi! As atrações ${heightRestrictedItems.map(i => i.title).join(', ')} exigem altura superior aos ${gabi?.height_cm || 100} centímetros de Gabi. Recomendamos utilizar a funcionalidade Rider Switch. `;
    }

    if (selectedDate === '2026-09-19' || dayTransports.some(t => t.type === 'rental_car')) {
      speech += `Lembrete importante de logística: A devolução do SUV alugado está agendada para 19 de setembro às 17h30 em Fort Lauderdale. Não se esqueça de agendar o Uber XL corporativo para os 4 passageiros com as malas. `;
    }

    speech += `Planejamento financeiro para hoje: Economize utilizando a carteira de Gift Cards Disney e Apple com cotação atual de R$ ${exchangeRate.toFixed(2)} por Dólar. `;
    speech += `Desejo um excelente e produtivo dia de viagem para Bárbara, Pedro, Débora e Gabi!`;

    return speech;
  };

  const briefingContent = generateBriefingText();

  // Speech Synthesis Controls
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handlePlaySpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert('Seu navegador não suporta a síntese de voz (SpeechSynthesis).');
      return;
    }

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(briefingContent);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handlePauseSpeech = () => {
    if ('speechSynthesis' in window && isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  };

  const handleStopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(briefingContent);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="space-y-6 pb-20">
      <ViewHeader
        title={
          <>
            <Volume2 className="w-5 h-5 text-indigo-400" />
            Briefing do Dia (Falado & Escrito)
          </>
        }
        subtitle="Relatório diário em áudio e texto consolidando atrações, logística, restrições de altura para crianças e dicas financeiras."
        actions={
          <>
            <Calendar className="w-4 h-4 text-info-400" />
            <span className="text-xs font-semibold text-ink-300">Data:</span>
            <select
              value={selectedDate}
              onChange={e => {
                handleStopSpeech();
                setSelectedDate(e.target.value);
              }}
              className="px-3 py-1.5 rounded-xl bg-ink-900 border border-ink-800 text-ink-100 text-xs font-bold focus:outline-none focus:border-info-500"
            >
              {tripDates.map(d => (
                <option key={d} value={d}>
                  {new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • {d === '2026-09-19' ? 'Devolução SUV FLL' : 'Dia de Viagem'}
                </option>
              ))}
            </select>
          </>
        }
      />

      {/* Audio Player Card (Falado por IA) */}
      <div className="hero-banner p-6 rounded-2xl border border-indigo-500/30 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-accent-400" />
              Assistente de Voz IA • Leitura em Português (pt-BR)
            </div>
            <h3 className="text-lg font-bold text-ink-100">
              Relatório Falado do Dia: {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </h3>
            <p className="text-xs text-ink-300 max-w-xl">
              Clique no botão de reprodução para ouvir o áudio executivo preparado para o grupo ({participants.map(p => p.nickname || p.full_name.split(' ')[0]).join(', ')}).
            </p>
          </div>

          {/* Player Controls */}
          <div className="flex items-center gap-3 self-start md:self-center">
            {!isPlaying ? (
              <button
                onClick={handlePlaySpeech}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-accent-600 hover:from-indigo-500 hover:to-accent-500 text-white font-bold text-xs shadow-lg shadow-accent-600/30 transition flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Ouvir Briefing Falado</span>
              </button>
            ) : (
              <button
                onClick={handlePauseSpeech}
                className="px-5 py-3 rounded-2xl bg-warning-600 hover:bg-warning-500 text-white font-bold text-xs shadow-lg shadow-warning-600/30 transition flex items-center gap-2"
              >
                <Pause className="w-4 h-4 fill-white" />
                <span>Pausar</span>
              </button>
            )}

            {(isPlaying || isPaused) && (
              <button
                onClick={handleStopSpeech}
                className="p-3 rounded-2xl bg-ink-800 hover:bg-ink-700 text-danger-400 font-bold text-xs transition"
                title="Parar Áudio"
              >
                <Square className="w-4 h-4 fill-danger-400" />
              </button>
            )}
          </div>
        </div>

        {/* Audio Visualizer Waves */}
        {isPlaying && (
          <div className="mt-4 pt-3 border-t border-indigo-500/20 flex items-center gap-1.5 justify-center">
            <div className="w-1.5 h-6 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-8 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-4 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <div className="w-1.5 h-7 bg-success-400 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
            <div className="w-1.5 h-5 bg-accent-300 rounded-full animate-bounce" style={{ animationDelay: '600ms' }} />
            <span className="text-xs text-indigo-300 font-medium ml-2">Reproduzindo sintetizador de voz...</span>
          </div>
        )}
      </div>

      {/* Written Briefing */}
      <div className="grid grid-cols-1 gap-6">
        {/* Daily Itinerary & Highlights */}
        <div className="space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-ink-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-ink-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-info-400" />
                Cronograma do Dia ({dayItems.length} atividades)
              </h3>
              <button
                onClick={handleCopyText}
                className="px-3 py-1.5 rounded-xl bg-ink-900 border border-ink-800 hover:bg-ink-800 text-ink-300 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-success-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>

            {dayItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-400 bg-ink-900/40 rounded-xl border border-ink-800">
                Nenhuma atividade agendada para este dia. Aproveite para passeios flexíveis, compras nos Outlets ou descanso na piscina do hotel.
              </div>
            ) : (
              <div className="space-y-3">
                {dayItems.map(item => (
                  <div key={item.id} className="p-3.5 rounded-xl bg-ink-900/60 border border-ink-800 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-info-500/10 text-info-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {item.time_start || '09:00'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-ink-100">{item.title}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-info-500/10 text-info-400 font-semibold border border-info-500/20">
                          {item.category.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-ink-400 mt-0.5">{item.location || item.city} • Valor Previsto: {formatAmount(item.estimated_cost || 0)}</p>

                      {/* Warning if Gabi restricted */}
                      {item.min_height_cm && gabi && gabi.height_cm && item.min_height_cm > gabi.height_cm && (
                        <div className="mt-2 p-2 rounded-lg bg-warning-500/10 border border-warning-500/30 text-[11px] text-warning-300 flex items-center gap-1.5">
                          <Ruler className="w-3.5 h-3.5 text-warning-400 shrink-0" />
                          <span>Atração exige {item.min_height_cm}cm (Gabi tem {gabi.height_cm}cm). Usar <strong>Rider Switch</strong>.</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Written Full Summary Box */}
          <div className="glass-panel p-5 rounded-2xl border border-ink-800 space-y-3">
            <h3 className="font-bold text-sm text-ink-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-400" />
              Relatório Executivo Escrito
            </h3>
            <div className="p-4 rounded-xl bg-ink-950 border border-ink-800 text-xs text-ink-300 leading-relaxed whitespace-pre-line font-sans">
              {briefingContent}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
