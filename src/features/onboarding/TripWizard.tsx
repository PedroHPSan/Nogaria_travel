import React, { useState } from 'react';
import { Plane, Users, Check, Plus, Trash2 } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useAuth } from '../../context/AuthContext';

interface RascunhoParticipante {
  full_name: string;
  nickname: string;
  birth_date: string;
  relationship: string;
  budget_limit_usd: string;
}

const CORES = ['bg-success-500', 'bg-accent-500', 'bg-info-500', 'bg-orange-500', 'bg-danger-500'];

const participanteVazio = (): RascunhoParticipante => ({
  full_name: '',
  nickname: '',
  birth_date: '',
  relationship: '',
  budget_limit_usd: '',
});

export const TripWizard: React.FC = () => {
  const { createTrip, addParticipant, setActiveTripId } = useTrip();
  const { profile, tenantMemberships, activeTenantId, setActiveTenantId, signOut } = useAuth();

  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [erro, setErro] = useState('');
  const [criando, setCriando] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [destino, setDestino] = useState('');
  const [ida, setIda] = useState('');
  const [volta, setVolta] = useState('');

  const [pessoas, setPessoas] = useState<RascunhoParticipante[]>([participanteVazio()]);

  const alterarPessoa = (i: number, campo: keyof RascunhoParticipante, valor: string) => {
    setPessoas(prev => prev.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p)));
  };

  const validarPasso1 = () => {
    if (!titulo.trim()) return 'Dê um nome à viagem.';
    if (!destino.trim()) return 'Informe o destino principal.';
    if (!ida) return 'Informe a data de ida.';
    if (!volta) return 'Informe a data de volta.';
    if (volta < ida) return 'A volta não pode ser anterior à ida.';
    return '';
  };

  const validarPasso2 = () => {
    if (pessoas.length === 0) return 'Adicione ao menos uma pessoa.';
    for (const p of pessoas) {
      if (!p.full_name.trim()) return 'Todo participante precisa de nome.';
      if (!p.birth_date) return `Informe a data de nascimento de ${p.full_name.trim()}.`;
    }
    return '';
  };

  const avancar = () => {
    const problema = passo === 1 ? validarPasso1() : validarPasso2();
    if (problema) return setErro(problema);
    setErro('');
    setPasso(p => (p === 1 ? 2 : 3));
  };

  const concluir = async () => {
    if (!activeTenantId) return setErro('Nenhuma organização ativa.');

    setErro('');
    setCriando(true);

    let tripId: string;
    try {
      // Espera o INSERT da viagem confirmar no banco antes de criar os
      // participantes: o RLS de `participants` só aceita a linha se a viagem
      // já existir em `public.trips`, então criar em paralelo derruba o insert.
      tripId = await createTrip({
        tenant_id: activeTenantId,
        title: titulo.trim(),
        destination_main: destino.trim(),
        start_date: ida,
        end_date: volta,
        currency_base: 'USD',
        status: 'planning',
      });
    } catch {
      setCriando(false);
      return setErro('Não foi possível criar a viagem. Tente novamente.');
    }

    pessoas.forEach((p, i) => {
      addParticipant({
        trip_id: tripId,
        full_name: p.full_name.trim(),
        nickname: p.nickname.trim() || undefined,
        birth_date: p.birth_date,
        relationship: p.relationship.trim() || 'Membro do Grupo',
        budget_limit_usd: Number(p.budget_limit_usd) || 0,
        avatar_color: CORES[i % CORES.length],
      });
    });

    setActiveTripId(tripId);
    setCriando(false);
  };

  const campo = 'w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-info-500 focus:outline-none';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 p-4">
      <div className="mb-4 flex w-full max-w-2xl items-center justify-between px-2 text-xs text-ink-400">
        <div>
          Conectado como <strong className="text-ink-100">{profile?.email}</strong>
        </div>
        <div className="flex items-center gap-3">
          {tenantMemberships.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={e => setActiveTenantId(e.target.value)}
              className="rounded bg-ink-900 border border-ink-700 px-2 py-1 text-ink-200"
            >
              {tenantMemberships.map(m => (
                <option key={m.tenant.id} value={m.tenant.id}>
                  {m.tenant.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => signOut()}
            className="text-danger-400 hover:text-danger-300 font-semibold"
          >
            Sair da Conta
          </button>
        </div>
      </div>

      <div className="glass-panel w-full max-w-2xl rounded-2xl p-8">
        <div className="mb-6 flex items-center gap-3">
          {passo === 1 && <Plane className="text-info-400" size={22} />}
          {passo === 2 && <Users className="text-accent-400" size={22} />}
          {passo === 3 && <Check className="text-success-400" size={22} />}
          <div>
            <h1 className="text-xl font-bold text-ink-100">
              {passo === 1 && 'Sua primeira viagem'}
              {passo === 2 && 'Quem vai com você'}
              {passo === 3 && 'Confirme e comece'}
            </h1>
            <p className="text-xs text-ink-500">Passo {passo} de 3</p>
          </div>
        </div>

        {passo === 1 && (
          <div className="space-y-3">
            <input className={campo} placeholder="Nome da viagem (ex: Miami e Orlando 2026)" value={titulo} onChange={e => setTitulo(e.target.value)} />
            <input className={campo} placeholder="Destino principal (ex: Orlando, EUA)" value={destino} onChange={e => setDestino(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-ink-400">
                Ida
                <input type="date" className={`${campo} mt-1`} value={ida} onChange={e => setIda(e.target.value)} />
              </label>
              <label className="text-xs text-ink-400">
                Volta
                <input type="date" className={`${campo} mt-1`} value={volta} onChange={e => setVolta(e.target.value)} />
              </label>
            </div>
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-4">
            {pessoas.map((p, i) => (
              <div key={i} className="glass-card rounded-xl p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-400">Pessoa {i + 1}</span>
                  {pessoas.length > 1 && (
                    <button onClick={() => setPessoas(prev => prev.filter((_, idx) => idx !== i))} className="text-danger-400 hover:text-danger-300">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className={campo} placeholder="Nome completo" value={p.full_name} onChange={e => alterarPessoa(i, 'full_name', e.target.value)} />
                  <input className={campo} placeholder="Apelido" value={p.nickname} onChange={e => alterarPessoa(i, 'nickname', e.target.value)} />
                  <label className="text-xs text-ink-400">
                    Nascimento
                    <input type="date" className={`${campo} mt-1`} value={p.birth_date} onChange={e => alterarPessoa(i, 'birth_date', e.target.value)} />
                  </label>
                  <label className="text-xs text-ink-400">
                    Orçamento (US$)
                    <input type="number" min="0" className={`${campo} mt-1`} value={p.budget_limit_usd} onChange={e => alterarPessoa(i, 'budget_limit_usd', e.target.value)} />
                  </label>
                  <input className={`${campo} col-span-2`} placeholder="Relação (ex: Pai, Filha, Amigo)" value={p.relationship} onChange={e => alterarPessoa(i, 'relationship', e.target.value)} />
                </div>
              </div>
            ))}
            <button onClick={() => setPessoas(prev => [...prev, participanteVazio()])} className="flex items-center gap-1.5 text-sm font-semibold text-info-400 hover:text-info-300">
              <Plus size={14} /> Adicionar pessoa
            </button>
          </div>
        )}

        {passo === 3 && (
          <div className="space-y-3 text-sm">
            <div className="glass-card rounded-xl p-4">
              <p className="font-bold text-ink-100">{titulo}</p>
              <p className="text-ink-400">{destino}</p>
              <p className="mt-1 text-xs text-ink-500">{ida} até {volta}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                {pessoas.length === 1 ? '1 participante' : `${pessoas.length} participantes`}
              </p>
              <ul className="space-y-1">
                {pessoas.map((p, i) => (
                  <li key={i} className="flex justify-between text-ink-300">
                    <span>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</span>
                    <span className="text-ink-500">US$ {Number(p.budget_limit_usd) || 0}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {erro && <p className="mt-4 text-sm text-danger-400">{erro}</p>}

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => { setErro(''); setPasso(p => (p === 3 ? 2 : 1)); }}
            disabled={passo === 1}
            className="rounded-lg px-4 py-2 text-sm text-ink-400 disabled:opacity-0 hover:text-ink-200"
          >
            Voltar
          </button>
          <button
            onClick={passo === 3 ? concluir : avancar}
            disabled={criando}
            className="rounded-lg bg-info-600 px-5 py-2 text-sm font-semibold text-white hover:bg-info-500 disabled:opacity-60"
          >
            {passo === 3 ? (criando ? 'Criando...' : 'Criar viagem') : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
};
