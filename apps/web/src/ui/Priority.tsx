import { resolvePriority } from './logic';
import type { PriorityValue } from './logic';

/** Prioridad como barras de señal: sin color, para no competir con el estado. */
export function Priority({ value, showLabel = true }: { value: PriorityValue | string; showLabel?: boolean }) {
  const { level, label } = resolvePriority(value);

  return (
    <span className="q-priority" title={`Prioridad ${label.toLowerCase()}`}>
      <span className="q-priority__bars" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span key={bar} className={bar <= level ? 'is-on' : undefined} />
        ))}
      </span>
      {showLabel ? label : <span className="sr-only">Prioridad {label.toLowerCase()}</span>}
    </span>
  );
}
