import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { DocumentModal } from '../../components/modals/DocumentModal';
import { ViewHeader } from '../../components/ui/ViewHeader';
import {
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  Search
} from 'lucide-react';


export const DocumentsView: React.FC = () => {
  const { activeTrip, participants, documents, addDocument, deleteDocument } = useTrip();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const tripDocs = documents.filter(d => d.trip_id === activeTrip.id);
  const filtered = tripDocs.filter(d => {
    if (selectedCategory !== 'all' && d.category !== selectedCategory) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-20">
      <ViewHeader
        title="Documentos, Vouchers & Leitura Inteligente IA"
        subtitle="Centralize arquivos de voo, reservas de hotel e seguro com extração automática via inteligência artificial (OCR)."
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Anexar Documento
          </button>
        }
      />

      {/* Filter & Search Bar */}
      <div className="p-3 rounded-2xl glass-panel border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título ou voucher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 w-60"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Categoria:</span>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 font-semibold"
          >
            <option value="all">Todas as Categorias ({tripDocs.length})</option>
            <option value="flight">✈️ Voos & Passagens</option>
            <option value="hotel">🏨 Hospedagem & Resorts</option>
            <option value="car">🚗 Veículos & Transporte</option>
            <option value="ticket">🎟️ Ingressos & Parques</option>
            <option value="insurance">🛡️ Seguro Viagem</option>
            <option value="personal">📄 Documentos Pessoais</option>
          </select>
        </div>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map(doc => {
          const linkedParticipant = doc.linked_entity_id
            ? participants.find(p => p.id === doc.linked_entity_id)
            : null;

          return (
            <div key={doc.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3 relative hover:border-blue-500/30 transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {doc.category.toUpperCase()}
                    </span>
                    <h4 className="font-bold text-sm text-white mt-1 leading-tight">{doc.title}</h4>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Deseja excluir "${doc.title}"?`)) deleteDocument(doc.id);
                  }}
                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                  title="Excluir Documento"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {doc.notes && (
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
                  {doc.notes}
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800 text-slate-400">
                <span>{doc.file_size || 'PDF'}{linkedParticipant ? ` • ${linkedParticipant.full_name}` : ''}</span>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir Voucher
                </a>
              </div>

            </div>
          );
        })}
      </div>

      <DocumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={docData => addDocument(docData)}
        participants={participants}
        tripId={activeTrip.id}
      />
    </div>
  );
};
