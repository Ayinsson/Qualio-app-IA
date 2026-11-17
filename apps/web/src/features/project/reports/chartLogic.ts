// Lógica pura de los gráficos de reportes (escalas y etiquetas), separada para poder probarla.

/** Máximo "redondo" del eje y sus marcas: 0, 5, 10, 15... (nunca un eje de 0 a 0). */
export function niceScale(maxValue: number, targetTicks = 4): { max: number; ticks: number[] } {
  if (maxValue <= 0) {
    return { max: 4, ticks: [0, 1, 2, 3, 4] };
  }

  const rough = maxValue / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough) ?? 10 * magnitude;
  const niceStep = Math.max(1, step);
  const max = Math.ceil(maxValue / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += niceStep) {
    ticks.push(value);
  }
  return { max, ticks };
}

function parseDay(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

const dayMonth = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

/** "16 nov" a partir de "2026-11-16" (fecha de calendario, sin zona horaria). */
export function shortDay(value: string): string {
  return dayMonth.format(parseDay(value)).replace('.', '');
}

/** "15–21 nov" para un tramo de 7 días del mes, sin pasarse del último día. */
export function monthSliceLabel(weekStart: string): string {
  const start = parseDay(weekStart);
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const endDay = Math.min(start.getDate() + 6, lastDay);
  const month = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(start).replace('.', '');
  return `${start.getDate()}–${endDay} ${month}`;
}

/** Etiqueta de semana: usa weekStart si la API lo manda; si no, el código original. */
export function weekLabel(weekStart: string | undefined, fallback: string): string {
  return weekStart ? shortDay(weekStart) : fallback;
}

export function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace('.', ',')} %`;
}

/** Tiempo promedio de cierre. Con cierres el mismo día el promedio es 0: eso es "menos de 1 día", no "sin datos". */
export function formatLeadTime(days: number, closedCount: number): string {
  if (closedCount <= 0) {
    return 'Sin cierres este mes';
  }
  if (days < 1) {
    return 'Menos de 1 día';
  }
  const rounded = Math.round(days * 10) / 10;
  return `${String(rounded).replace('.', ',')} ${rounded === 1 ? 'día' : 'días'}`;
}
