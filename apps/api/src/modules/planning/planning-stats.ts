/**
 * Cálculos del Planning (sin base de datos).
 *
 * - Las fechas de etapas y macroactividades son "solo día" en formato AAAA-MM-DD.
 * - Días hábiles = lunes a viernes (los feriados aún no se descuentan).
 * - La unidad de avance es un ticket de primer nivel (no subtarea), con peso 1:
 *   cuenta 1 si está terminado; si tiene subtareas y no está terminado, cuenta la
 *   fracción de subtareas cerradas; si no, 0.
 */

export type DateOnly = string;

export type PlanStatus = 'NO_TICKETS' | 'NOT_STARTED' | 'COMPLETED' | 'DELAYED' | 'AT_RISK' | 'ON_TRACK';

/** Puntos de brecha entre el avance esperado y el real a partir de los que una etapa está en riesgo. */
export const AT_RISK_GAP = 15;

export type ProgressUnit = {
  /** 0..1 */
  credit: number;
  /** Día en que el ticket entró a la etapa; null en tickets antiguos (se toman como comprometidos). */
  plannedOn: DateOnly | null;
};

export type ProgressStats = {
  total: number;
  /** Suma de créditos (puede tener decimales por las subtareas). */
  done: number;
  committed: number;
  added: number;
  actualPct: number | null;
  expectedPct: number;
  status: PlanStatus;
  forecastEnd: DateOnly | null;
  slipDays: number;
};

export type ProjectStats = {
  overallPct: number | null;
  plannedEnd: DateOnly | null;
  forecastEnd: DateOnly | null;
  slipDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: DateOnly): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(date: Date): DateOnly {
  return date.toISOString().slice(0, 10);
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export function addDays(date: DateOnly, days: number): DateOnly {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS));
}

/** Días hábiles entre dos fechas, ambas incluidas. 0 si `to` es anterior a `from`. */
export function workingDaysBetween(from: DateOnly, to: DateOnly): number {
  const start = toUtc(from);
  const end = toUtc(to);
  if (end < start) {
    return 0;
  }

  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const fullWeeks = Math.floor(totalDays / 7);
  let count = fullWeeks * 5;
  for (let i = fullWeeks * 7; i < totalDays; i += 1) {
    if (isWeekday(new Date(start.getTime() + i * DAY_MS))) {
      count += 1;
    }
  }
  return count;
}

/** Día hábil que queda `days` días hábiles después de `date` (0 = el mismo día). */
export function addWorkingDays(date: DateOnly, days: number): DateOnly {
  let current = toUtc(date);
  let remaining = days;
  while (remaining > 0) {
    current = new Date(current.getTime() + DAY_MS);
    if (isWeekday(current)) {
      remaining -= 1;
    }
  }
  return fromUtc(current);
}

/** Crédito de un ticket de primer nivel según su estado y el de sus subtareas. */
export function ticketCredit(isDone: boolean, subtasksDone: number, subtasksTotal: number): number {
  if (isDone) {
    return 1;
  }
  if (subtasksTotal > 0) {
    return subtasksDone / subtasksTotal;
  }
  return 0;
}

function percent(value: number): number {
  return Math.round(value * 100);
}

/**
 * Avance, estado y proyección de una etapa o macroactividad.
 * `today` se pasa explícito para que el cálculo sea reproducible.
 */
export function computeProgress(input: {
  startDate: DateOnly;
  endDate: DateOnly;
  today: DateOnly;
  units: ProgressUnit[];
  /**
   * Corte de la línea base: lo planificado hasta este día es "comprometido".
   * Por defecto el inicio; si el plan se armó con la etapa ya en curso, el día en que se creó.
   */
  baselineDate?: DateOnly;
}): ProgressStats {
  const { startDate, endDate, today, units } = input;
  const baselineDate = input.baselineDate ?? startDate;
  const total = units.length;
  const done = units.reduce((sum, unit) => sum + unit.credit, 0);
  const committed = units.filter((unit) => unit.plannedOn === null || unit.plannedOn <= baselineDate).length;

  const totalWorkingDays = Math.max(1, workingDaysBetween(startDate, endDate));
  const elapsedWorkingDays = today < startDate ? 0 : workingDaysBetween(startDate, today < endDate ? today : endDate);
  const expectedPct = Math.min(100, percent(elapsedWorkingDays / totalWorkingDays));
  const actualPct = total > 0 ? percent(done / total) : null;

  let status: PlanStatus;
  if (total === 0) {
    status = 'NO_TICKETS';
  } else if (done >= total) {
    status = 'COMPLETED';
  } else if (today < startDate) {
    status = 'NOT_STARTED';
  } else if (today > endDate) {
    status = 'DELAYED';
  } else if ((actualPct ?? 0) < expectedPct - AT_RISK_GAP) {
    status = 'AT_RISK';
  } else {
    status = 'ON_TRACK';
  }

  let forecastEnd: DateOnly | null = null;
  let slipDays = 0;
  const inProgress = status === 'ON_TRACK' || status === 'AT_RISK' || status === 'DELAYED';
  const workedDays = today < startDate ? 0 : workingDaysBetween(startDate, today);

  if (inProgress && done > 0 && workedDays > 0) {
    const ratePerDay = done / workedDays;
    const remainingDays = Math.ceil((total - done) / ratePerDay);
    forecastEnd = addWorkingDays(today, remainingDays);
    slipDays = forecastEnd > endDate ? workingDaysBetween(addDays(endDate, 1), forecastEnd) : 0;
  } else if (status === 'DELAYED') {
    // Atrasada y sin ritmo medible: al menos lleva los días hábiles desde la fecha fin.
    slipDays = workingDaysBetween(addDays(endDate, 1), today);
  }

  return {
    total,
    done: Math.round(done * 100) / 100,
    committed,
    added: total - committed,
    actualPct,
    expectedPct,
    status,
    forecastEnd,
    slipDays,
  };
}

/**
 * Resumen del proyecto. Asume etapas secuenciales: el mayor desfase de una etapa
 * atrasada o en riesgo empuja la fecha final del proyecto.
 */
export function computeProjectStats(stages: Array<{ endDate: DateOnly; stats: ProgressStats }>): ProjectStats {
  if (stages.length === 0) {
    return { overallPct: null, plannedEnd: null, forecastEnd: null, slipDays: 0 };
  }

  const plannedEnd = stages.reduce((max, stage) => (stage.endDate > max ? stage.endDate : max), stages[0].endDate);
  const slipDays = stages.reduce(
    (max, stage) =>
      stage.stats.status === 'AT_RISK' || stage.stats.status === 'DELAYED' ? Math.max(max, stage.stats.slipDays) : max,
    0,
  );
  const total = stages.reduce((sum, stage) => sum + stage.stats.total, 0);
  const done = stages.reduce((sum, stage) => sum + stage.stats.done, 0);

  return {
    overallPct: total > 0 ? percent(done / total) : null,
    plannedEnd,
    forecastEnd: slipDays > 0 ? addWorkingDays(plannedEnd, slipDays) : plannedEnd,
    slipDays,
  };
}

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria del equipo. */
export function todayIn(timeZone: string, now: Date = new Date()): DateOnly {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
