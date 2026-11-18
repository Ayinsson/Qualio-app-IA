import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';

import { Button, EmptyState, getInitials, Modal, Priority, resolvePriority, resolveStatus, StatusBadge } from './index';

describe('resolveStatus', () => {
  it('maps task statuses to tone and Spanish label', () => {
    expect(resolveStatus('TODO')).toEqual({ tone: 'neutral', label: 'Pendiente' });
    expect(resolveStatus('IN_PROGRESS')).toEqual({ tone: 'running', label: 'En progreso' });
    expect(resolveStatus('Bloqueado')).toEqual({ tone: 'blocked', label: 'Bloqueado' });
    expect(resolveStatus('DONE')).toEqual({ tone: 'success', label: 'Completado' });
  });

  it('treats an open bug as danger and a closed bug as resolved', () => {
    expect(resolveStatus('OPEN', 'bug')).toEqual({ tone: 'danger', label: 'Bug abierto' });
    expect(resolveStatus('RESOLVED', 'bug')).toEqual({ tone: 'success', label: 'Resuelto' });
  });

  it('falls back to a neutral badge for unknown statuses', () => {
    expect(resolveStatus('ARCHIVED')).toEqual({ tone: 'neutral', label: 'ARCHIVED' });
  });
});

describe('Priority', () => {
  it('normalizes app and API values to three levels', () => {
    expect(resolvePriority('Alta').level).toBe(3);
    expect(resolvePriority('Medio')).toEqual({ level: 2, label: 'Media' });
    expect(resolvePriority('low')).toEqual({ level: 1, label: 'Baja' });
  });

  it('keeps the priority readable when the label is hidden', () => {
    render(<Priority value="Alta" showLabel={false} />);
    expect(screen.getByText('Prioridad alta')).toBeInTheDocument();
  });

  it('tags the bars with the level so each priority gets its own color', () => {
    const { container } = render(
      <>
        <Priority value="HIGH" />
        <Priority value="MEDIUM" />
        <Priority value="LOW" />
      </>,
    );
    const bars = [...container.querySelectorAll('.q-priority__bars')].map((node) => node.className);
    expect(bars).toEqual([
      'q-priority__bars q-priority__bars--3',
      'q-priority__bars q-priority__bars--2',
      'q-priority__bars q-priority__bars--1',
    ]);
  });
});

describe('getInitials', () => {
  it('uses first and last name, or the email user part', () => {
    expect(getInitials('Ayinsson Solano')).toBe('AS');
    expect(getInitials('María José Rojas')).toBe('MR');
    expect(getInitials('luis.perez@empresa.com')).toBe('LP');
    expect(getInitials('')).toBe('?');
  });
});

describe('StatusBadge', () => {
  it('renders the resolved label', () => {
    render(<StatusBadge status="OPEN" itemType="bug" />);
    expect(screen.getByText('Bug abierto')).toHaveClass('q-status--danger');
  });
});

describe('Button', () => {
  it('blocks clicks while loading', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" loading onClick={onClick}>
        Guardar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Modal', () => {
  it('is labelled by its title and closes with Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Reportar bug" onClose={onClose}>
        <input aria-label="Título" />
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Reportar bug' })).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps focus on the field being typed in when the parent re-renders', () => {
    function Form() {
      const [name, setName] = useState('');
      const [description, setDescription] = useState('');
      // onClose nuevo en cada render, como en los formularios reales.
      return (
        <Modal open title="Nuevo proyecto" onClose={() => setName('')}>
          <input aria-label="Nombre" value={name} onChange={(event) => setName(event.target.value)} />
          <textarea
            aria-label="Descripción"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Modal>
      );
    }

    render(<Form />);
    const description = screen.getByLabelText('Descripción');
    description.focus();
    fireEvent.change(description, { target: { value: 'Pruebas de pago' } });

    expect(description).toHaveFocus();
    expect(description).toHaveValue('Pruebas de pago');
    expect(screen.getByLabelText('Nombre')).toHaveValue('');
  });

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} title="Oculto" onClose={() => undefined}>
        contenido
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('shows the illustration for both themes as decoration, not content', () => {
    const { container } = render(<EmptyState illustrated title="Todo al día" />);
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    images.forEach((image) => expect(image).toHaveAttribute('alt', ''));
    expect(container.querySelector('.q-empty__icon')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Todo al día' })).toBeInTheDocument();
  });
});
