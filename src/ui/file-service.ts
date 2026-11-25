import {
  OPEN_FILE_FILTERS,
  documentKindForPath,
  readFilm,
  readMatcher,
  readPaper,
  writeFilm,
  writeMatcher,
  writePaper,
} from '@/core/format';
import type { FileFilter } from '@/core/format';
import { FILE_EXTENSIONS } from '@/core/model';
import type { PlotterDocument } from '@/core/model';
import { t } from '@/i18n';

/**
 * Файловый сервис: диалоги открытия/сохранения и чтение/запись документов.
 *
 * Диалоги вынесены за интерфейс `FileBackend`, чтобы:
 *  - в настольном приложении (Tauri) использовать системные диалоги macOS;
 *  - в тестах подменять бэк in-memory реализацией (задача 5.7 —
 *    интеграционный тест «создать → сохранить → открыть»);
 *  - в браузере (dev) работать через стандартные элементы `<input type=file>`
 *    и скачивание файла.
 */

/** Результат открытия файла: путь и содержимое. */
export interface OpenedFile {
  path: string;
  data: Uint8Array;
}

/** Абстракция системного файлового диалога. */
export interface FileBackend {
  /** Открывает файл; `null` — отмена пользователем. */
  openFile(options: { filters: FileFilter[]; title?: string }): Promise<OpenedFile | null>;
  /** Сохраняет файл; возвращает путь или `null` — отмена. */
  saveFile(options: {
    filters: FileFilter[];
    defaultName: string;
    data: Uint8Array;
  }): Promise<string | null>;
}

/** Тип документа для расширения: `PlotterDocument` или `null`. */
function readByPath(path: string, data: Uint8Array): PlotterDocument {
  const kind = documentKindForPath(path);
  switch (kind) {
    case 'film':
      return readFilm(data);
    case 'paper':
      return readPaper(data);
    case 'matcher':
      return readMatcher(data);
    default:
      throw new Error(`Неизвестный тип файла: «${path}»`);
  }
}

/** Байты документа по его виду. */
export function writeDocument(doc: PlotterDocument): Uint8Array {
  switch (doc.kind) {
    case 'film':
      return writeFilm(doc);
    case 'paper':
      return writePaper(doc);
    case 'matcher':
      return writeMatcher(doc);
  }
}

/** Расширение файла документа по его виду. */
export function defaultFileName(doc: PlotterDocument): string {
  const base = (doc.kind === 'matcher' ? 'match' : doc.family.name || 'untitled')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .trim();
  return `${base || 'untitled'}${FILE_EXTENSIONS[doc.kind]}`;
}

// ---------------------------------------------------------------------------
// Бэкенды
// ---------------------------------------------------------------------------

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function patternsOf(filters: FileFilter[]): { name: string; extensions: string[] }[] {
  return filters.map((f) => ({
    name: f.label,
    extensions: f.patterns.map((p) => p.replace(/^\*\./, '').replace(/^\*$/, '')),
  }));
}

/** Системные диалоги Tauri (macOS). */
const tauriBackend: FileBackend = {
  async openFile({ filters, title }) {
    const dialog = await import('@tauri-apps/plugin-dialog');
    const path = await dialog.open({ multiple: false, filters: patternsOf(filters), title });
    if (typeof path !== 'string') return null;
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const data = await readFile(path);
    return { path, data: new Uint8Array(data) };
  },
  async saveFile({ filters, defaultName, data }) {
    const dialog = await import('@tauri-apps/plugin-dialog');
    const path = await dialog.save({ filters: patternsOf(filters), defaultPath: defaultName });
    if (typeof path !== 'string') return null;
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(path, data);
    return path;
  },
};

