import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { buildMenu, menuLabel } from './menu';
import type { MenuCommand, MenuItem, MenuState } from './menu';

/**
 * Главное меню (spec: app-shell / «Document-type-specific menus»).
 *
 * Меню собирается декларативно по активному документу (`buildMenu`) и
 * переключает отметки пунктов View. Наведение на пункт показывает подсказку в
 * строке состояния.
 */
export interface MenuBarProps {
  /** Состояние отметок и активного документа. */
  state: MenuState;
  /** Выполнение команды меню. */
  onCommand: (command: MenuCommand) => void;
  /** Подсказка для строки состояния. */
  onHint?: (hint: string) => void;
}

export function MenuBar({ state, onCommand, onHint }: MenuBarProps) {
  const menus = buildMenu(state);
  const [open, setOpen] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === null) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="menu-bar" role="menubar" ref={rootRef} data-testid="menu-bar">
      {menus.map((menu, index) => (
        <div key={menu.labelKey} className="menu-root">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={open === index}
            className={`menu-title${open === index ? ' open' : ''}`}
            data-testid={`menu-${menu.labelKey}`}
            onClick={() => setOpen(open === index ? null : index)}
          >
            {t(menu.labelKey)}
          </button>
          {open === index && (
            <ul className="menu-dropdown" role="menu" data-testid={`dropdown-${menu.labelKey}`}>
              {menu.items.map((item, itemIndex) => (
                <MenuRow
                  key={item.command ?? `sep-${itemIndex}`}
                  item={item}
                  onCommand={(command) => {
                    setOpen(null);
                    onCommand(command);
                  }}
                  onHint={onHint}
                />
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function MenuRow({
  item,
  onCommand,
  onHint,
}: {
  item: MenuItem;
  onCommand: (command: MenuCommand) => void;
  onHint?: (hint: string) => void;
}) {
  const label = menuLabel(item);

  if (!item.command || label === null) {
    return <li className="menu-separator" role="separator" data-testid="menu-separator" />;
  }

  // Пункт списка последних файлов.
  if (item.recentFiles) {
    return (
      <li className="menu-submenu" data-testid="menu-recent">
        <span className="menu-submenu-title">
          {label}
          <span aria-hidden="true"> ▸</span>
        </span>
        <ul className="menu-dropdown submenu" role="menu" data-testid="dropdown-recent">
          {item.recentFiles.length === 0 ? (
            <li className="menu-disabled" data-testid="recent-empty">
              {t('menu.noRecent')}
            </li>
          ) : (
            item.recentFiles.map((file) => (
              <li key={file}>
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  data-testid={`recent-${file}`}
                  onClick={() => onCommand('open')}
                >
                  {file}
                </button>
              </li>
            ))
          )}
          <li className="menu-separator" role="separator" />
          <li>
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              data-testid="recent-clear"
              onClick={() => onCommand('clear-recent')}
            >
              {t('menu.clearRecent')}
            </button>
          </li>
        </ul>
      </li>
    );
  }

  return (
    <li role="none">
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={item.checkable ? Boolean(item.checked) : undefined}
        className="menu-item"
        data-testid={`menuitem-${item.command}`}
        onClick={() => onCommand(item.command!)}
        onMouseEnter={() => onHint?.('')}
      >
        <span className="menu-check" aria-hidden="true">
          {item.checkable && item.checked ? '✓' : ''}
        </span>
        <span className="menu-label">{label}</span>
        {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
      </button>
    </li>
  );
}
