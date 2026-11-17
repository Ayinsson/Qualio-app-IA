import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

type FieldProps = {
  /** Id del control; se usa para enlazar la etiqueta, la ayuda y el error. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
};

export function Field({ id, label, hint, error, optional = false, children }: FieldProps) {
  return (
    <div className="q-field">
      <label className="q-field__label" htmlFor={id}>
        {label}
        {optional ? <span className="q-field__optional">(opcional)</span> : null}
      </label>
      {children}
      {hint ? (
        <span id={`${id}-hint`} className="q-field__hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="q-field__error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

type ControlExtras = { invalid?: boolean };

// React 19 recibe `ref` como prop, así que {...register('campo')} de react-hook-form funciona directo.
export function Input({
  invalid,
  className,
  ref,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & ControlExtras & { ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      className={['q-input', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({
  invalid,
  className,
  ref,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & ControlExtras & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <select
      ref={ref}
      className={['q-select', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ref,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & ControlExtras & { ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      ref={ref}
      className={['q-textarea', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}
