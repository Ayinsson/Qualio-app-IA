import type { PlanningView, PlanStage, PlanStatus } from '../../../lib/planning';
import { addsScopeToday, PLAN_STATUS } from './planningLogic';

/** Margen de brecha para "En riesgo" (mismo valor que el API). */
const AT_RISK_GAP = 15;

export type StageImpact = {
  stage: PlanStage;
  groupName: string;
  /** Hoy ya pasó el corte de la línea base: se registrará como alcance agregado. */
  addsScope: boolean;
  before: { pct: number; status: PlanStatus };
  after: { pct: number; status: PlanStatus };
};

export type StageOption = { stageLabel: string; groups: Array<{ id: string; name: string }> };

/** Opciones para el selector "Etapa": una por etapa con sus macroactividades. */
export function stageOptions(plan: PlanningView | undefined): StageOption[] {
  return (plan?.stages ?? [])
    .filter((stage) => stage.groups.length > 0)
    .map((stage) => ({
      stageLabel: stage.code ? `${stage.code} · ${stage.name}` : stage.name,
      groups: stage.groups.map((group) => ({ id: group.id, name: group.name })),
    }));
}

function statusFor(stage: PlanStage, today: string, actualPct: number, total: number): PlanStatus {
  if (total === 0) {
    return 'NO_TICKETS';
  }
  if (actualPct >= 100) {
    return 'COMPLETED';
  }
  if (today < stage.startDate) {
    return 'NOT_STARTED';
  }
  if (today > stage.endDate) {
    return 'DELAYED';
  }
  return actualPct < stage.stats.expectedPct - AT_RISK_GAP ? 'AT_RISK' : 'ON_TRACK';
}

/**
 * Vista previa de sumar un ticket abierto a una macroactividad. Devuelve null si no aplica
 * (sin plan, macroactividad desconocida o el ticket ya estaba en esa misma etapa).
 */
export function previewStageImpact(
  plan: PlanningView | undefined,
  groupId: string | null | undefined,
  currentGroupId: string | null = null,
): StageImpact | null {
  if (!plan || !groupId) {
    return null;
  }
  const stage = plan.stages.find((candidate) => candidate.groups.some((group) => group.id === groupId));
  if (!stage) {
    return null;
  }
  if (currentGroupId && stage.groups.some((group) => group.id === currentGroupId)) {
    return null;
  }

  const { done, total } = stage.stats;
  const afterTotal = total + 1;
  const afterPct = Math.round((done / afterTotal) * 100);
  return {
    stage,
    groupName: stage.groups.find((group) => group.id === groupId)?.name ?? '',
    addsScope: addsScopeToday(stage, plan.today),
    before: { pct: stage.stats.actualPct ?? 0, status: stage.stats.status },
    after: { pct: afterPct, status: statusFor(stage, plan.today, afterPct, afterTotal) },
  };
}

/** "La etapa I1 pasaría de 44% a 40% (esperado 71%) → En riesgo". */
export function describeImpact(impact: StageImpact): string {
  const name = impact.stage.code ?? impact.stage.name;
  const expected = impact.stage.stats.status === 'NOT_STARTED' ? '' : ` (esperado ${impact.stage.stats.expectedPct}%)`;
  const status = PLAN_STATUS[impact.after.status].label;
  const changed = impact.after.status !== impact.before.status ? ` → ${status}` : ` · ${status}`;
  return `La etapa ${name} pasaría de ${impact.before.pct}% a ${impact.after.pct}%${expected}${changed}`;
}
