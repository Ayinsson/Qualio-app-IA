import {
  addWorkingDays,
  computeProgress,
  computeProjectStats,
  ticketCredit,
  todayIn,
  workingDaysBetween,
  type ProgressUnit,
} from './planning-stats';

// Noviembre 2026: el lunes es 2, 9, 16, 23 y 30.
const units = (credits: number[], plannedOn: string | null = null): ProgressUnit[] =>
  credits.map((credit) => ({ credit, plannedOn }));

describe('working days', () => {
  it('counts Monday to Friday, both ends included', () => {
    expect(workingDaysBetween('2026-11-02', '2026-11-06')).toBe(5);
    expect(workingDaysBetween('2026-11-02', '2026-11-08')).toBe(5);
    expect(workingDaysBetween('2026-11-02', '2026-11-13')).toBe(10);
    expect(workingDaysBetween('2026-11-07', '2026-11-08')).toBe(0);
    expect(workingDaysBetween('2026-11-10', '2026-11-02')).toBe(0);
  });

  it('adds working days skipping weekends', () => {
    expect(addWorkingDays('2026-11-06', 1)).toBe('2026-11-09');
    expect(addWorkingDays('2026-11-02', 5)).toBe('2026-11-09');
    expect(addWorkingDays('2026-11-02', 0)).toBe('2026-11-02');
  });
});

describe('ticketCredit', () => {
  it('counts closed tickets as 1 and open ones by their closed subtasks', () => {
    expect(ticketCredit(true, 0, 3)).toBe(1);
    expect(ticketCredit(false, 2, 4)).toBe(0.5);
    expect(ticketCredit(false, 0, 0)).toBe(0);
  });
});

describe('computeProgress', () => {
  // Etapa del lunes 2 al viernes 13 de noviembre: 10 días hábiles.
  const stage = { startDate: '2026-11-02', endDate: '2026-11-13' };

  it('marks a stage at risk when real progress is 15+ points behind the expected one', () => {
    // Martes 10: 7 de 10 días hábiles transcurridos -> esperado 70%.
    const stats = computeProgress({ ...stage, today: '2026-11-10', units: units([1, 1, 1, 1, 0, 0, 0, 0, 0, 0]) });

    expect(stats.expectedPct).toBe(70);
    expect(stats.actualPct).toBe(40);
    expect(stats.status).toBe('AT_RISK');
    // Ritmo: 4 tickets en 7 días -> faltan 6 -> 11 días hábiles más desde el 10-nov.
    expect(stats.forecastEnd).toBe('2026-11-25');
    expect(stats.slipDays).toBe(8);
  });

  it('keeps it on track within the 15 point margin', () => {
    const stats = computeProgress({ ...stage, today: '2026-11-06', units: units([1, 1, 1, 1, 0, 0, 0, 0, 0, 0]) });
    expect(stats.expectedPct).toBe(50);
    expect(stats.status).toBe('ON_TRACK');
  });

  it('uses partial credit from subtasks', () => {
    const stats = computeProgress({ ...stage, today: '2026-11-06', units: units([1, 1, 1, 1, 0.5, 0, 0, 0, 0, 0]) });
    expect(stats.done).toBe(4.5);
    expect(stats.actualPct).toBe(45);
  });

  it('reports not started, completed, delayed and empty stages', () => {
    expect(computeProgress({ ...stage, today: '2026-10-30', units: units([0, 0]) }).status).toBe('NOT_STARTED');
    expect(computeProgress({ ...stage, today: '2026-11-20', units: units([1, 1]) }).status).toBe('COMPLETED');
    expect(computeProgress({ ...stage, today: '2026-11-05', units: [] }).status).toBe('NO_TICKETS');

    const late = computeProgress({ ...stage, today: '2026-11-18', units: units([0, 0]) });
    expect(late.status).toBe('DELAYED');
    expect(late.forecastEnd).toBeNull();
    expect(late.slipDays).toBe(3);
  });

  it('separates committed scope from work added after the stage started', () => {
    const stats = computeProgress({
      ...stage,
      today: '2026-11-06',
      units: [...units([1, 0, 0], '2026-10-28'), ...units([0], null), ...units([0, 0], '2026-11-04')],
    });
    expect(stats.committed).toBe(4);
    expect(stats.added).toBe(2);
  });
});

describe('computeProjectStats', () => {
  it('pushes the project end by the largest slip of a stage at risk or delayed', () => {
    const onTrack = computeProgress({ startDate: '2026-11-02', endDate: '2026-11-13', today: '2026-11-06', units: units([1, 1, 1, 0, 0]) });
    const atRisk = computeProgress({ startDate: '2026-11-02', endDate: '2026-11-13', today: '2026-11-10', units: units([1, 1, 1, 1, 0, 0, 0, 0, 0, 0]) });

    const project = computeProjectStats([
      { endDate: '2026-11-13', stats: atRisk },
      { endDate: '2026-12-18', stats: onTrack },
    ]);

    expect(project.plannedEnd).toBe('2026-12-18');
    expect(project.slipDays).toBe(8);
    expect(project.forecastEnd).toBe('2026-12-30');
    expect(project.overallPct).toBe(47);
  });

  it('has no dates when the project has no stages', () => {
    expect(computeProjectStats([])).toEqual({ overallPct: null, plannedEnd: null, forecastEnd: null, slipDays: 0 });
  });
});

describe('todayIn', () => {
  it('resolves the date in the team time zone', () => {
    // 03:00 UTC del 18-nov todavía es 17-nov en Bogotá (UTC-5).
    expect(todayIn('America/Bogota', new Date('2026-11-18T03:00:00Z'))).toBe('2026-11-17');
  });
});
