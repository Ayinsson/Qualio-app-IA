import { resolveStatus } from './logic';
import type { StatusTone } from './logic';

type StatusBadgeProps =
  | { tone: StatusTone; label: string; status?: never; itemType?: never }
  | { status: string; itemType?: 'task' | 'bug'; tone?: never; label?: never };

export function StatusBadge(props: StatusBadgeProps) {
  const preset =
    props.status !== undefined
      ? resolveStatus(props.status, props.itemType)
      : { tone: props.tone, label: props.label };

  return <span className={`q-status q-status--${preset.tone}`}>{preset.label}</span>;
}
