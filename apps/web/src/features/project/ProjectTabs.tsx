import type { ProjectTabId } from './types';

type ProjectTabsProps = {
  active: ProjectTabId;
  counts: Partial<Record<ProjectTabId, number>>;
  onChange: (tab: ProjectTabId) => void;
};

const TABS: Array<{ id: ProjectTabId; label: string }> = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'board', label: 'Tablero' },
  { id: 'done', label: 'Completado' },
  { id: 'planning', label: 'Planning' },
  { id: 'reports', label: 'Reportes' },
];

export function ProjectTabs({ active, counts, onChange }: ProjectTabsProps) {
  return (
    <div className="qx-tabs" role="tablist" aria-label="Secciones del proyecto">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`project-tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls="project-tab-panel"
          className="qx-tab"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {counts[tab.id] !== undefined ? <span className="qx-tab-count">{counts[tab.id]}</span> : null}
        </button>
      ))}
    </div>
  );
}
