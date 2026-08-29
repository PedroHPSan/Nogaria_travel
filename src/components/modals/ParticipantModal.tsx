import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { Participant } from '../../types/database.types';
import { deriveAge } from '../../data/mappers/participantMapper';
import { Avatar, DiceBearAvatar } from '../Avatar';
import {
  randomAvatarSeed,
  encodeAvatarFilters,
  decodeAvatarFilters,
  SKIN_TONES,
  CLOTHES_COLORS,
  CLOTHING_OPTIONS,
  AVATAR_EMOTIONS,
  ACCESSORY_OPTIONS,
  type AvatarGender
} from '../../services/avatarGenerator';

interface ParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (participant: any) => void;
  initialData?: Participant | null;
  existingParticipants: Participant[];
  tripId: string;
}

// Opções de avatar mostradas no grid: mantém a seed já escolhida (se houver) e
// completa com seeds aleatórias novas — "sortear" só troca as aleatórias.
function buildAvatarCandidates(current: string | null): string[] {
  const seeds = new Set<string>(current ? [current] : []);
  while (seeds.size < 8) seeds.add(randomAvatarSeed());
  return Array.from(seeds);
}

const COLOR_OPTIONS = [
  'bg-success-500',
  'bg-accent-500',
  'bg-info-500',
  'bg-warning-500',
  'bg-danger-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-pink-500'
];

