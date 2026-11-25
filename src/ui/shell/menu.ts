import { t } from '@/i18n';
import type { MessageKey } from '@/i18n';
import type { PlotterDocument } from '@/core/model';

/**
 * `ui/shell/menu` — декларативная модель команд (spec: app-shell /
 * «Document-type-specific commands»).
 *
 * Набор команд зависит от типа активного документа: Film/Paper получают группы
 * File/View/Help, Matcher — File/Edit/Match/View/Help, причём команда
 * «Restore File Defaults» присутствует только для Matcher, а
 * «Save current Match for Comparison» — только для Matcher.
 */

/** Идентификатор команды меню. */
export type MenuCommand =
  | 'new-film'
  | 'new-paper'
  | 'new-matcher'
  | 'open'
  | 'close'
  | 'save'
  | 'save-as'
  | 'step-tablet'
  | 'print'
  | 'print-preview'
  | 'print-setup'
  | 'exit'
  | 'clear-recent'
  | 'restore-file-defaults'
  | 'smooth-curves'
  | 'color-curves'
  | 'display-grid'
  | 'options'
  | 'help-topics'
  | 'btzs-website'
  | 'about'
  | 'recent-files'
  | 'load-new-film'
  | 'load-new-paper'
  | 'approximate-curves'
  | 'save-match'
  | 'load-match'
  | 'load-reference-curve'
  | 'use-default-reference-curve'
  | 'use-loaded-curve';

/** Пункт меню. */
export interface MenuItem {
  /** Идентификатор действия; `undefined` для разделителя. */
  command?: MenuCommand;
  /** Ключ подписи из каталога переводов (или `undefined` для разделителя). */
  labelKey?: MessageKey;
  /** Горячая клавиша (отображение), например «Ctrl+F». */
  shortcut?: string;
  /** Проверяемый пункт (меню View). */
  checkable?: boolean;
  /** Текущее состояние отметки проверяемого пункта. */
  checked?: boolean;
  /** Подменю последних файлов (динамическое). */
  recentFiles?: readonly string[];
}

/** Разделитель меню. */
const SEP: MenuItem = {};

/** Меню (заголовок и пункты). */
export interface Menu {
  /** Ключ заголовка меню. */
  labelKey: MessageKey;
  items: MenuItem[];
}

/**
 * Состояние отметок команд View и списка последних файлов.
 */
export interface MenuState {
  smoothCurves: boolean;
  colorCurves: boolean;
  displayGrid: boolean;
  recentFiles: readonly string[];
  /** Тип активного документа; `null` — нет открытых документов. */
  kind: PlotterDocument['kind'] | null;
}

function fileMenu(state: MenuState): Menu {
  const items: MenuItem[] = [
    { command: 'new-film', labelKey: 'menu.newFilm', shortcut: 'Ctrl+F' },
    { command: 'new-paper', labelKey: 'menu.newPaper', shortcut: 'Ctrl+N' },
    { command: 'new-matcher', labelKey: 'menu.newMatcher', shortcut: 'Ctrl+M' },
    SEP,
    { command: 'open', labelKey: 'menu.open', shortcut: 'Ctrl+O' },
  ];
  // Пункты документа доступны только когда есть активное окно.
  if (state.kind !== null) {
    items.push(
      { command: 'close', labelKey: 'menu.close' },
      { command: 'save', labelKey: 'menu.save', shortcut: 'Ctrl+S' },
      { command: 'save-as', labelKey: 'menu.saveAs' },
      SEP,
      { command: 'step-tablet', labelKey: 'menu.stepTablet', shortcut: 'Ctrl+T' },
      SEP,
      { command: 'print', labelKey: 'menu.print', shortcut: 'Ctrl+P' },
      { command: 'print-preview', labelKey: 'menu.printPreview' },
      { command: 'print-setup', labelKey: 'menu.printSetup' },
    );
  }
  items.push(
    SEP,
    { command: 'recent-files', labelKey: 'menu.recentFiles', recentFiles: state.recentFiles },
    SEP,
    { command: 'exit', labelKey: 'menu.exit' },
  );
  return { labelKey: 'menu.file', items };
}

/**
 * Меню Edit. Для Matcher содержит «Restore File Defaults»; у документов
 * плёнки/бумаги команд редактирования нет, поэтому меню не показывается.
 */
function editMenu(state: MenuState): Menu {
  const items: MenuItem[] = [];
  if (state.kind === 'matcher') {
    items.push({ command: 'restore-file-defaults', labelKey: 'menu.restoreFileDefaults' });
  }
  return { labelKey: 'menu.edit', items };
}

function matchMenu(): Menu {
  return {
    labelKey: 'menu.match',
    items: [
      { command: 'load-new-film', labelKey: 'menu.loadNewFilm' },
      { command: 'load-new-paper', labelKey: 'menu.loadNewPaper' },
      SEP,
      { command: 'approximate-curves', labelKey: 'menu.approximateCurves' },
      SEP,
      { command: 'save-match', labelKey: 'menu.saveMatchForComparison' },
      { command: 'load-match', labelKey: 'menu.loadMatchForComparison' },
      SEP,
      { command: 'load-reference-curve', labelKey: 'menu.loadReferenceCurve' },
      { command: 'use-default-reference-curve', labelKey: 'menu.useDefaultReferenceCurve' },
      { command: 'use-loaded-curve', labelKey: 'menu.useLoadedCurve' },
    ],
  };
}

function viewMenu(state: MenuState): Menu {
  const items: MenuItem[] = [];
  if (state.kind === 'film' || state.kind === 'paper') {
    items.push(
      { command: 'smooth-curves', labelKey: 'menu.smoothCurves', checkable: true, checked: state.smoothCurves },
      { command: 'color-curves', labelKey: 'menu.colorCurves', checkable: true, checked: state.colorCurves },
      { command: 'display-grid', labelKey: 'menu.displayGrid', checkable: true, checked: state.displayGrid },
      SEP,
    );
  } else if (state.kind === 'matcher') {
    items.push(
      { command: 'color-curves', labelKey: 'menu.colorCurves', checkable: true, checked: state.colorCurves },
      SEP,
    );
  }
  items.push(
    { command: 'options', labelKey: 'menu.options' },
  );
  return { labelKey: 'menu.view', items };
}

function helpMenu(): Menu {
  return {
    labelKey: 'menu.help',
    items: [
      { command: 'help-topics', labelKey: 'menu.helpTopics' },
      SEP,
      { command: 'btzs-website', labelKey: 'menu.btzsWebsite' },
      { command: 'about', labelKey: 'menu.about' },
    ],
  };
}

/**
 * Собирает меню приложения по активному документу и состоянию отметок.
 *
 * Порядок: File, Edit, [Match], View, Help. Без открытых документов остаются
 * File (без команд документа) и Help.
 */
export function buildMenu(state: MenuState): Menu[] {
  const menus: Menu[] = [fileMenu(state)];
  const edit = editMenu(state);
  if (edit.items.length > 0) menus.push(edit);
  if (state.kind === 'matcher') menus.push(matchMenu());
  menus.push(viewMenu(state), helpMenu());
  return menus;
}

/** Подпись пункта меню (из каталога) либо `null` для разделителя. */
export function menuLabel(item: MenuItem): string | null {
  return item.labelKey ? t(item.labelKey) : null;
}
