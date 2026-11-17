import { normalizeSearch } from '../../layout/navigation';
import type { Project } from '../../lib/projects';

export function filterProjects(projects: Project[], query: string): Project[] {
  const needle = normalizeSearch(query);
  if (!needle) {
    return projects;
  }
  return projects.filter((project) => normalizeSearch(project.name).includes(needle));
}

export type CreateProjectErrors = Partial<Record<'name' | 'projectType' | 'logoUrl' | 'description', string>>;

export function validateNewProject(values: {
  name: string;
  projectType: string;
  logoUrl: string;
  description: string;
}): CreateProjectErrors {
  const errors: CreateProjectErrors = {};
  const name = values.name.trim();

  if (name.length < 3) {
    errors.name = 'El nombre necesita al menos 3 caracteres.';
  } else if (name.length > 120) {
    errors.name = 'El nombre puede tener hasta 120 caracteres.';
  }

  if (!values.projectType) {
    errors.projectType = 'Elige qué tipo de producto vas a probar.';
  }

  const logo = values.logoUrl.trim();
  if (logo && !/^https?:\/\/\S+$/i.test(logo)) {
    errors.logoUrl = 'Pega una dirección que empiece por https://';
  }

  if (values.description.trim().length > 1000) {
    errors.description = 'La descripción puede tener hasta 1000 caracteres.';
  }

  return errors;
}
