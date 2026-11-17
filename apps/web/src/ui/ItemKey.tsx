import { BugIcon, TaskIcon } from './icons';

/** Clave de una tarea o bug (TSK-12, BUG-7) con su ícono de tipo. */
export function ItemKey({ itemType, value }: { itemType: 'task' | 'bug'; value: string }) {
  return (
    <span className={`q-key q-key--${itemType}`}>
      {itemType === 'bug' ? <BugIcon size={14} /> : <TaskIcon size={14} />}
      <span className="sr-only">{itemType === 'bug' ? 'Bug' : 'Tarea'}</span>
      {value}
    </span>
  );
}
