import { useState } from 'react';
import type { FormEvent } from 'react';

import type { ProjectPendingInvitation } from '../../lib/invitations';
import type { ProjectMember } from '../../lib/project-members';
import { Avatar, Button, fieldDescribedBy, Input, MailIcon, Modal } from '../../ui';
import { formatRelative } from './collabLogic';
import './collab.css';

const ROLE_LABEL: Record<ProjectMember['role'], string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  MEMBER: 'Miembro',
};

type MembersModalProps = {
  projectName: string;
  members: ProjectMember[];
  pendingInvitations: ProjectPendingInvitation[];
  loadingPending: boolean;
  isOwner: boolean;
  currentUserId: string | null;
  inviting: boolean;
  removingUserId: string | null;
  cancellingInvitationId: string | null;
  onInvite: (email: string) => Promise<void>;
  onRemove: (userId: string) => void;
  onCancelInvitation: (invitationId: string) => void;
  onClose: () => void;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MembersModal({
  projectName,
  members,
  pendingInvitations,
  loadingPending,
  isOwner,
  currentUserId,
  inviting,
  removingUserId,
  cancellingInvitationId,
  onInvite,
  onRemove,
  onCancelInvitation,
  onClose,
}: MembersModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);
  const owner = members.find((member) => member.role === 'OWNER');
  const ownerName = owner ? owner.name?.trim() || owner.email : 'el dueño';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!EMAIL.test(normalized)) {
      setError('Escribe un correo válido, como nombre@empresa.com');
      return;
    }
    if (members.some((member) => member.email.toLowerCase() === normalized)) {
      setError('Esa persona ya participa en el proyecto.');
      return;
    }
    if (pendingInvitations.some((invitation) => invitation.invitedEmail.toLowerCase() === normalized)) {
      setError('Ya hay una invitación pendiente para ese correo.');
      return;
    }
    try {
      await onInvite(normalized);
      setEmail('');
    } catch {
      // El aviso de error lo muestra quien llama.
    }
  };

  return (
    <Modal open title="Participantes" onClose={onClose}>
      <div className="qc6">
        {isOwner ? (
          <form className="qc6-invite" onSubmit={submit} noValidate>
            <label className="q-field__label" htmlFor="invite-email">
              Invitar por correo
            </label>
            <div className="qc6-invite-row">
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(undefined);
                }}
                placeholder="nombre@empresa.com"
                autoComplete="off"
                invalid={Boolean(error)}
                aria-describedby={fieldDescribedBy('invite-email', 'x', error)}
              />
              <Button variant="primary" type="submit" loading={inviting}>
                Invitar
              </Button>
            </div>
            {error ? (
              <span id="invite-email-error" className="q-field__error">
                {error}
              </span>
            ) : null}
            <span id="invite-email-hint" className="q-field__hint">
              Le llegará una invitación en Qualio para unirse a {projectName}.
            </span>
          </form>
        ) : (
          <p className="qc6-note">Solo {ownerName} puede invitar o quitar participantes en este proyecto.</p>
        )}

        <section aria-labelledby="members-title">
          <h3 id="members-title" className="qc6-heading">
            En el proyecto · {members.length}
          </h3>
          <ul className="qc6-list">
            {members.map((member) => {
              const name = member.name?.trim() || member.email;
              const isYou = member.userId === currentUserId;
              const canRemove = isOwner && member.role !== 'OWNER';
              return (
                <li key={member.userId} className="qc6-person">
                  <Avatar name={name} src={member.avatarUrl} size={32} />
                  <span className="qc6-person-text">
                    <span className="qc6-person-name">
                      {name}
                      {isYou ? <span className="qc6-you">Tú</span> : null}
                    </span>
                    <span className="qc6-person-meta">{member.email}</span>
                  </span>
                  <span className="qc6-role">{ROLE_LABEL[member.role]}</span>
                  {canRemove && confirmingRemoval !== member.userId ? (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingRemoval(member.userId)}>
                      Quitar
                    </Button>
                  ) : null}
                  {confirmingRemoval === member.userId ? (
                    <div className="qc6-confirm" role="alert">
                      <span>¿Quitar a {name}? Ya no verá el proyecto.</span>
                      <Button size="sm" onClick={() => setConfirmingRemoval(null)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={removingUserId === member.userId}
                        onClick={() => {
                          onRemove(member.userId);
                          setConfirmingRemoval(null);
                        }}
                      >
                        Quitar
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        {isOwner ? (
          <section aria-labelledby="pending-title">
            <h3 id="pending-title" className="qc6-heading">
              Invitaciones pendientes · {pendingInvitations.length}
            </h3>
            {loadingPending ? <p className="qc6-note">Cargando invitaciones…</p> : null}
            {!loadingPending && pendingInvitations.length === 0 ? (
              <p className="qc6-note">No hay invitaciones esperando respuesta.</p>
            ) : null}
            <ul className="qc6-list">
              {pendingInvitations.map((invitation) => (
                <li key={invitation.id} className="qc6-person">
                  <span className="qc6-envelope" aria-hidden="true">
                    <MailIcon size={16} />
                  </span>
                  <span className="qc6-person-text">
                    <span className="qc6-person-name">{invitation.invitedEmail}</span>
                    <span className="qc6-person-meta">Enviada {formatRelative(invitation.createdAt)}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={cancellingInvitationId === invitation.id}
                    onClick={() => onCancelInvitation(invitation.id)}
                  >
                    Cancelar invitación
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
