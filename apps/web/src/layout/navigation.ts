// Lógica de navegación de la estructura: ruta "dónde estás" y destinos del buscador rápido.

export type Crumb = { label: string; to?: string };

export type NavProject = { id: string; name: string; logoUrl: string | null };

export type Destination = { id: string; label: string; to: string; group: 'Proyectos' | 'Ir a' };

const PROJECT_DETAIL = /^\/app\/proyectos\/([A-Za-z0-9-]+)$/;

export function getBreadcrumb(pathname: string, projects: NavProject[]): Crumb[] {
  if (pathname.startsWith('/app/dashboard')) {
    return [{ label: 'Inicio' }];
  }

  if (pathname.startsWith('/app/proyectos/nuevo')) {
    return [{ label: 'Proyectos', to: '/app/proyectos/activos' }, { label: 'Nuevo proyecto' }];
  }

  if (pathname.startsWith('/app/proyectos/activos')) {
    return [{ label: 'Proyectos' }, { label: 'Todos los proyectos' }];
  }

  if (pathname.startsWith('/app/proyectos/archivados')) {
    return [{ label: 'Proyectos', to: '/app/proyectos/activos' }, { label: 'Archivados' }];
  }

  const projectMatch = PROJECT_DETAIL.exec(pathname);
  if (projectMatch) {
    const project = projects.find((item) => item.id === projectMatch[1]);
    return [{ label: 'Proyectos', to: '/app/proyectos/activos' }, { label: project?.name ?? 'Proyecto' }];
  }

  if (pathname.startsWith('/app/colaborar/invitaciones')) {
    return [{ label: 'Colaboración' }, { label: 'Invitaciones' }];
  }

  if (pathname.startsWith('/app/colaborar/compartidos')) {
    return [{ label: 'Colaboración' }, { label: 'Compartidos' }];
  }

  if (pathname.startsWith('/app/sistema')) {
    return [{ label: 'Sistema base' }];
  }

  return [{ label: 'Inicio' }];
}

const SECTIONS: Destination[] = [
  { id: 'inicio', label: 'Inicio', to: '/app/dashboard', group: 'Ir a' },
  { id: 'nuevo', label: 'Nuevo proyecto', to: '/app/proyectos/nuevo', group: 'Ir a' },
  { id: 'activos', label: 'Todos los proyectos', to: '/app/proyectos/activos', group: 'Ir a' },
  { id: 'archivados', label: 'Proyectos archivados', to: '/app/proyectos/archivados', group: 'Ir a' },
  { id: 'invitaciones', label: 'Invitaciones', to: '/app/colaborar/invitaciones', group: 'Ir a' },
  { id: 'compartidos', label: 'Compartidos', to: '/app/colaborar/compartidos', group: 'Ir a' },
];

/** Quita tildes y mayúsculas para que "operacion" encuentre "Operación". */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function searchDestinations(query: string, projects: NavProject[]): Destination[] {
  const needle = normalizeSearch(query);
  const projectDestinations: Destination[] = projects.map((project) => ({
    id: `project-${project.id}`,
    label: project.name,
    to: `/app/proyectos/${project.id}`,
    group: 'Proyectos',
  }));
  const all = [...projectDestinations, ...SECTIONS];

  if (!needle) {
    return [...projectDestinations.slice(0, 5), ...SECTIONS];
  }

  return all.filter((item) => normalizeSearch(item.label).includes(needle));
}
