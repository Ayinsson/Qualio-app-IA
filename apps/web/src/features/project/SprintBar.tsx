import { useState } from 'react';

import type { Sprint } from '../../lib/sprints';
import { Button, Modal } from '../../ui';
import type { ProjectProgress } from '../projects/progress';

type SprintBarProps = {
  sprint: Sprint | null;
  progress: ProjectProgress | null;
  /** Tickets en Próximo Sprint (sin filtros). */
  nextSprintCount: number;
  /** Tickets del sprint activo que todavía no terminan. */
  unfinishedCount: number;
  isOwner: boolean;
  starting: boolean;
  onStart: () => void;
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function SprintBar({ sprint, progress, nextSprintCount, unfinishedCount, isOwner, starting, onStart }: SprintBarProps) {
  const [confirming, setConfirming] = useState(false);
  const nextNumber = sprint ? sprint.sequence + 1 : 1;
  const nextName = `Sprint ${nextNumber}`;
  const actionLabel = sprint ? `Cerrar ${sprint.name} e iniciar ${nextName}` : `Iniciar ${nextName}`;
  const canStart = nextSprintCount > 0;
  const since = sprint
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(sprint.startedAt))
    : null;
  const percent = progress?.percent ?? 0;

  return (
    <section className="qx-sprint" aria-label="Sprint">
      <div className="qx-sprint-name">
        <strong>{sprint ? sprint.name : 'Sin sprint activo'}</strong>
        <span>{sprint ? `activo desde el ${since}` : 'Planifica en Próximo Sprint y luego inícialo'}</span>
      </div>

      {sprint && progress ? (
        <div className="qx-sprint-progress">
          <span>
            {progress.sprintDone} de {plural(progress.sprintTotal, 'ticket terminado', 'tickets terminados')}
          </span>
          <span
            className="qx-bar"
            role="progressbar"
            aria-label={`Avance de ${sprint.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={{ width: `${percent}%` }} />
          </span>
        </div>
      ) : (
        <div className="qx-sprint-progress" />
      )}

      {isOwner ? (
        canStart ? (
          <Button variant={sprint ? 'secondary' : 'primary'} size="sm" onClick={() => setConfirming(true)} loading={starting}>
            {actionLabel}
          </Button>
        ) : (
          <p className="qx-sprint-hint">Mueve tickets a Próximo Sprint para iniciar {nextName}.</p>
        )
      ) : null}

      <Modal
        open={confirming}
        title={sprint ? `¿Cerrar ${sprint.name} e iniciar ${nextName}?` : `¿Iniciar ${nextName}?`}
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button onClick={() => setConfirming(false)}>Cancelar</Button>
            <Button
              variant="primary"
              loading={starting}
              onClick={() => {
                setConfirming(false);
                onStart();
              }}
            >
              Iniciar {nextName}
            </Button>
          </>
        }
      >
        <div className="qx-confirm">
          <p>Al iniciar {nextName}:</p>
          <ul>
            {sprint && unfinishedCount > 0 ? (
              <li>
                <strong>{plural(unfinishedCount, 'ticket sin terminar', 'tickets sin terminar')}</strong> de {sprint.name}{' '}
                {unfinishedCount === 1 ? 'pasa' : 'pasan'} a {nextName}.
              </li>
            ) : null}
            <li>
              <strong>{plural(nextSprintCount, 'ticket', 'tickets')}</strong> de Próximo Sprint{' '}
              {nextSprintCount === 1 ? 'entra' : 'entran'} al tablero.
            </li>
            {sprint ? <li>{sprint.name} queda cerrado y sus tickets terminados quedan en Completado.</li> : null}
          </ul>
        </div>
      </Modal>
    </section>
  );
}
