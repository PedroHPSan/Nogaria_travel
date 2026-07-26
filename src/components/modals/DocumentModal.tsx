import React, { useState } from 'react';
import { BaseModal } from './BaseModal';
import { Sparkles, FileText } from 'lucide-react';
import type { Participant } from '../../types/database.types';

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (doc: any) => void;
  participants: Participant[];
  tripId: string;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  participants,
  tripId
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'flight' | 'hotel' | 'car' | 'ticket' | 'insurance' | 'personal'>('flight');
  const [fileUrl, setFileUrl] = useState('');
  const [linkedEntityType, setLinkedEntityType] = useState<'participant' | 'flight' | 'accommodation' | 'transport' | ''>('');
  const [linkedEntityId, setLinkedEntityId] = useState('');
  const [fileSize, setFileSize] = useState('1.5 MB');
  const [notes, setNotes] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const handleSimulateOcr = () => {
    setIsParsing(true);
    setTimeout(() => {
      setIsParsing(false);
      setTitle('Voucher Confirmado Disney All-Star Movies');
      setCategory('hotel');
      setFileUrl('https://example.com/vouchers/extracted-disney-resort.pdf');
      setFileSize('2.1 MB');
      setNotes('Leitura IA (OCR): Reserva DSNY-994821 • Check-in: 01/09/2026 • Hóspedes: Bárbara, Débora, Pedro, Gabi');
    }, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      trip_id: tripId,
      title: title.trim(),
      category,
      file_url: fileUrl.trim() || 'https://example.com/vouchers/voucher-document.pdf',
      linked_entity_type: linkedEntityType || undefined,
      linked_entity_id: linkedEntityId || undefined,
      file_size: fileSize,
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Anexar Novo Documento / Voucher"
      subtitle="Armazene bilhetes em PDF, apólices de seguro e comprovantes com simulação de leitura IA (OCR)."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950 to-purple-950 border border-indigo-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white">Extração Inteligente de PDF (IA OCR)</div>
              <div className="text-[10px] text-slate-400">Preencha os campos automaticamente lendo um voucher PDF</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSimulateOcr}
            disabled={isParsing}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition flex items-center gap-1.5"
          >
            {isParsing ? 'Lendo PDF...' : 'Simular OCR por IA'}
          </button>
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Título do Documento *</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Passagens AD 8702 / Voucher Hertz SUV / Apólice Seguro Viagem"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-semibold"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Categoria do Arquivo</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="flight">✈️ Passagem Aérea / Bilhete</option>
              <option value="hotel">🏨 Voucher de Hospedagem</option>
              <option value="car">🚗 Reserva de Veículo / Transfer</option>
              <option value="ticket">🎟️ Ingressos de Parques / Atração</option>
              <option value="insurance">🛡️ Apólice de Seguro Viagem</option>
              <option value="personal">📄 Passaporte / Visto / Pessoal</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Link do Arquivo (PDF / Imagem)</label>
            <input
              type="text"
              value={fileUrl}
              onChange={e => setFileUrl(e.target.value)}
              placeholder="Ex: https://drive.google.com/voucher.pdf"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Vincular a Participante (Opcional)</label>
            <select
              value={linkedEntityId}
              onChange={e => {
                setLinkedEntityId(e.target.value);
                setLinkedEntityType(e.target.value ? 'participant' : '');
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">-- Todo o Grupo --</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Tamanho Estimado</label>
            <input
              type="text"
              value={fileSize}
              onChange={e => setFileSize(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Observações & Leitura IA</label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Comprovante de emissão confirmada com localizador PDRGAB26."
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            Anexar Documento
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
