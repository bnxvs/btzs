import { t } from '@/i18n';
import type { MessageKey } from '@/i18n';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { MenuCommand } from './menu';

/**
 * Панель команд (spec: app-shell / «Command bar and status line»).
 *
 * Иконочные кнопки с текстовой подписью для быстрого доступа к основным
 * командам активного документа. Каждая кнопка имеет название (всплывающую
 * подсказку) и краткое описание для строки состояния; наведение на кнопку
 * показывает описание в строке состояния.
 */
export interface CommandButton {
  /** Команда, выполняемая кнопкой. */
  command: MenuCommand;
  /** Ключ названия команды (всплывающая подсказка и подпись). */
  titleKey: MessageKey;
  /** Ключ краткого описания (для строки состояния). */
  statusKey: MessageKey;
  /** Иконка кнопки. */
  icon: IconName;
}

/** Документы и файл. */
export const FILE_COMMANDS: readonly CommandButton[] = [
  { command: 'new-film', titleKey: 'menu.newFilm', statusKey: 'status.newFilm', icon: 'film' },
  { command: 'new-paper', titleKey: 'menu.newPaper', statusKey: 'status.newPaper', icon: 'paper' },
  {
    command: 'new-matcher',
    titleKey: 'menu.newMatcher',
    statusKey: 'status.newMatcher',
    icon: 'matcher',
  },
  { command: 'open', titleKey: 'menu.open', statusKey: 'status.open', icon: 'open' },
  { command: 'save', titleKey: 'menu.save', statusKey: 'status.save', icon: 'save' },
];

/** Работа с документом плёнки/бумаги. */
export const DOCUMENT_COMMANDS: readonly CommandButton[] = [
  {
    command: 'step-tablet',
    titleKey: 'menu.stepTablet',
    statusKey: 'status.stepTablet',
    icon: 'step-tablet',
  },
];

/** Печать. */
export const OUTPUT_COMMANDS: readonly CommandButton[] = [
  { command: 'print', titleKey: 'menu.print', statusKey: 'status.print', icon: 'print' },
];

/** Программа. */
export const APP_COMMANDS: readonly CommandButton[] = [
  { command: 'options', titleKey: 'menu.options', statusKey: 'status.options', icon: 'options' },
  { command: 'help-topics', titleKey: 'menu.helpTopics', statusKey: 'status.help', icon: 'help' },
];

/** Панель команд. */
export function CommandBar({
  groups,
  label,
  onCommand,
  onHint,
}: {
  groups: readonly (readonly CommandButton[])[];
  label: string;
  onCommand: (command: MenuCommand) => void;
  onHint: (hint: string) => void;
}) {
  const visible = groups.filter((group) => group.length > 0);
  return (
    <div className="command-bar" role="toolbar" aria-label={label} data-testid="command-bar">
      {visible.map((group, groupIndex) => (
        <div className="command-group" key={groupIndex} data-testid={`command-group-${groupIndex}`}>
          {groupIndex > 0 && <span className="command-divider" aria-hidden="true" />}
          {group.map((button) => (
            <button
              key={button.command}
              type="button"
              className="command-button"
              title={t(button.titleKey)}
              aria-label={t(button.titleKey)}
              data-testid={`command-${button.command}`}
              onClick={() => onCommand(button.command)}
              onMouseEnter={() => onHint(t(button.statusKey))}
              onMouseLeave={() => onHint('')}
            >
              <Icon name={button.icon} />
              <span className="command-label">{t(button.titleKey)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
