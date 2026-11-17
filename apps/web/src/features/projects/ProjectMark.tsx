import type { Project } from '../../lib/projects';
import { getAvatarColor } from '../../ui';
import './projects.css';

/** Logo del proyecto o, si no tiene, su inicial sobre un color estable. */
export function ProjectMark({ project, size = 32 }: { project: Pick<Project, 'name' | 'logoUrl'>; size?: number }) {
  const style = { width: size, height: size };
  if (project.logoUrl) {
    return <img className="qp-mark" src={project.logoUrl} alt="" style={style} />;
  }
  return (
    <span className="qp-mark" style={{ ...style, background: getAvatarColor(project.name) }} aria-hidden="true">
      {project.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
