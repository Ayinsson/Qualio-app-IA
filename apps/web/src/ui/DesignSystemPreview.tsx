import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  fieldDescribedBy,
  Input,
  ItemKey,
  Modal,
  PlusIcon,
  Priority,
  Select,
  StatusBadge,
  Textarea,
} from './index';

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 'var(--q-space-3)' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 'var(--q-text-lg)', fontWeight: 700 }}>{title}</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--q-ink-soft)', fontSize: 'var(--q-text-sm)' }}>{note}</p>
      </div>
      {children}
    </section>
  );
}

const row = { display: 'flex', flexWrap: 'wrap', gap: 'var(--q-space-2)', alignItems: 'center' } as const;

/** Página de referencia del sistema base. Solo se registra en desarrollo (/app/sistema). */
export function DesignSystemPreview() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div
      style={{
        display: 'grid',
        gap: 'var(--q-space-6)',
        maxWidth: 960,
        padding: 'var(--q-space-5) 0',
        color: 'var(--q-ink)',
        fontFamily: 'var(--q-font)',
      }}
    >
      <header>
        <h1 style={{ margin: 0, fontSize: 'var(--q-text-2xl)', fontWeight: 700, letterSpacing: '-0.01em' }}>
          Sistema base
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--q-ink-soft)' }}>
          Piezas compartidas para rediseñar cada vista. Cambia el tema con el cielo de la barra superior.
        </p>
      </header>

      <Section title="Tipografía" note="Onest con escala de 1,2 a partir de 16 px.">
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 'var(--q-text-3xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>Sprint 4 · Checkout</span>
          <span style={{ fontSize: 'var(--q-text-2xl)', fontWeight: 700 }}>Título de vista</span>
          <span style={{ fontSize: 'var(--q-text-xl)', fontWeight: 700 }}>Título de sección</span>
          <span style={{ fontSize: 'var(--q-text-lg)', fontWeight: 500 }}>Título de tarjeta o modal</span>
          <span style={{ fontSize: 'var(--q-text-base)' }}>Texto de cuerpo para descripciones y formularios.</span>
          <span style={{ fontSize: 'var(--q-text-sm)', color: 'var(--q-ink-soft)' }}>Texto secundario y metadatos</span>
        </div>
      </Section>

      <Section title="Botones" note="Cuatro variantes y dos tamaños. Una sola acción principal por vista.">
        <div style={row}>
          <Button variant="primary">Crear tarea</Button>
          <Button>Cancelar</Button>
          <Button variant="ghost">Ver historial</Button>
          <Button variant="danger">Archivar</Button>
          <Button variant="primary" loading>
            Guardando…
          </Button>
        </div>
        <div style={row}>
          <Button variant="primary" size="sm">
            Guardar
          </Button>
          <Button size="sm" icon={<PlusIcon size={14} />}>
            Agregar
          </Button>
          <Button variant="ghost" size="sm">
            Limpiar filtros
          </Button>
        </div>
      </Section>

      <Section title="Campos" note="Etiqueta arriba; ayuda o error debajo.">
        <div style={{ display: 'grid', gap: 'var(--q-space-4)', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <Field id="ds-title" label="Título del bug" hint="Describe el síntoma, no la causa.">
            <Input
              id="ds-title"
              placeholder="El botón Pagar no responde"
              aria-describedby={fieldDescribedBy('ds-title', 'x')}
            />
          </Field>
          <Field id="ds-env" label="Entorno" error="Elige en qué entorno ocurrió.">
            <Select id="ds-env" invalid aria-describedby={fieldDescribedBy('ds-env', undefined, 'x')} defaultValue="">
              <option value="">Selecciona un entorno</option>
              <option>QA</option>
              <option>Staging</option>
              <option>Producción</option>
            </Select>
          </Field>
          <Field id="ds-desc" label="Descripción" optional>
            <Textarea id="ds-desc" placeholder="Pasos para reproducir" />
          </Field>
        </div>
      </Section>

      <Section title="Estados" note="El color se reserva para el estado.">
        <div style={row}>
          <StatusBadge status="TODO" />
          <StatusBadge status="IN_PROGRESS" />
          <StatusBadge status="Bloqueado" />
          <StatusBadge status="DONE" />
          <StatusBadge status="OPEN" itemType="bug" />
          <StatusBadge status="RESOLVED" itemType="bug" />
        </div>
      </Section>

      <Section title="Prioridad" note="Barras de señal sin color, para no competir con el estado.">
        <div style={{ ...row, gap: 'var(--q-space-5)' }}>
          <Priority value="Alta" />
          <Priority value="Medio" />
          <Priority value="Bajo" />
        </div>
      </Section>

      <Section title="Claves y avatares" note="Cifras de ancho fijo para que las listas queden alineadas.">
        <div style={{ ...row, gap: 'var(--q-space-4)' }}>
          <ItemKey itemType="task" value="TSK-12" />
          <ItemKey itemType="bug" value="BUG-7" />
          <Avatar name="Ayinsson Solano" />
          <Avatar name="María Rojas" />
          <Avatar name="luis.perez@empresa.com" />
          <Avatar name="Ana Pérez" size={40} />
        </div>
      </Section>

      <Section title="Tarjeta de ítem" note="Así se combinan las piezas en el Backlog y el Tablero.">
        <div style={{ display: 'grid', gap: 'var(--q-space-3)', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 340px))' }}>
          <Card interactive>
            <div style={{ ...row, justifyContent: 'space-between' }}>
              <ItemKey itemType="bug" value="BUG-7" />
              <StatusBadge status="OPEN" itemType="bug" />
            </div>
            <p style={{ margin: '10px 0 14px', fontWeight: 500, lineHeight: 1.35 }}>
              El botón Pagar no responde con tarjetas guardadas
            </p>
            <div style={{ ...row, justifyContent: 'space-between' }}>
              <Priority value="Alta" />
              <Avatar name="Ayinsson Solano" size={24} />
            </div>
          </Card>
          <Card interactive>
            <div style={{ ...row, justifyContent: 'space-between' }}>
              <ItemKey itemType="task" value="TSK-12" />
              <StatusBadge status="IN_PROGRESS" />
            </div>
            <p style={{ margin: '10px 0 14px', fontWeight: 500, lineHeight: 1.35 }}>
              Escribir casos de prueba del flujo de devoluciones
            </p>
            <div style={{ ...row, justifyContent: 'space-between' }}>
              <Priority value="Medio" />
              <Avatar name="María Rojas" size={24} />
            </div>
          </Card>
        </div>
      </Section>

      <Section
        title="Estado vacío ilustrado"
        note="Solo para momentos importantes: proyecto nuevo, tablero sin sprint y todo al día."
      >
        <Card padded={false}>
          <EmptyState
            illustrated
            title="Empieza a planificar"
            description="Crea la primera tarea o reporta un bug. Todo entra al backlog, y desde ahí lo llevas al sprint."
            action={
              <>
                <Button>Reportar bug</Button>
                <Button variant="primary">Crear tarea</Button>
              </>
            }
          />
        </Card>
      </Section>

      <Section title="Estado vacío y modal" note="Un estado vacío invita a actuar.">
        <Card padded={false}>
          <EmptyState
            title="Aún no hay tareas en este sprint"
            description="Agrega tareas o bugs desde el backlog para empezar a trabajar en el tablero."
            action={
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Abrir modal de ejemplo
              </Button>
            }
          />
        </Card>
      </Section>

      <Modal
        open={modalOpen}
        title="Reportar bug"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Reportar bug
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--q-space-4)' }}>
          <Field id="ds-modal-title" label="Título del bug">
            <Input id="ds-modal-title" placeholder="El botón Pagar no responde" />
          </Field>
          <Field id="ds-modal-steps" label="Pasos para reproducir" optional>
            <Textarea id="ds-modal-steps" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
