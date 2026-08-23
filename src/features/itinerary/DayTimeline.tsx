import React from 'react';
import { AlertTriangle, Clapperboard } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { computeCoverage } from '../../services/coverageEngine';
import type { ItineraryItem, Participant } from '../../types/database.types';
import { sortItineraryChronologically } from '../../services/itinerarySort';

interface DayTimelineProps {
  items: ItineraryItem[];
  participants: Participant[];
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  attraction: 'Atração',
  show: 'Show',
  experience: 'Experiência',
  character: 'Personagem',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-slate-800 text-slate-400 border-slate-700',
  done: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  skipped: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  height_restricted: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  not_applicable: 'bg-slate-800 text-slate-500 border-slate-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  done: 'Concluído',
  skipped: 'Pulado',
  height_restricted: 'Restrição de altura',
  not_applicable: 'Não aplicável',
};

function nextParticipantStatus(current?: string): 'pending' | 'done' | 'skipped' {
  if (current === 'done') return 'skipped';
  if (current === 'skipped') return 'pending';
  return 'done';
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function findConflictingShow(item: ItineraryItem, dayItems: ItineraryItem[]): ItineraryItem | undefined {
  if (item.item_type === 'show') return undefined;

  const itemStart = timeToMinutes(item.time_start);
  const itemEnd = item.time_end ? timeToMinutes(item.time_end) : itemStart + 30;

  return dayItems.find(other => {
    if (other.id === item.id) return false;
    if (other.item_type !== 'show' || !other.show_block_start || !other.show_block_end) return false;
    const blockStart = timeToMinutes(other.show_block_start);
    const blockEnd = timeToMinutes(other.show_block_end);
    return itemStart < blockEnd && itemEnd > blockStart;
  });
}

export const DayTimeline: React.FC<DayTimelineProps> = ({ items, participants }) => {
  const { updateItineraryItem } = useTrip();

  const sortedItems = sortItineraryChronologically(items);
  const coverage = computeCoverage(items, participants);

  const handleStatusClick = (item: ItineraryItem, participantId: string) => {
    const current = item.participant_status?.[participantId];
    updateItineraryItem(item.id, {
      participant_status: { ...item.participant_status, [participantId]: nextParticipantStatus(current) },
    });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white">Cobertura do dia</span>
          <span className="text-lg font-bold text-blue-400">{coverage.percent}%</span>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {(['attraction', 'show', 'experience', 'character'] as const).map(type => (
            <span key={type} className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              {ITEM_TYPE_LABELS[type]}: {coverage.byType[type].done}/{coverage.byType[type].total}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {participants.map(p => {
            const c = coverage.byParticipant[p.id];
            if (!c || c.total === 0) return null;
            return (
              <span key={p.id} className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                <span className={`w-4 h-4 rounded-full ${p.avatar_color} text-white text-[9px] font-bold flex items-center justify-center`}>
                  {p.nickname ? p.nickname[0] : p.full_name[0]}
                </span>
                {c.done}/{c.total}
              </span>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {sortedItems.length === 0 ? (
          <div className="p-8 rounded-2xl glass-card text-center border border-slate-800 text-slate-400 text-xs">
            Nenhum item de parque para este dia.
          </div>
        ) : (
          sortedItems.map(item => {
            const isShow = Boolean(item.item_type === 'show' && item.show_block_start && item.show_block_end);
            const conflict = findConflictingShow(item, sortedItems);

            return (
              <div
                key={item.id}
                className={`glass-card p-4 rounded-2xl border space-y-3 ${
                  isShow ? 'border-purple-500/40 bg-purple-500/5' : 'border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isShow ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/10 text-blue-400'
                      }`}
                    >
                      {isShow ? <Clapperboard className="w-4 h-4" /> : item.time_start}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {item.item_type ? ITEM_TYPE_LABELS[item.item_type] : item.category}
                        </span>
                        {isShow && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Horário fixo {item.show_block_start}–{item.show_block_end}
                          </span>
                        )}
                        {!isShow && item.time_is_estimated && (
                          <span className="text-[10px] text-slate-500">~ horário estimado</span>
                        )}
                        {item.counts_toward_completion === false && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-900 text-slate-500 border border-slate-800">
                            Não conta para cobertura
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-base text-white mt-0.5">{item.title}</h4>
                    </div>
                  </div>
                </div>

                {conflict && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <div>
                      Conflita com <strong>{conflict.title}</strong> ({conflict.show_block_start}–{conflict.show_block_end}).
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
                  {item.participant_ids.map(pId => {
                    const p = participants.find(part => part.id === pId);
                    if (!p) return null;
                    const status = item.participant_status?.[pId] ?? 'pending';
                    return (
                      <button
                        key={pId}
                        onClick={() => handleStatusClick(item, pId)}
                        title={`${p.full_name}: ${STATUS_LABELS[status] ?? status}`}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 transition ${
                          STATUS_STYLES[status] ?? STATUS_STYLES.pending
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full ${p.avatar_color} text-white text-[9px] font-bold flex items-center justify-center`}>
                          {p.nickname ? p.nickname[0] : p.full_name[0]}
                        </span>
                        {STATUS_LABELS[status] ?? status}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
