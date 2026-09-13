import { describe, expect, it } from 'vitest';
import { formatParkStatusLine, type DigestParkStatus } from '../formatter.ts';

describe('formatParkStatusLine', () => {
  it('parque fechado', () => {
    const status: DigestParkStatus = { park: 'EPCOT', opening: null, closing: null, closed: true, attractions: [] };
    expect(formatParkStatusLine(status)).toContain('fechado');
    expect(formatParkStatusLine(status)).toContain('EPCOT');
  });

  it('horário aberto, sem atrações sinalizadas', () => {
    const status: DigestParkStatus = { park: 'EPCOT', opening: '09:00', closing: '21:00', closed: false, attractions: [] };
    const line = formatParkStatusLine(status);
    expect(line).toContain('09:00–21:00');
    expect(line).not.toContain('⚠️');
  });

  it('sinaliza atrações em manutenção/fechadas, no máximo 3', () => {
    const status: DigestParkStatus = {
      park: 'EPCOT',
      opening: '09:00',
      closing: '21:00',
      closed: false,
      attractions: [
        { title: 'Test Track', status: 'REFURBISHMENT' },
        { title: 'Soarin', status: 'CLOSED' },
        { title: 'Spaceship Earth', status: 'DOWN' },
        { title: 'Frozen Ever After', status: 'REFURBISHMENT' },
        { title: 'Living with the Land', status: 'OPERATING' },
      ],
    };
    const line = formatParkStatusLine(status)!;
    expect(line).toContain('Test Track (manutenção)');
    expect(line).toContain('Soarin (fechada)');
    expect(line).toContain('Spaceship Earth (fora do ar)');
    expect(line).not.toContain('Frozen Ever After');
    expect(line).not.toContain('Living with the Land');
  });

  it('sem horário e sem atrações sinalizadas: omite (retorna null)', () => {
    const status: DigestParkStatus = { park: 'EPCOT', opening: null, closing: null, closed: false, attractions: [] };
    expect(formatParkStatusLine(status)).toBeNull();
  });
});
