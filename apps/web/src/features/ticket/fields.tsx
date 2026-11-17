import { useId, useRef, useState } from 'react';
import type { DragEvent } from 'react';

import { CloseIcon, Input } from '../../ui';
import { ATTACHMENTS_ACCEPT, ENVIRONMENTS } from './types';
import type { Priority } from './types';

const PRIORITIES: Array<{ value: Priority; label: string; level: number }> = [
  { value: 'HIGH', label: 'Alta', level: 3 },
  { value: 'MEDIUM', label: 'Media', level: 2 },
  { value: 'LOW', label: 'Baja', level: 1 },
];

/** Prioridad como tres opciones de un toque (radio), con las barras de señal del sistema. */
export function PriorityPicker({ value, onChange, label = 'Prioridad' }: { value: Priority; onChange: (value: Priority) => void; label?: string }) {
  const name = useId();
  return (
    <fieldset className="qt-choice">
      <legend className="q-field__label">{label}</legend>
      <div className="qt-segmented">
        {PRIORITIES.map((option) => (
          <label key={option.value} className={value === option.value ? 'is-selected' : undefined}>
            <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
            <span className="q-priority__bars" aria-hidden="true">
              {[1, 2, 3].map((bar) => (
                <span key={bar} className={bar <= option.level ? 'is-on' : undefined} />
              ))}
            </span>
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Entorno: opciones rápidas más "Otro" con texto libre. */
export function EnvironmentPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const name = useId();
  const isPreset = ENVIRONMENTS.includes(value);
  const [custom, setCustom] = useState(!isPreset && value !== '');
  const otherSelected = custom || (!isPreset && value !== '');

  return (
    <fieldset className="qt-choice">
      <legend className="q-field__label">
        Entorno <span className="q-field__optional">(opcional)</span>
      </legend>
      <div className="qt-chips">
        {ENVIRONMENTS.map((option) => (
          <label key={option} className={!otherSelected && value === option ? 'is-selected' : undefined}>
            <input
              type="radio"
              name={name}
              checked={!otherSelected && value === option}
              onChange={() => {
                setCustom(false);
                onChange(option);
              }}
            />
            {option}
          </label>
        ))}
        <label className={otherSelected ? 'is-selected' : undefined}>
          <input
            type="radio"
            name={name}
            checked={otherSelected}
            onChange={() => {
              setCustom(true);
              onChange('');
            }}
          />
          Otro
        </label>
      </div>
      {otherSelected ? (
        <Input
          aria-label="Otro entorno"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Por ejemplo, UAT o Preproducción"
          maxLength={120}
        />
      ) : null}
    </fieldset>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Zona para soltar o elegir archivos, con lista y opción de quitar cada uno. */
export function FileDrop({ files, onChange, label }: { files: File[]; onChange: (files: File[]) => void; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const inputId = useId();

  const add = (incoming: FileList | null) => {
    if (!incoming) {
      return;
    }
    const known = new Set(files.map((file) => `${file.name}-${file.size}`));
    onChange([...files, ...Array.from(incoming).filter((file) => !known.has(`${file.name}-${file.size}`))]);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    add(event.dataTransfer.files);
  };

  return (
    <div className="qt-files">
      <span className="q-field__label">
        {label} <span className="q-field__optional">(opcional)</span>
      </span>
      <div
        className={`qt-drop${over ? ' is-over' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        Arrastra capturas, videos o documentos aquí, o{' '}
        <label htmlFor={inputId} className="qt-drop-link">
          elige archivos
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className="sr-only"
          type="file"
          multiple
          accept={ATTACHMENTS_ACCEPT}
          onChange={(event) => {
            add(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {files.length > 0 ? (
        <ul className="qt-file-list">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`}>
              <span className="qt-file-name">{file.name}</span>
              <span className="qt-file-size">{formatSize(file.size)}</span>
              <button
                type="button"
                className="q-icon-btn"
                aria-label={`Quitar ${file.name}`}
                onClick={() => onChange(files.filter((candidate) => candidate !== file))}
              >
                <CloseIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
