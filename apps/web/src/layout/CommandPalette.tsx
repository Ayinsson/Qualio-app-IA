import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { ArchiveIcon, getAvatarColor, GridIcon, HomeIcon, MailIcon, PlusIcon, SearchIcon, ShareIcon } from '../ui';
import { searchDestinations } from './navigation';
import type { Destination, NavProject } from './navigation';

const sectionIcons: Record<string, ReactElement> = {
  inicio: <HomeIcon size={16} />,
  nuevo: <PlusIcon size={16} />,
  activos: <GridIcon size={16} />,
  archivados: <ArchiveIcon size={16} />,
  invitaciones: <MailIcon size={16} />,
  compartidos: <ShareIcon size={16} />,
};

function DestinationIcon({ destination }: { destination: Destination }) {
  if (destination.group === 'Proyectos') {
    return (
      <span className="ql-cmd-mark" style={{ background: getAvatarColor(destination.label) }} aria-hidden="true">
        {destination.label.trim().charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <span className="ql-cmd-icon" aria-hidden="true">
      {sectionIcons[destination.id]}
    </span>
  );
}

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  projects: NavProject[];
};

/** Buscador rápido (Ctrl/⌘ + K): salta a un proyecto o a una sección. */
export function CommandPalette({ open, onClose, projects }: CommandPaletteProps) {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => searchDestinations(query, projects), [query, projects]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) {
    return null;
  }

  const go = (destination: Destination | undefined) => {
    if (!destination) {
      return;
    }
    onClose();
    navigate(destination.to);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (results.length === 0 ? 0 : (index + 1) % results.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (results.length === 0 ? 0 : (index - 1 + results.length) % results.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div
      className="ql-cmd-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="ql-cmd" role="dialog" aria-modal="true" aria-label="Buscar o ir a">
        <div className="ql-cmd-field">
          <SearchIcon size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Busca un proyecto o una sección…"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined}
            aria-autocomplete="list"
          />
        </div>

        <ul className="ql-cmd-list" id={listId} role="listbox" aria-label="Resultados">
          {results.length === 0 ? (
            <li className="ql-cmd-empty">No hay proyectos ni secciones que coincidan con "{query}".</li>
          ) : null}
          {results.map((destination, index) => {
            const showGroup = destination.group !== lastGroup;
            lastGroup = destination.group;
            return (
              <li key={destination.id} role="presentation">
                {showGroup ? <p className="ql-cmd-group">{destination.group}</p> : null}
                <div
                  id={`${listId}-${destination.id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`ql-cmd-option${index === activeIndex ? ' is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(destination)}
                >
                  <DestinationIcon destination={destination} />
                  {destination.label}
                  {index === activeIndex ? <kbd className="ql-kbd">Enter</kbd> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