/** Браузерный бэк (dev без Tauri): `<input type=file>` и скачивание. */
const browserBackend: FileBackend = {
  openFile({ filters, title }) {
    return new Promise((resolve) => {
      const input = createFileInput(filters);
      let settled = false;
      let closePrompt: (() => void) | null = null;

      const settle = (value: OpenedFile | null) => {
        if (settled) return;
        settled = true;
        closePrompt?.();
        input.remove();
        resolve(value);
      };

      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) {
          settle(null);
          return;
        }
        file.arrayBuffer().then(
          (buffer) => settle({ path: file.name, data: new Uint8Array(buffer) }),
          () => settle(null),
        );
      });
      // Современные браузеры сообщают об отмене выбора событием `cancel`.
      input.addEventListener('cancel', () => settle(null));

      document.body.append(input);

      if (hasUserActivation()) {
        // Диалог открывается в рамках жеста пользователя (клик по команде).
        input.click();
        return;
      }
      // Пока пользователь искал предыдущий файл, браузер мог сбросить
      // кратковременную активацию — тогда программный `input.click()`
      // молча игнорируется. Запрашиваем выбор кнопкой: её нажатие даёт
      // браузеру свежий жест и открывает диалог.
      closePrompt = promptForFile(
        title ?? t('file.choose'),
        () => {
          closePrompt?.();
          closePrompt = null;
          input.click();
        },
        () => settle(null),
      );
    });
  },
  async saveFile({ defaultName, data }) {
    const blob = new Blob([data as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return defaultName;
  },
};

/** Создаёт скрытый `<input type=file>` под указанные фильтры. */
function createFileInput(filters: FileFilter[]): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = filters
    .flatMap((f) => f.patterns)
    .map((p) => p.replace('*', ''))
    .join(',');
  input.style.display = 'none';
  return input;
}

/**
 * Есть ли у страницы кратковременная активация для показа диалога.
 *
 * Если API недоступен (старые браузеры, jsdom) — считаем, что диалог
 * показывать можно.
 */
function hasUserActivation(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } })
    .userActivation;
  return activation ? activation.isActive : true;
}

/**
 * Показывает запрос на выбор файла с кнопкой, когда браузер заблокировал
 * программное открытие диалога. Возвращает функцию закрытия запроса.
 */
function promptForFile(title: string, onPick: () => void, onCancel: () => void): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.dataset.testid = 'file-prompt';

  const card = document.createElement('div');
  card.className = 'dialog';

  const heading = document.createElement('div');
  heading.className = 'dialog-title';
  heading.textContent = title;

  const body = document.createElement('div');
  body.className = 'dialog-body';
  const hint = document.createElement('p');
  hint.className = 'dialog-hint';
  hint.textContent = t('file.pickHint');
  body.append(hint);

  const footer = document.createElement('div');
  footer.className = 'dialog-footer';
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.dataset.testid = 'file-prompt-cancel';
  cancelButton.textContent = t('common.cancel');
  cancelButton.addEventListener('click', onCancel);
  const pickButton = document.createElement('button');
  pickButton.type = 'button';
  pickButton.dataset.testid = 'file-pick';
  pickButton.textContent = t('file.choose');
  pickButton.addEventListener('click', onPick);
  footer.append(cancelButton, pickButton);

  card.append(heading, body, footer);
  overlay.append(card);
  document.body.append(overlay);

  return () => overlay.remove();
}

let backend: FileBackend | null = null;

/** Возвращает активный файловый бэкенд (Tauri или браузерный). */
export function getFileBackend(): FileBackend {
  if (!backend) backend = isTauri() ? tauriBackend : browserBackend;
  return backend;
}

/** Подменяет файловый бэкенд (используется в тестах). Возвращает предыдущий. */
export function setFileBackend(next: FileBackend | null): FileBackend | null {
  const previous = backend;
  backend = next;
  return previous;
}

// ---------------------------------------------------------------------------
// Операции над документами
// ---------------------------------------------------------------------------

/** Результат открытия документа. */
export interface OpenedDocument {
  path: string;
  doc: PlotterDocument;
}

/**
 * Открывает документ через системный диалог.
 *
 * @returns путь и документ, либо `null` при отмене
 * @throws если файл не является документом Plotter
 */
export async function openDocumentFile(
  options?: { filters?: FileFilter[]; title?: string; backend?: FileBackend },
): Promise<OpenedDocument | null> {
  const b = options?.backend ?? getFileBackend();
  const opened = await b.openFile({
    filters: options?.filters ?? [...OPEN_FILE_FILTERS],
    title: options?.title,
  });
  if (!opened) return null;
  return { path: opened.path, doc: readByPath(opened.path, opened.data) };
}

/**
 * Сохраняет документ через системный диалог сохранения.
 *
 * @returns сохранённый путь либо `null` при отмене
 */
export async function saveDocumentFile(
  doc: PlotterDocument,
  options?: { defaultName?: string; filters?: FileFilter[]; backend?: FileBackend },
): Promise<string | null> {
  const b = options?.backend ?? getFileBackend();
  const data = writeDocument(doc);
  return b.saveFile({
    filters: options?.filters ?? [
      {
        label: FILE_EXTENSIONS[doc.kind],
        patterns: [`*${FILE_EXTENSIONS[doc.kind]}`],
      },
    ],
    defaultName: options?.defaultName ?? defaultFileName(doc),
    data,
  });
}