export const ParticipantModal: React.FC<ParticipantModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingParticipants,
  tripId
}) => {
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [relationship, setRelationship] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [visaStatus, setVisaStatus] = useState<'valid' | 'pending' | 'exempt' | 'expired'>('valid');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [dietary, setDietary] = useState('');
  const [notes, setNotes] = useState('');
  const [budgetLimit, setBudgetLimit] = useState<number>(2000);
  const [avatarColor, setAvatarColor] = useState('bg-info-500');
  const [avatarSeed, setAvatarSeed] = useState<string | null>(null);
  const [avatarGender, setAvatarGender] = useState<AvatarGender>('neutral');
  const [avatarSkinColor, setAvatarSkinColor] = useState<string | null>(null);
  const [avatarClothing, setAvatarClothing] = useState<string | null>(null);
  const [avatarClothesColor, setAvatarClothesColor] = useState<string | null>(null);
  const [avatarEmotion, setAvatarEmotion] = useState<string | null>(null);
  const [avatarAccessory, setAvatarAccessory] = useState<string | null>(null);
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null);
  const [avatarCandidates, setAvatarCandidates] = useState<string[]>([]);
  const [error, setError] = useState('');

  // avatar_preset_id guarda seed + filtros (gênero/pele/roupa) num JSON —
  // ver avatarGenerator.ts. Recalculado a cada render, é barato (JSON.stringify).
  const avatarPresetId = avatarSeed
    ? encodeAvatarFilters({
        seed: avatarSeed,
        gender: avatarGender !== 'neutral' ? avatarGender : undefined,
        skinColor: avatarSkinColor ?? undefined,
        clothing: avatarClothing ?? undefined,
        clothesColor: avatarClothesColor ?? undefined,
        emotion: avatarEmotion ?? undefined,
        accessory: avatarAccessory ?? undefined
      })
    : null;

  // Preview de um candidato do grid já com os filtros atuais aplicados.
  const previewIdFor = (seed: string) =>
    encodeAvatarFilters({
      seed,
      gender: avatarGender !== 'neutral' ? avatarGender : undefined,
      skinColor: avatarSkinColor ?? undefined,
      clothing: avatarClothing ?? undefined,
      clothesColor: avatarClothesColor ?? undefined,
      emotion: avatarEmotion ?? undefined,
      accessory: avatarAccessory ?? undefined
    });

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.full_name || '');
      setNickname(initialData.nickname || '');
      setBirthDate(initialData.birth_date || '');
      setRelationship(initialData.relationship || '');
      setResponsibleId(initialData.responsible_participant_id || '');
      setPassportNumber(initialData.passport_number || '');
      setPassportExpiry(initialData.passport_expiry || '');
      setVisaStatus(initialData.visa_status || 'valid');
      setHeightCm(initialData.height_cm ?? '');
      setDietary(initialData.dietary_restrictions ? initialData.dietary_restrictions.join(', ') : '');
      setNotes(initialData.notes || '');
      setBudgetLimit(initialData.budget_limit_usd || 2000);
      setAvatarColor(initialData.avatar_color || 'bg-info-500');
      if (initialData.avatar_preset_id) {
        const filters = decodeAvatarFilters(initialData.avatar_preset_id);
        setAvatarSeed(filters.seed);
        setAvatarGender(filters.gender || 'neutral');
        setAvatarSkinColor(filters.skinColor || null);
        setAvatarClothing(filters.clothing || null);
        setAvatarClothesColor(filters.clothesColor || null);
        setAvatarEmotion(filters.emotion || null);
        setAvatarAccessory(filters.accessory || null);
        setAvatarCandidates(buildAvatarCandidates(filters.seed));
      } else {
        setAvatarSeed(null);
        setAvatarGender('neutral');
        setAvatarSkinColor(null);
        setAvatarClothing(null);
        setAvatarClothesColor(null);
        setAvatarEmotion(null);
        setAvatarAccessory(null);
        setAvatarCandidates(buildAvatarCandidates(null));
      }
      setAvatarEmoji(initialData.avatar_emoji || null);
    } else {
      setFullName('');
      setNickname('');
      setBirthDate('');
      setRelationship('');
      setResponsibleId('');
      setPassportNumber('');
      setPassportExpiry('');
      setVisaStatus('valid');
      setHeightCm('');
      setDietary('');
      setNotes('');
      setBudgetLimit(2000);
      setAvatarColor('bg-info-500');
      setAvatarSeed(null);
      setAvatarGender('neutral');
      setAvatarSkinColor(null);
      setAvatarClothing(null);
      setAvatarClothesColor(null);
      setAvatarEmotion(null);
      setAvatarAccessory(null);
      setAvatarEmoji(null);
      setAvatarCandidates(buildAvatarCandidates(null));
    }
    setError('');
  }, [initialData, isOpen]);

  const hoje = new Date().toISOString().split('T')[0];
  const idadeCalculada = birthDate ? deriveAge(birthDate, hoje) : null;
  const isMinor = idadeCalculada !== null && idadeCalculada < 18;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    if (!birthDate) {
      setError('Informe a data de nascimento.');
      return;
    }

    const dietaryArray = dietary
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    onSave({
      trip_id: tripId,
      full_name: fullName.trim(),
      nickname: nickname.trim() || undefined,
      birth_date: birthDate,
      relationship: relationship.trim() || 'Membro do Grupo',
      responsible_participant_id: isMinor ? responsibleId || undefined : undefined,
      passport_number: passportNumber.trim() || undefined,
      passport_expiry: passportExpiry || undefined,
      visa_status: visaStatus,
      height_cm: heightCm !== '' ? Number(heightCm) : undefined,
      dietary_restrictions: dietaryArray,
      notes: notes.trim() || undefined,
      budget_limit_usd: Number(budgetLimit) || 0,
      avatar_preset_id: avatarPresetId,
      avatar_emoji: avatarEmoji,
      avatar_color: avatarColor
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Participante' : 'Cadastrar Novo Participante'}
      subtitle="Defina dados pessoais, passaporte, visto, restrições por idade/altura e teto de orçamento."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Nome Completo *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Ex: Bárbara Palheta"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Apelido / Nome Curto</label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="Ex: Bárbara"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Data Nascimento *</label>
            <input
              type="date"
              required
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
            {idadeCalculada !== null && (
              <p className="mt-1 text-[11px] text-ink-500">
                {idadeCalculada} anos
                {idadeCalculada < 18 && ' — menor de idade, informe o responsável'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Altura (cm)</label>
            <input
              type="number"
              placeholder="Ex: 100 para 4 anos"
              value={heightCm}
              onChange={e => setHeightCm(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Relação no Grupo</label>
            <input
              type="text"
              value={relationship}
              onChange={e => setRelationship(e.target.value)}
              placeholder="Ex: Mãe, Pai, Filha de Bárbara, etc."
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Orçamento Limite (US$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={budgetLimit}
              onChange={e => setBudgetLimit(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold text-success-400"
            />
          </div>
        </div>

        {isMinor && (
          <div className="p-3 rounded-xl bg-ink-950/60 border border-ink-800 flex items-center justify-between">
            <span className="text-ink-200 font-medium">
              Menor de Idade (Requer controle legal e de atrações)
            </span>

            <select
              value={responsibleId}
              onChange={e => setResponsibleId(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-ink-900 border border-ink-700 text-ink-100 text-xs"
            >
              <option value="">-- Selecione o Responsável Legal --</option>
              {existingParticipants
                .filter(p => !p.is_minor && p.id !== initialData?.id)
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Número do Passaporte</label>
            <input
              type="text"
              value={passportNumber}
              onChange={e => setPassportNumber(e.target.value)}
              placeholder="Ex: BR984712"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 uppercase"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Validade do Passaporte</label>
            <input
              type="date"
              value={passportExpiry}
              onChange={e => setPassportExpiry(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Status do Visto EUA</label>
            <select
              value={visaStatus}
              onChange={e => setVisaStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            >
              <option value="valid">Visto Válido (Aprovado)</option>
              <option value="pending">Pendente Emissão / Entrevista</option>
              <option value="exempt">Isento (Passaporte Europeu / ESTA)</option>
              <option value="expired">Vencido</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Restrições Alimentares (separadas por vírgula)</label>
          <input
            type="text"
            value={dietary}
            onChange={e => setDietary(e.target.value)}
            placeholder="Ex: Sem lactose, Alergia a amendoim"
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
          />
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Observações & Regras do Participante</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Exige carrinho infantil e pausa de descanso. Preferência por atrações calmas."
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
          />
        </div>

        <div className="p-4 rounded-xl bg-ink-900 border border-ink-800 space-y-4">
          <label className="block text-ink-300 font-semibold mb-2">Avatar do Participante</label>
          
          <div className="flex items-center gap-6">
            <Avatar 
              participant={{ 
                full_name: fullName, 
                nickname: nickname,
                avatar_preset_id: avatarPresetId,
                avatar_emoji: avatarEmoji,
                avatar_color: avatarColor 
              }} 
              size="lg" 
            />

            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] text-ink-400 font-medium uppercase tracking-wider">Avatares</p>
                  <button
                    type="button"
                    onClick={() => setAvatarCandidates(buildAvatarCandidates(avatarSeed))}
                    className="text-[11px] text-info-400 hover:text-info-300 font-medium"
                  >
                    🎲 Sortear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {avatarCandidates.map(seed => (
                    <button
                      type="button"
                      key={seed}
                      onClick={() => {
                        setAvatarSeed(seed);
                        setAvatarEmoji(null);
                      }}
                      className={`w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center transition-all ${
                        avatarSeed === seed
                          ? 'bg-info-500/20 border-2 border-info-500 scale-110 shadow-lg'
                          : 'bg-ink-800 border border-ink-700 hover:bg-ink-700'
                      }`}
                      title="Escolher este avatar"
                    >
                      <DiceBearAvatar seed={previewIdFor(seed)} className="w-full h-full flex items-center justify-center" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarSeed(null);
                      setAvatarEmoji(null);
                    }}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                      !avatarSeed && !avatarEmoji
                        ? 'bg-info-500/20 border-2 border-info-500 scale-110 shadow-lg'
                        : 'bg-ink-800 border border-ink-700 hover:bg-ink-700 text-ink-400'
                    }`}
                    title="Iniciais"
                  >
                    Tx
                  </button>
                </div>
              </div>

              {avatarSeed && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <p className="text-[11px] text-ink-400 mb-1.5 font-medium uppercase tracking-wider">Gênero</p>
                    <div className="flex gap-1">
                      {(['neutral', 'male', 'female'] as AvatarGender[]).map(g => (
                        <button
                          type="button"
                          key={g}
                          onClick={() => setAvatarGender(g)}
                          className={`flex-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            avatarGender === g
                              ? 'bg-info-500/20 border border-info-500 text-info-300'
                              : 'bg-ink-800 border border-ink-700 text-ink-400 hover:bg-ink-700'
                          }`}
                        >
                          {g === 'neutral' ? 'Neutro' : g === 'male' ? 'Homem' : 'Mulher'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-ink-400 mb-1.5 font-medium uppercase tracking-wider">Roupa</p>
                    <select
                      value={avatarClothing || ''}
                      onChange={e => setAvatarClothing(e.target.value || null)}
                      className="w-full px-2 py-1 rounded-lg bg-ink-950 border border-ink-800 text-ink-100 text-[11px] focus:outline-none focus:border-info-500"
                    >
                      <option value="">Aleatória</option>
                      {CLOTHING_OPTIONS.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-[11px] text-ink-400 mb-1.5 font-medium uppercase tracking-wider">Cor da Pele</p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setAvatarSkinColor(null)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] text-ink-400 ${
                          !avatarSkinColor ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        style={{ background: 'repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%)', backgroundSize: '6px 6px' }}
                        title="Aleatória"
                      />
                      {SKIN_TONES.map(tone => (
                        <button
                          type="button"
                          key={tone}
                          onClick={() => setAvatarSkinColor(tone)}
                          className={`w-5 h-5 rounded-full border-2 transition ${
                            avatarSkinColor === tone ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: `#${tone}` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-ink-400 mb-1.5 font-medium uppercase tracking-wider">Emoção</p>
                    <select
                      value={avatarEmotion || ''}
                      onChange={e => setAvatarEmotion(e.target.value || null)}
                      className="w-full px-2 py-1 rounded-lg bg-ink-950 border border-ink-800 text-ink-100 text-[11px] focus:outline-none focus:border-info-500"
                    >
                      <option value="">Aleatória</option>
                      {AVATAR_EMOTIONS.map(e => (
                        <option key={e.id} value={e.id}>{e.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-[11px] text-ink-400 mb-1.5 font-medium uppercase tracking-wider">Acessório</p>
                    <select
                      value={avatarAccessory || ''}
                      onChange={e => setAvatarAccessory(e.target.value || null)}
                      className="w-full px-2 py-1 rounded-lg bg-ink-950 border border-ink-800 text-ink-100 text-[11px] focus:outline-none focus:border-info-500"
                    >
                      <option value="">Nenhum</option>
                      {ACCESSORY_OPTIONS.map(a => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-[11px] text-ink-400 mb-1.5 font-medium uppercase tracking-wider">Cor da Roupa</p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setAvatarClothesColor(null)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] text-ink-400 ${
                          !avatarClothesColor ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        style={{ background: 'repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%)', backgroundSize: '6px 6px' }}
                        title="Aleatória"
                      />
                      {CLOTHES_COLORS.map(c => (
                        <button
                          type="button"
                          key={c}
                          onClick={() => setAvatarClothesColor(c)}
                          className={`w-5 h-5 rounded-full border-2 transition ${
                            avatarClothesColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: `#${c}` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-[11px] text-ink-400 mb-1.5 font-medium uppercase tracking-wider">Emoji Customizado</p>
                  <input
                    type="text"
                    maxLength={2}
                    value={avatarEmoji || ''}
                    onChange={e => {
                      setAvatarEmoji(e.target.value);
                      if (e.target.value) setAvatarSeed(null);
                    }}
                    placeholder="Ex: 🦁"
                    className="w-full max-w-[120px] px-3 py-1.5 rounded-lg bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 text-center text-lg"
                  />
                </div>

                <div className="flex-1">
                  <p className="text-[11px] text-ink-400 mb-1.5 font-medium uppercase tracking-wider">Cor de Fundo</p>
                  <div className="flex flex-wrap gap-1">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setAvatarColor(c)}
                        className={`w-6 h-6 rounded-full ${c} border-2 ${
                          avatarColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                        } transition`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
            className="px-5 py-2 rounded-xl bg-info-600 hover:bg-info-500 text-white font-bold shadow-lg shadow-info-600/30"
          >
            Salvar Participante
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
