import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import type { ProjectType } from '../../lib/projects';
import {
  BoxIcon,
  Button,
  Field,
  fieldDescribedBy,
  getAvatarColor,
  GlobeIcon,
  Input,
  MobileIcon,
  Modal,
  StoreIcon,
  Textarea,
} from '../../ui';
import { validateNewProject } from './projectsLogic';
import type { CreateProjectErrors } from './projectsLogic';
import { PROJECT_TYPE_LABELS, PROJECT_TYPE_OPTIONS } from './projectTypes';

export type NewProjectValues = { name: string; projectType: ProjectType; logoUrl: string; description: string };

const TYPE_ICONS: Record<ProjectType, ReactElement> = {
  'Tienda B2B O B2C': <StoreIcon size={20} />,
  'App movil': <MobileIcon size={20} />,
  'App web': <GlobeIcon size={20} />,
  Otro: <BoxIcon size={20} />,
};

type CreateProjectModalProps = {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (values: NewProjectValues) => void;
};

export function CreateProjectModal({ open, creating, onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType | ''>('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<CreateProjectErrors>({});
  const [logoBroken, setLogoBroken] = useState(false);

  const clearError = (field: keyof CreateProjectErrors) =>
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  const close = () => {
    setErrors({});
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateNewProject({ name, projectType, logoUrl, description });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !projectType) {
      return;
    }
    onCreate({ name: name.trim(), projectType, logoUrl: logoUrl.trim(), description: description.trim() });
  };

  const trimmedLogo = logoUrl.trim();
  const showLogo = /^https?:\/\/\S+$/i.test(trimmedLogo) && !logoBroken;

  return (
    <Modal
      open={open}
      title="Nuevo proyecto"
      onClose={close}
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={close}>Cancelar</Button>
          <Button variant="primary" type="submit" form="create-project-form" loading={creating}>
            {creating ? 'Creando…' : 'Crear y abrir'}
          </Button>
        </>
      }
    >
      <form id="create-project-form" className="qp-form" onSubmit={submit} noValidate>
        <Field id="project-name" label="Nombre" error={errors.name}>
          <Input
            id="project-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearError('name');
            }}
            placeholder="Checkout Web"
            maxLength={120}
            invalid={Boolean(errors.name)}
            aria-describedby={fieldDescribedBy('project-name', undefined, errors.name)}
            autoComplete="off"
          />
        </Field>

        <fieldset className="qp-types" aria-describedby={errors.projectType ? 'project-type-error' : undefined}>
          <legend className="q-field__label">Tipo de proyecto</legend>
          <div className="qp-types-grid">
            {PROJECT_TYPE_OPTIONS.map((option) => (
              <label key={option} className={`qp-type${projectType === option ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="project-type"
                  value={option}
                  checked={projectType === option}
                  onChange={() => {
                    setProjectType(option);
                    clearError('projectType');
                  }}
                />
                <span className="qp-type-icon" aria-hidden="true">
                  {TYPE_ICONS[option]}
                </span>
                {PROJECT_TYPE_LABELS[option]}
              </label>
            ))}
          </div>
          {errors.projectType ? (
            <span id="project-type-error" className="q-field__error">
              {errors.projectType}
            </span>
          ) : null}
        </fieldset>

        <Field
          id="project-description"
          label="Descripción"
          optional
          hint="Qué producto se prueba y para quién."
          error={errors.description}
        >
          <Textarea
            id="project-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              clearError('description');
            }}
            rows={3}
            maxLength={1000}
            invalid={Boolean(errors.description)}
            aria-describedby={fieldDescribedBy('project-description', 'x', errors.description)}
          />
        </Field>

        <Field id="project-logo" label="Logo" optional hint="Dirección de una imagen. Si no la pones, usamos la inicial." error={errors.logoUrl}>
          <div className="qp-logo-row">
            {showLogo ? (
              <img className="qp-logo-preview" src={trimmedLogo} alt="" onError={() => setLogoBroken(true)} />
            ) : (
              <span className="qp-logo-preview" style={{ background: getAvatarColor(name.trim() || 'Qualio') }} aria-hidden="true">
                {name.trim().charAt(0).toUpperCase() || 'Q'}
              </span>
            )}
            <Input
              id="project-logo"
              type="url"
              value={logoUrl}
              onChange={(event) => {
                setLogoUrl(event.target.value);
                setLogoBroken(false);
                clearError('logoUrl');
              }}
              placeholder="https://…/logo.png"
              invalid={Boolean(errors.logoUrl)}
              aria-describedby={fieldDescribedBy('project-logo', 'x', errors.logoUrl)}
            />
          </div>
        </Field>
      </form>
    </Modal>
  );
}
