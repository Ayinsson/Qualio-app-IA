import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Avatar, Button, Field, fieldDescribedBy, Input, Modal } from '../../ui';
import { AVATAR_MAX_MB, AVATAR_TYPES, passwordProgress, validateAvatar, validateName, validatePassword } from './profileLogic';
import type { PasswordErrors, PasswordValues } from './profileLogic';
import './profile.css';

type ProfileModalProps = {
  user: { name: string; email: string; avatarUrl: string | null };
  /** Cada acción rechaza la promesa si falla; quien llama muestra el aviso. */
  onSaveName: (name: string) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onUploadPhoto: (file: File) => Promise<void>;
  onRemovePhoto: () => Promise<void>;
  onClose: () => void;
};

const EMPTY_PASSWORD: PasswordValues = { current: '', next: '', confirm: '' };

export function ProfileModal({ user, onSaveName, onChangePassword, onUploadPhoto, onRemovePhoto, onClose }: ProfileModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [savedName, setSavedName] = useState(user.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [savingName, setSavingName] = useState(false);

  const [photoBusy, setPhotoBusy] = useState<'upload' | 'remove' | null>(null);
  const [photoError, setPhotoError] = useState<string | undefined>();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState<PasswordValues>(EMPTY_PASSWORD);
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [savingPassword, setSavingPassword] = useState(false);

  const [confirmingClose, setConfirmingClose] = useState(false);

  const nameDirty = name.trim() !== savedName.trim();
  const passwordDirty = passwordOpen && Boolean(password.current || password.next || password.confirm);
  const dirty = nameDirty || passwordDirty;
  const progress = passwordProgress(password.next);

  const requestClose = () => {
    if (dirty) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  };

  const saveName = async (event?: FormEvent) => {
    event?.preventDefault();
    const error = validateName(name);
    if (error) {
      setNameError(error);
      return;
    }
    setSavingName(true);
    try {
      await onSaveName(name.trim());
      setName(name.trim());
      setSavedName(name.trim());
    } catch {
      // El aviso lo muestra quien llama.
    } finally {
      setSavingName(false);
    }
  };

  const pickPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const error = validateAvatar(file);
    setPhotoError(error);
    if (error) {
      return;
    }
    setPhotoBusy('upload');
    try {
      await onUploadPhoto(file);
    } catch {
      // El aviso lo muestra quien llama.
    } finally {
      setPhotoBusy(null);
    }
  };

  const removePhoto = async () => {
    setPhotoError(undefined);
    setPhotoBusy('remove');
    try {
      await onRemovePhoto();
    } catch {
      // El aviso lo muestra quien llama.
    } finally {
      setPhotoBusy(null);
    }
  };

  const closePassword = () => {
    setPasswordOpen(false);
    setPassword(EMPTY_PASSWORD);
    setPasswordErrors({});
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    const errors = validatePassword(password);
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setSavingPassword(true);
    try {
      await onChangePassword(password.current, password.next);
      closePassword();
    } catch {
      // El aviso lo muestra quien llama.
    } finally {
      setSavingPassword(false);
    }
  };

  const setPasswordField = (field: keyof PasswordValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setPassword((current) => ({ ...current, [field]: event.target.value }));
    setPasswordErrors((current) => ({ ...current, [field]: undefined }));
  };

  const displayName = savedName.trim() || user.email;

  return (
    <Modal
      open
      title="Tu perfil"
      onClose={requestClose}
      closeOnBackdrop={!dirty}
      footer={
        confirmingClose ? (
          <div className="qpf-confirm" role="alert">
            <span>Tienes cambios sin guardar.</span>
            <Button size="sm" onClick={() => setConfirmingClose(false)}>
              Seguir editando
            </Button>
            <Button size="sm" variant="danger" onClick={onClose}>
              Descartar
            </Button>
          </div>
        ) : (
          <>
            <Button onClick={requestClose}>Cerrar</Button>
            <Button variant="primary" disabled={!nameDirty} loading={savingName} onClick={() => saveName()}>
              {nameDirty ? 'Guardar cambios' : 'Sin cambios'}
            </Button>
          </>
        )
      }
    >
      <div className="qpf">
        <section className="qpf-identity" aria-label="Foto de perfil">
          <span className="qpf-photo">
            <Avatar name={displayName} src={user.avatarUrl} size={64} />
            {photoBusy ? <span className="qpf-photo-busy" aria-hidden="true" /> : null}
          </span>
          <div className="qpf-identity-text">
            <strong className="qpf-name">{displayName}</strong>
            <span className="qpf-email">{user.email}</span>
            <div className="qpf-photo-actions">
              <Button size="sm" loading={photoBusy === 'upload'} disabled={photoBusy !== null} onClick={() => fileRef.current?.click()}>
                {user.avatarUrl ? 'Cambiar foto' : 'Subir foto'}
              </Button>
              {user.avatarUrl ? (
                <Button size="sm" variant="ghost" loading={photoBusy === 'remove'} disabled={photoBusy !== null} onClick={removePhoto}>
                  Quitar
                </Button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept={AVATAR_TYPES.join(',')}
                onChange={pickPhoto}
                hidden
                aria-label="Elegir foto de perfil"
              />
            </div>
            {photoError ? (
              <span className="q-field__error" role="alert">
                {photoError}
              </span>
            ) : (
              <span className="q-field__hint">JPG, PNG o GIF de hasta {AVATAR_MAX_MB} MB. Se guarda al elegirla.</span>
            )}
          </div>
        </section>

        <form className="qpf-section" onSubmit={saveName} noValidate>
          <Field
            id="profile-name"
            label="Nombre visible"
            hint="Así te ven tus compañeros en tareas, bugs e invitaciones."
            error={nameError}
          >
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(undefined);
              }}
              autoComplete="name"
              maxLength={80}
              invalid={Boolean(nameError)}
              aria-describedby={fieldDescribedBy('profile-name', 'hint', nameError)}
            />
          </Field>
          <div className="q-field">
            <span className="q-field__label" id="profile-email-label">
              Correo
            </span>
            <span className="qpf-readonly" aria-labelledby="profile-email-label" aria-describedby="profile-email-hint">
              <LockGlyph />
              {user.email}
            </span>
            <span id="profile-email-hint" className="q-field__hint">
              Identifica tu cuenta, por eso no se puede cambiar.
            </span>
          </div>
        </form>

        <section className="qpf-section" aria-labelledby="profile-password-title">
          <div className="qpf-password-head">
            <div>
              <h3 id="profile-password-title" className="qpf-title">
                Contraseña
              </h3>
              <p className="qpf-muted">Cámbiala cuando quieras.</p>
            </div>
            <Button
              size="sm"
              aria-expanded={passwordOpen}
              aria-controls="profile-password-form"
              onClick={() => (passwordOpen ? closePassword() : setPasswordOpen(true))}
            >
              {passwordOpen ? 'Ocultar' : 'Cambiar'}
            </Button>
          </div>

          {passwordOpen ? (
            <form id="profile-password-form" className="qpf-password" onSubmit={savePassword} noValidate>
              <Field id="pw-current" label="Contraseña actual" error={passwordErrors.current}>
                <Input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={password.current}
                  onChange={setPasswordField('current')}
                  invalid={Boolean(passwordErrors.current)}
                  aria-describedby={fieldDescribedBy('pw-current', undefined, passwordErrors.current)}
                />
              </Field>
              <Field id="pw-next" label="Nueva contraseña" error={passwordErrors.next}>
                <Input
                  id="pw-next"
                  type="password"
                  autoComplete="new-password"
                  value={password.next}
                  onChange={setPasswordField('next')}
                  invalid={Boolean(passwordErrors.next)}
                  aria-describedby={fieldDescribedBy('pw-next', 'hint', passwordErrors.next)}
                />
                <span className="qpf-meter" aria-hidden="true">
                  <span style={{ width: `${progress.percent}%` }} className={progress.percent === 100 ? 'is-ok' : ''} />
                </span>
                {passwordErrors.next ? null : (
                  <span id="pw-next-hint" className="q-field__hint">
                    {progress.hint}
                  </span>
                )}
              </Field>
              <Field id="pw-confirm" label="Repite la nueva" error={passwordErrors.confirm}>
                <Input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={password.confirm}
                  onChange={setPasswordField('confirm')}
                  invalid={Boolean(passwordErrors.confirm)}
                  aria-describedby={fieldDescribedBy('pw-confirm', undefined, passwordErrors.confirm)}
                />
              </Field>
              <div className="qpf-password-actions">
                <Button size="sm" onClick={closePassword}>
                  Cancelar
                </Button>
                <Button size="sm" variant="primary" type="submit" loading={savingPassword}>
                  Actualizar contraseña
                </Button>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </Modal>
  );
}

function LockGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
