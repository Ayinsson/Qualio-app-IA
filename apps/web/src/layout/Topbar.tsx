import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { BellIcon, ChevronRightIcon, MenuIcon, SearchIcon } from '../ui';
import type { Crumb } from './navigation';

type TopbarProps = {
  breadcrumb: Crumb[];
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  unreadNotifications: number;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  themeToggle: ReactNode;
};

const isMac = typeof window !== 'undefined' && /Mac|iPhone|iPad/.test(window.navigator.platform);

export function Topbar({
  breadcrumb,
  onOpenMenu,
  onOpenSearch,
  unreadNotifications,
  notificationsOpen,
  onToggleNotifications,
  themeToggle,
}: TopbarProps) {
  return (
    <header className="ql-topbar">
      <button type="button" className="q-icon-btn ql-menu-btn" onClick={onOpenMenu} aria-label="Abrir menú">
        <MenuIcon size={20} />
      </button>

      <nav className="ql-breadcrumb" aria-label="Estás en">
        <ol>
          {breadcrumb.map((crumb, index) => {
            const isLast = index === breadcrumb.length - 1;
            return (
              <li key={`${crumb.label}-${index}`}>
                {crumb.to && !isLast ? <Link to={crumb.to}>{crumb.label}</Link> : (
                  <span aria-current={isLast ? 'page' : undefined}>{crumb.label}</span>
                )}
                {!isLast ? <ChevronRightIcon size={14} /> : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="ql-topbar-actions">
        <button type="button" className="ql-search-trigger" onClick={onOpenSearch} aria-keyshortcuts="Control+K Meta+K">
          <SearchIcon size={16} />
          <span className="ql-search-label">Buscar o ir a…</span>
          <kbd className="ql-kbd">{isMac ? '⌘ K' : 'Ctrl K'}</kbd>
        </button>

        <button
          type="button"
          className="q-icon-btn ql-bell"
          onClick={onToggleNotifications}
          aria-expanded={notificationsOpen}
          aria-label={
            unreadNotifications > 0 ? `Notificaciones, ${unreadNotifications} sin leer` : 'Notificaciones'
          }
        >
          <BellIcon size={20} />
          {unreadNotifications > 0 ? (
            <span className="ql-bell-count" aria-hidden="true">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          ) : null}
        </button>

        {themeToggle}
      </div>
    </header>
  );
}
