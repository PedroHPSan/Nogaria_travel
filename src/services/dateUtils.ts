/**
 * Data local (AAAA-MM-DD) do dispositivo, no fuso do navegador — NÃO em UTC.
 *
 * `new Date().toISOString().slice(0, 10)` é o bug clássico: `toISOString`
 * sempre serializa em UTC, então em qualquer fuso atrás de UTC (Orlando é
 * UTC-4/-5) a virada de dia acontece cedo demais na tela — às 20h/21h locais
 * o app já mostra o dia seguinte como "hoje". `getFullYear`/`getMonth`/
 * `getDate` leem os componentes no fuso do navegador, que é o que a família
 * está vendo no relógio da tela.
 */
export function todayLocalIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
