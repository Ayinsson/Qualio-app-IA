import type { ProjectType } from '../../lib/projects';

export const PROJECT_TYPE_OPTIONS: ProjectType[] = ['Tienda B2B O B2C', 'App movil', 'App web', 'Otro'];

// Los valores se guardan sin tilde (la API los valida así); solo la etiqueta visible lleva tilde.
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  'Tienda B2B O B2C': 'Tienda B2B o B2C',
  'App movil': 'App móvil',
  'App web': 'App web',
  Otro: 'Otro',
};

export function projectTypeLabel(type: ProjectType | null | undefined): string | null {
  return type ? (PROJECT_TYPE_LABELS[type] ?? type) : null;
}
