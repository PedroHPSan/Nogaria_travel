import { describe, expect, it } from 'vitest';
import {
  evaluateQuota,
  formatQuotaExceeded,
  formatQuotaWarning,
  monthStartUtcIso,
  nextMonthStartLocalIso,
  resolveMonthlyQuota,
} from '../quota.ts';

describe('quota (#27)', () => {
  describe('resolveMonthlyQuota', () => {
    it('plano Família tem 300 mensagens/mês', () => {
      expect(resolveMonthlyQuota({ plan: 'family', override: null })).toBe(300);
    });

    it('override da config vence o plano, inclusive zero (bot bloqueado)', () => {
      expect(resolveMonthlyQuota({ plan: 'family', override: 1000 })).toBe(1000);
      expect(resolveMonthlyQuota({ plan: 'family', override: 0 })).toBe(0);
    });

    it('enterprise e plano desconhecido são ilimitados; override inválido é ignorado', () => {
      expect(resolveMonthlyQuota({ plan: 'enterprise', override: null })).toBeNull();
      expect(resolveMonthlyQuota({ plan: 'xpto', override: undefined })).toBeNull();
      expect(resolveMonthlyQuota({ plan: 'free', override: -5 })).toBe(50);
    });
  });

  describe('evaluateQuota', () => {
    it('ok abaixo de 90%', () => {
      expect(evaluateQuota(100, 300)).toEqual({ kind: 'ok', used: 100, quota: 300, remaining: 200 });
    });

    it('warning a partir de 90%', () => {
      expect(evaluateQuota(270, 300).kind).toBe('warning');
      expect(evaluateQuota(300, 300)).toEqual({ kind: 'warning', used: 300, quota: 300, remaining: 0 });
    });

    it('exceeded quando a mensagem atual passa do teto', () => {
      expect(evaluateQuota(301, 300)).toEqual({ kind: 'exceeded', used: 301, quota: 300 });
    });

    it('quota zero bloqueia a primeira mensagem; null é ilimitado', () => {
      expect(evaluateQuota(1, 0).kind).toBe('exceeded');
      expect(evaluateQuota(99999, null)).toEqual({ kind: 'unlimited' });
    });
  });

  describe('fronteira do mês no fuso do tenant', () => {
    it('início do mês em São Paulo (UTC-3) cai às 03:00 UTC do dia 1', () => {
      expect(monthStartUtcIso(new Date('2026-09-15T12:00:00Z'), 'America/Sao_Paulo')).toBe('2026-09-01T03:00:00.000Z');
    });

    it('à 01:00 UTC do dia 1 ainda é dia 31 em São Paulo — o mês corrente é o anterior', () => {
      expect(monthStartUtcIso(new Date('2026-10-01T01:00:00Z'), 'America/Sao_Paulo')).toBe('2026-09-01T03:00:00.000Z');
    });

    it('renovação é o dia 1 do mês seguinte, virando o ano', () => {
      expect(nextMonthStartLocalIso(new Date('2026-12-20T12:00:00Z'), 'America/Sao_Paulo')).toBe('2027-01-01');
      expect(nextMonthStartLocalIso(new Date('2026-09-09T12:00:00Z'), 'America/New_York')).toBe('2026-10-01');
    });
  });

  it('mensagens ao usuário citam o teto e a data de renovação', () => {
    const text = formatQuotaExceeded({ kind: 'exceeded', used: 301, quota: 300 }, '2026-10-01');
    expect(text).toContain('300');
    expect(text).toContain('01/10/2026');
    expect(formatQuotaWarning({ kind: 'warning', used: 275, quota: 300, remaining: 25 })).toContain('restam 25');
  });
});
