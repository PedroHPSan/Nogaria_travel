import React, { useEffect, useState, useCallback } from 'react';
import { BaseModal } from './BaseModal';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, Clock, Trash2 } from 'lucide-react';
import type { UserRole } from '../../types/database.types';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MemberRow {
  user_id: string;
  role: UserRole;
  profiles: { full_name: string; email: string } | null;
}

interface InviteRow {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

const ROLE_OPTIONS: UserRole[] = ['admin', 'organizer', 'participant', 'viewer', 'developer'];

export const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose }) => {
  const { activeTenantId, activeRole } = useAuth();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('participant');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = activeRole === 'admin';

  const loadTeamData = useCallback(async () => {
    if (!activeTenantId) return;

    setError(null);

    const { data: memberData, error: memberError } = await supabase
      .from('memberships')
      .select('user_id, role, profiles(full_name, email)')
      .eq('tenant_id', activeTenantId)
      .returns<MemberRow[]>();
    if (memberError) {
      setError('Não foi possível carregar os membros da equipe.');
    } else {
      setMembers(memberData ?? []);
    }

    if (isAdmin) {
      const { data: inviteData, error: inviteError } = await supabase
        .from('tenant_invites')
        .select('id, email, role, created_at')
        .eq('tenant_id', activeTenantId)
        .is('accepted_at', null)
        .returns<InviteRow[]>();
      if (inviteError) {
        setError('Não foi possível carregar os convites pendentes.');
      } else {
        setInvites(inviteData ?? []);
      }
    }
  }, [activeTenantId, isAdmin]);

  useEffect(() => {
    if (isOpen) loadTeamData();
  }, [isOpen, loadTeamData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenantId || !inviteEmail.trim()) return;

    setError(null);
    setIsSubmitting(true);
    const { error: insertError } = await supabase.from('tenant_invites').insert({
      tenant_id: activeTenantId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole
    });
    setIsSubmitting(false);

    if (insertError) {
      if (insertError.code === '23505') {
        setError('Essa pessoa já faz parte da equipe ou já foi convidada.');
      } else {
        setError(insertError.message);
      }
      return;
    }

    setInviteEmail('');
    await loadTeamData();
  };

  const handleCancelInvite = async (inviteId: string) => {
    setError(null);
    const { error: deleteError } = await supabase.from('tenant_invites').delete().eq('id', inviteId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadTeamData();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Equipe" subtitle="Membros com acesso a esta família/organização.">
      <div className="space-y-5 text-xs">
        {error && (
          <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-slate-300 font-semibold">Membros ({members.length})</h4>
          {members.map(m => (
            <div key={m.user_id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <div className="text-white font-semibold">{m.profiles?.full_name ?? 'Usuário'}</div>
                <div className="text-slate-400">{m.profiles?.email}</div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] uppercase font-bold">
                {m.role}
              </span>
            </div>
          ))}
        </div>

        {isAdmin && invites.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Convites Pendentes
            </h4>
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                  <div className="text-white font-semibold">{inv.email}</div>
                  <div className="text-slate-400">Papel: {inv.role}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCancelInvite(inv.id)}
                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                  title="Cancelar convite"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <form onSubmit={handleInvite} className="pt-3 border-t border-slate-800 space-y-3">
            <h4 className="text-slate-300 font-semibold">Convidar Alguém</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
              >
                {ROLE_OPTIONS.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Convidar
            </button>
          </form>
        )}
      </div>
    </BaseModal>
  );
};
