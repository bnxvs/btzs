/**
 * Тесты оболочки приложения (задачи 12.1–12.5).
 *
 * Файловые диалоги и внешние ссылки подменяются через `ShellDeps`; список
 * последних файлов и видимость панелей проверяются юнит-тестами `store/shell`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFilm, readPaper } from '@/core/format';
import { PRODUCT, createFilmDocument } from '@/core/model';
import type { FilmDocument, MatcherDocument } from '@/core/model';
import { setLocale } from '@/i18n';
import {
  RECENT_FILES_LIMIT,
  addRecentFile,
  clearRecentFiles,
  closeDocument,
  getActiveDocument,
  getDocuments,
  getShellState,
  markSaved,
  openDocument,
  parseRecentFiles,
  pushRecent,
  resetShell,
  setActiveDocument,
  setActiveTab,
  subscribeShell,
  tabsFor,
  updateDocument,
} from '@/store';
import { createMatcherDocument } from '@/core/model';

const APP_DIR = join(process.cwd(), 'app');

function filmFixture() {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, '_400_TMax_ID11_23_75.pfc'))));
}
function paperFixture() {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, 'Agfa_MCC.ppc'))));
}

beforeEach(() => {
  setLocale('ru');
  resetShell();
});
afterEach(() => {
  resetShell();
  setLocale('ru');
});

describe('12.1 Реестр документов и вкладки', () => {
  it('новый плёночный документ открывается на вкладке Data, существующий — на Family', () => {
    const fresh = openDocument(createFilmDocument());
    expect(fresh.activeTab).toBe('data');
    resetShell();
    const opened = openDocument(filmFixture(), 'film.pfc');
    expect(opened.activeTab).toBe('family');
  });

  it('новый Matcher открывается на вкладке Info', () => {
    resetShell();
    const matcher = createMatcherDocument(filmFixture(), paperFixture(), 'f.pfc', 'p.ppc');
    const entry = openDocument(matcher, '');
    expect(entry.activeTab).toBe('info');
    expect(tabsFor(matcher)).toEqual(['info', 'film', 'paper', 'compare']);
  });

  it('открытие и закрытие нескольких документов поддерживает активный', () => {
    const a = openDocument(createFilmDocument());
    const b = openDocument(createFilmDocument());
    expect(getDocuments()).toHaveLength(2);
    expect(getActiveDocument()?.id).toBe(b.id);
    closeDocument(b.id);
    expect(getActiveDocument()?.id).toBe(a.id);
    closeDocument(a.id);
    expect(getActiveDocument()).toBeNull();
  });

  it('переключение вкладки и активного документа', () => {
    const a = openDocument(filmFixture(), 'a.pfc');
    const b = openDocument(filmFixture(), 'b.pfc');
    expect(getActiveDocument()?.id).toBe(b.id);
    setActiveDocument(a.id);
    expect(getActiveDocument()?.id).toBe(a.id);
    setActiveTab(a.id, 'charts');
    expect(getActiveDocument()?.activeTab).toBe('charts');
  });

  it('обновление документа помечает несохранённые изменения', () => {
    const entry = openDocument(createFilmDocument());
    const doc = entry.doc as FilmDocument;
    updateDocument(entry.id, { ...doc, family: { ...doc.family, name: 'X' } });
    expect(getActiveDocument()?.dirty).toBe(true);
  });
});

describe('12.1 Список последних файлов', () => {
  it('открытый файл добавляется в начало списка', () => {
    openDocument(filmFixture(), 'a.pfc');
    openDocument(paperFixture(), 'b.ppc');
    expect(getShellState().recentFiles).toEqual(['b.ppc', 'a.pfc']);
  });

  it('повторное открытие поднимает файл наверх без дубликатов', () => {
    addRecentFile('a.pfc');
    addRecentFile('b.ppc');
    addRecentFile('a.pfc');
    expect(getShellState().recentFiles).toEqual(['a.pfc', 'b.ppc']);
  });

  it('список ограничен и обрезается', () => {
    const many = Array.from({ length: RECENT_FILES_LIMIT + 5 }, (_, i) => `f${i}.pfc`);
    const list = many.reduce<string[]>((acc, path) => pushRecent(acc, path), []);
    expect(list).toHaveLength(RECENT_FILES_LIMIT);
  });

  it('очистка списка', () => {
    addRecentFile('a.pfc');
    clearRecentFiles();
    expect(getShellState().recentFiles).toEqual([]);
  });

  it('разбор сохранённого списка отбрасывает некорректные записи', () => {
    expect(parseRecentFiles('["a.pfc",5,"",null,"b.ppc"]')).toEqual(['a.pfc', 'b.ppc']);
    expect(parseRecentFiles('не json')).toEqual([]);
  });
});

describe('12.1 подписка на состояние', () => {
  it('уведомляет подписчиков при изменениях', () => {
    const listener = vi.fn();
    const off = subscribeShell(listener);
    openDocument(createFilmDocument());
    expect(listener).toHaveBeenCalled();
    off();
  });

  it('markSaved снимает флаг изменений и добавляет путь', () => {
    const entry = openDocument(createFilmDocument());
    updateDocument(entry.id, entry.doc);
    markSaved(entry.id, 'out.pfc');
    expect(getActiveDocument()?.dirty).toBe(false);
    expect(getActiveDocument()?.path).toBe('out.pfc');
  });
});

// Оболочка и диалоги.
import { Shell } from './Shell';
import { MenuBar } from './MenuBar';
import { StatusBar } from './StatusBar';
import { CommandBar, FILE_COMMANDS, DOCUMENT_COMMANDS } from './CommandBar';
import { DocumentTabs } from './DocumentTabs';
import { buildMenu } from './menu';
import { AboutDialog } from './AboutDialog';
import { HelpDialog } from './HelpDialog';
import {
  copyChartToClipboard,
  serializeSvg,
  setClipboardBackend,
} from './graph-clipboard';

describe('12.2 Команды по типу документа', () => {
  const base = {
    smoothCurves: false,
    colorCurves: true,
    displayGrid: true,
    recentFiles: [] as string[],
  };

  it('набор команд плёнки содержит File/View/Help без Edit', () => {
    const menu = buildMenu({ ...base, kind: 'film' });
    expect(menu.map((m) => m.labelKey)).toEqual(['menu.file', 'menu.view', 'menu.help']);
    const file = menu[0];
    const commands = file.items.map((i) => i.command);
    expect(commands).not.toContain('export-expo-dev');
    expect(commands).not.toContain('import-curve');
    expect(commands).toContain('step-tablet');
    expect(commands).toContain('print');
  });

  it('набор команд бумаги содержит File/View/Help без Edit', () => {
    const menu = buildMenu({ ...base, kind: 'paper' });
    expect(menu.map((m) => m.labelKey)).toEqual(['menu.file', 'menu.view', 'menu.help']);
    const commands = menu[0].items.map((i) => i.command);
    expect(commands).not.toContain('export-expo-dev');
    expect(commands).toContain('step-tablet');
  });

  it('набор команд Matcher содержит группу Match и Restore File Defaults', () => {
    const menu = buildMenu({ ...base, kind: 'matcher' });
    const labelKeys = menu.map((m) => m.labelKey);
    expect(labelKeys).toContain('menu.match');
    expect(labelKeys).toContain('menu.edit');
    const edit = menu.find((m) => m.labelKey === 'menu.edit')!;
    expect(edit.items.map((i) => i.command)).toEqual(['restore-file-defaults']);
    const commands = menu[0].items.map((i) => i.command);
    expect(commands).not.toContain('export-expo-dev');
  });

  it('без открытых документов File не содержит команд документа', () => {
    const menu = buildMenu({ ...base, kind: null });
    const commands = menu[0].items.map((i) => i.command);
    expect(commands).not.toContain('save');
    expect(commands).toContain('exit');
  });

  it('группа View плёнки содержит проверяемые команды', () => {
    const menu = buildMenu({ ...base, kind: 'film' });
    const view = menu.find((m) => m.labelKey === 'menu.view')!;
    const checkables = view.items.filter((i) => i.checkable).map((i) => i.command);
    expect(checkables).toContain('smooth-curves');
    expect(checkables).toContain('color-curves');
    expect(checkables).toContain('display-grid');
  });

  it('команда Recent Files присутствует и несёт список', () => {
    const menu = buildMenu({ ...base, kind: 'film', recentFiles: ['a.pfc'] });
    const recent = menu[0].items.find((i) => i.command === 'recent-files');
    expect(recent?.recentFiles).toEqual(['a.pfc']);
  });
});

describe('12.2 Меню: компонент', () => {
  const state = {
    smoothCurves: false,
    colorCurves: true,
    displayGrid: true,
    recentFiles: [] as string[],
    kind: 'film' as const,
  };

  it('раскрывает меню и выполняет команду', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<MenuBar state={state} onCommand={onCommand} />);
    await user.click(screen.getByTestId('menu-menu.file'));
    expect(screen.getByTestId('dropdown-menu.file')).toBeInTheDocument();
    await user.click(screen.getByTestId('menuitem-new-film'));
    expect(onCommand).toHaveBeenCalledWith('new-film');
  });

  it('показывает отметки проверяемых команд View', async () => {
    const user = userEvent.setup();
    render(<MenuBar state={state} onCommand={() => undefined} />);
    await user.click(screen.getByTestId('menu-menu.view'));
    const item = screen.getByTestId('menuitem-color-curves');
    expect(item).toHaveAttribute('aria-checked', 'true');
  });

  it('команда Recent Files показывает список и очистку', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<MenuBar state={{ ...state, recentFiles: ['a.pfc'] }} onCommand={onCommand} />);
    await user.click(screen.getByTestId('menu-menu.file'));
    expect(screen.getByTestId('recent-a.pfc')).toBeInTheDocument();
    await user.click(screen.getByTestId('recent-clear'));
    expect(onCommand).toHaveBeenCalledWith('clear-recent');
  });
});

describe('12.3 Панель команд и строка состояния', () => {
  it('панель команд содержит иконочные кнопки с названиями и подсказками', () => {
    const onCommand = vi.fn();
    const onHint = vi.fn();
    render(
      <CommandBar
        groups={[FILE_COMMANDS, DOCUMENT_COMMANDS]}
        label="команды"
        onCommand={onCommand}
        onHint={onHint}
      />,
    );
    expect(screen.getByTestId('command-bar')).toBeInTheDocument();
    const filmButton = screen.getByTestId('command-new-film');
    expect(filmButton).toHaveAttribute('title');
    expect(filmButton).toHaveTextContent('Новая плёнка');
    fireEvent.click(filmButton);
    expect(onCommand).toHaveBeenCalledWith('new-film');
    fireEvent.mouseEnter(filmButton);
    expect(onHint).toHaveBeenCalled();
  });

  it('строка состояния показывает документ, изменения и подсказку', () => {
    render(<StatusBar documentName="400 TMax" dirty hint="Открыть документ" />);
    expect(screen.getByTestId('status-document')).toHaveTextContent('400 TMax');
    expect(screen.getByTestId('status-dirty')).toBeInTheDocument();
    expect(screen.getByTestId('status-hint')).toHaveTextContent('Открыть документ');
  });

  it('полоса вкладок показывает документы и закрывает их', () => {
    const a = openDocument(filmFixture(), 'a.pfc');
    const b = openDocument(createFilmDocument());
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <DocumentTabs
        documents={getDocuments()}
        activeId={b.id}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId(`doc-tab-${a.id}`)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`doc-tab-title-${a.id}`));
    expect(onSelect).toHaveBeenCalledWith(a.id);
    // Новый документ не сохранён — на его вкладке нет пути, но вкладка есть.
    fireEvent.click(screen.getByTestId(`doc-tab-close-${b.id}`));
    expect(onClose).toHaveBeenCalledWith(b.id);
  });
});

describe('12.4 Справка и «О программе»', () => {
  it('окно About показывает название, версию и копирайт', () => {
    render(<AboutDialog onClose={() => undefined} />);
    expect(screen.getByTestId('about-product')).toHaveTextContent('Plotter for Windows');
    expect(screen.getByTestId('about-version')).toHaveTextContent(PRODUCT.version);
    expect(screen.getByTestId('about-copyright')).toHaveTextContent('Phil Davis');
    expect(screen.getByTestId('about-company')).toHaveTextContent('The View Camera Store');
  });

  it('окно справки содержит темы', () => {
    render(<HelpDialog onClose={() => undefined} />);
    expect(screen.getByTestId('help-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('help-topics')).toBeInTheDocument();
    expect(screen.getByTestId('help-footer')).toHaveTextContent('F1');
  });
});

describe('Оболочка Shell', () => {
  it('открывает фильм из меню и показывает вкладку документа', async () => {
    const user = userEvent.setup();
    render(<Shell deps={{ openFile: async () => ({ path: 'f.pfc', doc: filmFixture() }) }} />);
    await user.click(screen.getByTestId('menu-menu.file'));
    await user.click(screen.getByTestId('menuitem-open'));
    expect(getDocuments()).toHaveLength(1);
    const id = getDocuments()[0].id;
    expect(screen.getByTestId(`document-window-${id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`tab-${id}-family`)).toBeInTheDocument();
    expect(screen.getByTestId(`doc-tab-${id}`)).toHaveAttribute('data-active', 'true');
  });

  it('создаёт новый документ плёнки и открывает вкладку Data', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(screen.getByTestId('menu-menu.file'));
    await user.click(screen.getByTestId('menuitem-new-film'));
    const id = getDocuments()[0].id;
    expect(getDocuments()[0].activeTab).toBe('data');
    expect(screen.getByTestId(`tab-${id}-data`)).toHaveClass('active');
  });

  it('создаёт новый документ кнопкой панели команд', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(screen.getByTestId('command-new-paper'));
    expect(getDocuments()[0].doc.kind).toBe('paper');
    expect(screen.getByTestId('status-document')).toBeInTheDocument();
  });

  it('переключает внутренние вкладки и вкладки документов', async () => {
    const user = userEvent.setup();
    const a = openDocument(createFilmDocument());
    const b = openDocument(createFilmDocument());
    render(<Shell />);
    await user.click(screen.getByTestId(`tab-${b.id}-family`));
    expect(getActiveDocument()?.activeTab).toBe('family');
    await user.click(screen.getByTestId(`doc-tab-title-${a.id}`));
    expect(getActiveDocument()?.id).toBe(a.id);
    expect(screen.getByTestId(`doc-tab-${a.id}`)).toHaveAttribute('data-active', 'true');
  });

  it('панель команд скрывает команды документа у Matcher и показывает их у плёнки', () => {
    const matcher = createMatcherDocument(filmFixture(), paperFixture(), 'f.pfc', 'p.ppc');
    openDocument(matcher, '');
    const { unmount } = render(<Shell />);
    expect(screen.queryByTestId('command-step-tablet')).not.toBeInTheDocument();
    expect(screen.queryByTestId('command-print')).not.toBeInTheDocument();
    unmount();
    resetShell();
    openDocument(filmFixture(), 'film.pfc');
    render(<Shell />);
    expect(screen.getByTestId('command-step-tablet')).toBeInTheDocument();
    expect(screen.getByTestId('command-print')).toBeInTheDocument();
  });

  it('запрашивает сохранение при закрытии вкладки изменённого документа', async () => {
    const user = userEvent.setup();
    const saveFile = vi.fn(async () => 'saved.pfc');
    const entry = openDocument(createFilmDocument());
    updateDocument(entry.id, entry.doc);
    render(<Shell deps={{ saveFile }} />);
    await user.click(screen.getByTestId(`doc-tab-close-${entry.id}`));
    expect(screen.getByTestId('close-prompt')).toBeInTheDocument();
    await user.click(screen.getByTestId('close-save'));
    expect(saveFile).toHaveBeenCalled();
    expect(getDocuments()).toHaveLength(0);
  });

  it('«О программе» открывается из меню Help', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(screen.getByTestId('menu-menu.help'));
    await user.click(screen.getByTestId('menuitem-about'));
    expect(screen.getByTestId('about-dialog')).toBeInTheDocument();
  });

  it('источник BTZS.org открывается по команде и через F1 — справка', async () => {
    const user = userEvent.setup();
    const openExternal = vi.fn();
    render(<Shell deps={{ openExternal }} />);
    await user.click(screen.getByTestId('menu-menu.help'));
    await user.click(screen.getByTestId('menuitem-btzs-website'));
    expect(openExternal).toHaveBeenCalledWith(PRODUCT.website);
    fireEvent.keyDown(document, { key: 'F1' });
    expect(screen.getByTestId('help-dialog')).toBeInTheDocument();
  });

  it('горячая клавиша Ctrl+M создаёт документ Matcher', async () => {
    const matcher = createMatcherDocument(filmFixture(), paperFixture(), 'f.pfc', 'p.ppc');
    render(
      <Shell
        deps={{ createMatcher: async () => ({ ok: true, doc: matcher as MatcherDocument }) }}
      />,
    );
    fireEvent.keyDown(document, { key: 'm', ctrlKey: true });
    await screen.findByTestId('matcher-tab');
    expect(getDocuments()[0].doc.kind).toBe('matcher');
  });

  it('отмена создания Matcher сообщается в строке состояния', async () => {
    const user = userEvent.setup();
    render(<Shell deps={{ createMatcher: async () => ({ ok: false, reason: 'cancelled' }) }} />);
    await user.click(screen.getByTestId('command-new-matcher'));
    expect(screen.getByTestId('status-hint')).toHaveTextContent(
      'Создание документа Matcher отменено',
    );
  });

  it('неверный вид файла при создании Matcher сообщается в строке состояния', async () => {
    const user = userEvent.setup();
    render(<Shell deps={{ createMatcher: async () => ({ ok: false, reason: 'wrong-film' }) }} />);
    await user.click(screen.getByTestId('command-new-matcher'));
    expect(screen.getByTestId('status-hint')).toHaveTextContent(
      'Выбранный файл не является документом плёнки',
    );
  });

  it('ошибка открытия файла не проглатывается, а сообщается в строке состояния', async () => {
    const user = userEvent.setup();
    render(
      <Shell
        deps={{
          openFile: async () => {
            throw new Error('битый файл');
          },
        }}
      />,
    );
    await user.click(screen.getByTestId('command-open'));
    expect(screen.getByTestId('status-hint')).toHaveTextContent(
      'Не удалось открыть документ: битый файл',
    );
  });

  it('ошибка подменённого создания Matcher сообщается, а не проглатывается', async () => {
    const user = userEvent.setup();
    render(
      <Shell
        deps={{
          createMatcher: async () => {
            throw new Error('сбой диалога');
          },
        }}
      />,
    );
    await user.click(screen.getByTestId('command-new-matcher'));
    expect(screen.getByTestId('status-hint')).toHaveTextContent(
      'Не удалось выполнить команду: сбой диалога',
    );
  });

  it('меню Matcher показывает группу Match для активного документа', () => {
    const matcher = createMatcherDocument(filmFixture(), paperFixture(), 'f.pfc', 'p.ppc');
    openDocument(matcher, '');
    render(<Shell />);
    expect(screen.getByTestId('menu-menu.match')).toBeInTheDocument();
  });

  it('список последних файлов обновляется в подменю меню File', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    openDocument(filmFixture(), 'recent.pfc');
    await user.click(screen.getByTestId('menu-menu.file'));
    expect(screen.getByTestId('recent-recent.pfc')).toBeInTheDocument();
  });
});

describe('12.5 Копирование графика в буфер обмена', () => {
  it('сериализует SVG графика', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = '<line x1="0" y1="0" x2="1" y2="1" />';
    expect(serializeSvg(svg)).toContain('<svg');
  });

  it('копирует график через бэк (SVG-текст, если PNG недоступен)', async () => {
    const copyText = vi.fn(async () => undefined);
    const copyPng = vi.fn(async () => undefined);
    setClipboardBackend({ copyText, copyPng });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 10 10');
    const ok = await copyChartToClipboard(svg);
    expect(ok).toBe(true);
    expect(copyText.mock.calls.length + copyPng.mock.calls.length).toBeGreaterThan(0);
    setClipboardBackend(null);
  });

  it('ошибка буфера не выбрасывается наружу', async () => {
    setClipboardBackend({
      copyText: async () => {
        throw new Error('буфер недоступен');
      },
      copyPng: async () => {
        throw new Error('буфер недоступен');
      },
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    expect(await copyChartToClipboard(svg)).toBe(false);
    setClipboardBackend(null);
  });
});
