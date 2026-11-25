import type { PlotterDocument } from '@/core/model';

/**
 * `store/shell` — состояние оболочки приложения (spec: app-shell).
 *
 * Реестр открытых документов (каждый — вкладка одного окна), активный документ
 * и список последних файлов. Список последних файлов переживает перезапуск
 * (localStorage с резервным in-memory хранилищем), открытые документы — нет
 * (сеансовое состояние).
 *
 * Современная оболочка намеренно не хранит раскладку MDI-окон
 * (каскад/мозаика) и видимость панелей: панель команд и строка состояния
 * показываются всегда.
 */

/** Максимальное число записей списка последних файлов. */
export const RECENT_FILES_LIMIT = 16;

/** Открытый документ (вкладка окна) с рабочим состоянием. */
export interface OpenDocument {
  /** Устойчивый идентификатор вкладки документа. */
  id: string;
  /** Путь к файлу (пустая строка — ещё не сохранён). */
  path: string;
  /** Документ предметной области. */
  doc: PlotterDocument;
  /** Есть несохранённые изменения. */
  dirty: boolean;
  /** Активная внутренняя вкладка документа. */
  activeTab: string;
}

/** Состояние оболочки. */
export interface ShellState {
  documents: OpenDocument[];
  activeId: string | null;
  recentFiles: string[];
}

const RECENT_KEY = 'plotter.recentFiles';

const memoryStore = new Map<string, string>();

function storageGet(key: string): string | null {
  try {
    const value = globalThis.localStorage?.getItem(key);
    if (value !== undefined && value !== null) return value;
  } catch {
    /* хранилище недоступно */
  }
  return memoryStore.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  memoryStore.set(key, value);
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* хранилище недоступно — значение остаётся в памяти */
  }
}

/** Разбирает список последних файлов, отбрасывая некорректные записи. */
export function parseRecentFiles(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.length > 0)
      .slice(0, RECENT_FILES_LIMIT);
  } catch {
    return [];
  }
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `doc_${seq}`;
}

const listeners = new Set<() => void>();

/** Начальная активная вкладка документа по типу документа (spec: app-shell). */
export function initialTabFor(doc: PlotterDocument, existedOnDisk: boolean): string {
  if (doc.kind === 'matcher') return 'info';
  // Новый документ → вкладка Data; открытый с диска → Family.
  return existedOnDisk ? 'family' : 'data';
}

/** Список внутренних вкладок документа по его типу. */
export function tabsFor(doc: PlotterDocument): readonly string[] {
  return doc.kind === 'matcher'
    ? ['info', 'film', 'paper', 'compare']
    : ['family', 'data', 'analyze', 'charts'];
}

/** Отображаемое имя документа (для вкладки и строки состояния). */
export function documentTitle(entry: OpenDocument, untitled: string): string {
  if (entry.doc.kind === 'matcher') {
    return entry.doc.filmRef.name || entry.doc.paperRef.name || untitled;
  }
  return entry.doc.family.name || untitled;
}

let state: ShellState = {
  documents: [],
  activeId: null,
  recentFiles: parseRecentFiles(storageGet(RECENT_KEY)),
};

function notify(): void {
  for (const listener of listeners) listener();
}

/** Подписка на изменение состояния оболочки. Возвращает функцию отписки. */
export function subscribeShell(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Текущее состояние оболочки (только чтение). */
export function getShellState(): ShellState {
  return state;
}

/** Открытые документы. */
export function getDocuments(): OpenDocument[] {
  return state.documents;
}

/** Активный документ (или `null`, если открытых вкладок нет). */
export function getActiveDocument(): OpenDocument | null {
  return state.documents.find((entry) => entry.id === state.activeId) ?? null;
}

/** Делает вкладку документа активной. */
export function setActiveDocument(id: string): void {
  if (!state.documents.some((entry) => entry.id === id)) return;
  state = { ...state, activeId: id };
  notify();
}

/** Меняет активную внутреннюю вкладку документа. */
export function setActiveTab(id: string, tab: string): void {
  state = {
    ...state,
    documents: state.documents.map((entry) =>
      entry.id === id ? { ...entry, activeTab: tab } : entry,
    ),
  };
  notify();
}

/**
 * Регистрирует открытый документ и делает его активным.
 *
 * @param doc    документ предметной области
 * @param path   путь к файлу (пустая строка — новый документ)
 */
export function openDocument(doc: PlotterDocument, path = ''): OpenDocument {
  const existedOnDisk = path.length > 0;
  const entry: OpenDocument = {
    id: nextId(),
    path,
    doc,
    dirty: false,
    activeTab: initialTabFor(doc, existedOnDisk),
  };
  state = {
    ...state,
    documents: [...state.documents, entry],
    activeId: entry.id,
    recentFiles: existedOnDisk ? pushRecent(state.recentFiles, path) : state.recentFiles,
  };
  if (existedOnDisk) storageSet(RECENT_KEY, JSON.stringify(state.recentFiles));
  notify();
  return entry;
}

/** Заменяет документ в вкладке (после правки) и помечает изменения. */
export function updateDocument(id: string, doc: PlotterDocument, dirty = true): void {
  state = {
    ...state,
    documents: state.documents.map((entry) => (entry.id === id ? { ...entry, doc, dirty } : entry)),
  };
  notify();
}

/** Отмечает документ сохранённым и обновляет путь. */
export function markSaved(id: string, path: string): void {
  state = {
    ...state,
    documents: state.documents.map((entry) =>
      entry.id === id ? { ...entry, path, dirty: false } : entry,
    ),
    recentFiles: pushRecent(state.recentFiles, path),
  };
  storageSet(RECENT_KEY, JSON.stringify(state.recentFiles));
  notify();
}

/** Закрывает вкладку документа; активной становится соседняя. */
export function closeDocument(id: string): void {
  const index = state.documents.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const documents = state.documents.filter((entry) => entry.id !== id);
  let activeId = state.activeId;
  if (activeId === id) {
    const neighbour = documents[index] ?? documents[index - 1] ?? null;
    activeId = neighbour ? neighbour.id : null;
  }
  state = { ...state, documents, activeId };
  notify();
}

/** Список последних файлов, выбранный файл — первым. */
export function pushRecent(list: readonly string[], path: string): string[] {
  const next = [path, ...list.filter((item) => item !== path)];
  return next.slice(0, RECENT_FILES_LIMIT);
}

/** Добавляет файл в начало списка последних. */
export function addRecentFile(path: string): void {
  state = { ...state, recentFiles: pushRecent(state.recentFiles, path) };
  storageSet(RECENT_KEY, JSON.stringify(state.recentFiles));
  notify();
}

/** Очищает список последних файлов. */
export function clearRecentFiles(): void {
  state = { ...state, recentFiles: [] };
  storageSet(RECENT_KEY, JSON.stringify(state.recentFiles));
  notify();
}

/** Сбрасывает состояние оболочки (тесты и выход из программы). */
export function resetShell(): void {
  state = {
    documents: [],
    activeId: null,
    recentFiles: [],
  };
  memoryStore.delete(RECENT_KEY);
  try {
    globalThis.localStorage?.removeItem(RECENT_KEY);
  } catch {
    /* хранилище недоступно */
  }
  notify();
}
