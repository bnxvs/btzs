import { AnalysisMethod, DEFAULTS, ReferenceCurveType } from '@/core/model';
import { createFilmDocument, createPaperDocument } from '@/core/model';
import type {
  AnalysisMethod as AnalysisMethodType,
  FilmDocument,
  PaperDocument,
  ReferenceCurveType as ReferenceCurveTypeType,
} from '@/core/model';

/**
 * `store/options` — персональные значения по умолчанию окна «Options».
 *
 * Spec (program-options / «Options persistence and scope»): изменения в окне
 * Options сохраняются как персональные значения и используются при создании
 * новых документов; локальные изменения внутри окна документа действуют только
 * на текущий документ.
 *
 * Хранение — в `localStorage` с резервным in-memory хранилищем (как у
 * `store/step-tablets`).
 */

/** Ключ хранилища персональных значений по умолчанию. */
export const OPTIONS_STORAGE_KEY = 'plotter.options';

/** Значения по умолчанию группы «Analysis». */
export interface AnalysisDefaults {
  method: AnalysisMethodType;
  es: number;
  flareDensity: number;
  zoneSpread: number;
  personalSpeedPoint: number;
}

/** Значения по умолчанию группы «Display». */
export interface DisplayDefaults {
  displayInformation: boolean;
  smoothCurves: boolean;
  colorCurves: boolean;
  displayGrid: boolean;
}

/** Значения по умолчанию группы «Display and printing options». */
export interface PrintingDefaults {
  printAllChartsOnSamePage: boolean;
  gridLineWidth: number;
  printGridLineWidth: number;
}

/** Значения по умолчанию группы «Matcher». */
export interface MatcherDefaults {
  referenceCurveType: ReferenceCurveTypeType;
}

/** Персональные значения по умолчанию программы. */
export interface ProgramOptions {
  analysis: AnalysisDefaults;
  display: DisplayDefaults;
  printing: PrintingDefaults;
  matcher: MatcherDefaults;
}

/** Значения по умолчанию программы (совпадают со значениями из справки). */
export function defaultOptions(): ProgramOptions {
  return {
    analysis: {
      method: DEFAULTS.analysisMethod,
      es: DEFAULTS.paperEs,
      flareDensity: DEFAULTS.flareDensity,
      zoneSpread: DEFAULTS.zoneSpread,
      personalSpeedPoint: DEFAULTS.personalSpeedPoint,
    },
    display: {
      displayInformation: DEFAULTS.displayInformation,
      smoothCurves: DEFAULTS.smoothCurves,
      colorCurves: DEFAULTS.colorCurves,
      displayGrid: DEFAULTS.displayGrid,
    },
    printing: {
      printAllChartsOnSamePage: DEFAULTS.printAllChartsOnSamePage,
      gridLineWidth: DEFAULTS.gridLineWidth,
      printGridLineWidth: DEFAULTS.printGridLineWidth,
    },
    matcher: {
      referenceCurveType: ReferenceCurveType.Default,
    },
  };
}

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

/** Копия значений по умолчанию (глубокая, чтобы не делиться объектами). */
function clone(options: ProgramOptions): ProgramOptions {
  return {
    analysis: { ...options.analysis },
    display: { ...options.display },
    printing: { ...options.printing },
    matcher: { ...options.matcher },
  };
}

function isAnalysisMethod(value: unknown): value is AnalysisMethodType {
  return value === AnalysisMethod.ApproximateCI || value === AnalysisMethod.OverFbF;
}

function isReferenceCurveType(value: unknown): value is ReferenceCurveTypeType {
  return (
    value === ReferenceCurveType.Default ||
    value === ReferenceCurveType.Flared ||
    value === ReferenceCurveType.Loaded
  );
}

/**
 * Разбирает сохранённые опции, заменяя отсутствующие/испорченные поля
 * значениями по умолчанию (по каждой группе отдельно).
 */
export function parseOptions(raw: string | null): ProgramOptions {
  const defaults = defaultOptions();
  if (!raw) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!parsed || typeof parsed !== 'object') return defaults;
  const source = parsed as Partial<Record<keyof ProgramOptions, Record<string, unknown>>>;
  const num = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const bool = (value: unknown, fallback: boolean) =>
    typeof value === 'boolean' ? value : fallback;
  const analysis = source.analysis ?? {};
  const display = source.display ?? {};
  const printing = source.printing ?? {};
  const matcher = source.matcher ?? {};
  return {
    analysis: {
      method: isAnalysisMethod(analysis.method) ? analysis.method : defaults.analysis.method,
      es: num(analysis.es, defaults.analysis.es),
      flareDensity: num(analysis.flareDensity, defaults.analysis.flareDensity),
      zoneSpread: num(analysis.zoneSpread, defaults.analysis.zoneSpread),
      personalSpeedPoint: num(analysis.personalSpeedPoint, defaults.analysis.personalSpeedPoint),
    },
    display: {
      displayInformation: bool(display.displayInformation, defaults.display.displayInformation),
      smoothCurves: bool(display.smoothCurves, defaults.display.smoothCurves),
      colorCurves: bool(display.colorCurves, defaults.display.colorCurves),
      displayGrid: bool(display.displayGrid, defaults.display.displayGrid),
    },
    printing: {
      printAllChartsOnSamePage: bool(
        printing.printAllChartsOnSamePage,
        defaults.printing.printAllChartsOnSamePage,
      ),
      gridLineWidth: num(printing.gridLineWidth, defaults.printing.gridLineWidth),
      printGridLineWidth: num(printing.printGridLineWidth, defaults.printing.printGridLineWidth),
    },
    matcher: {
      referenceCurveType: isReferenceCurveType(matcher.referenceCurveType)
        ? matcher.referenceCurveType
        : defaults.matcher.referenceCurveType,
    },
  };
}

let current: ProgramOptions = parseOptions(storageGet(OPTIONS_STORAGE_KEY));

const listeners = new Set<() => void>();

/** Текущие персональные значения по умолчанию. */
export function getOptions(): ProgramOptions {
  return clone(current);
}

/** Сохраняет переданные опции как персональные значения по умолчанию. */
export function saveOptions(options: ProgramOptions): ProgramOptions {
  current = clone(options);
  storageSet(OPTIONS_STORAGE_KEY, JSON.stringify(current));
  for (const listener of listeners) listener();
  return clone(current);
}

/** Обновляет часть опций (частичное слияние по группам). */
export function setOptions(patch: Partial<ProgramOptions>): ProgramOptions {
  const next: ProgramOptions = {
    analysis: { ...current.analysis, ...patch.analysis },
    display: { ...current.display, ...patch.display },
    printing: { ...current.printing, ...patch.printing },
    matcher: { ...current.matcher, ...patch.matcher },
  };
  return saveOptions(next);
}

/** Восстанавливает все опции к значениям по умолчанию. */
export function restoreDefaultOptions(): ProgramOptions {
  return saveOptions(defaultOptions());
}

/** Восстанавливает опции к значениям по умолчанию без записи в хранилище (тесты). */
export function resetOptionsToDefaults(): ProgramOptions {
  current = defaultOptions();
  memoryStore.delete(OPTIONS_STORAGE_KEY);
  try {
    globalThis.localStorage?.removeItem(OPTIONS_STORAGE_KEY);
  } catch {
    /* хранилище недоступно */
  }
  return clone(current);
}

/** Подписка на изменение опций. Возвращает функцию отписки. */
export function subscribeOptions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Параметры анализа нового документа по персональным значениям по умолчанию.
 *
 * Используется при создании документов (`createNewFilm`/`createNewPaper`),
 * чтобы новые файлы наследовали значения Options.
 */
export function analysisParamsFromOptions(options: ProgramOptions = current) {
  return {
    method: options.analysis.method,
    es: options.analysis.es,
    flareDensity: options.analysis.flareDensity,
    expAdj: 0,
    zoneSpread: options.analysis.zoneSpread,
    personalSpeedPoint: options.analysis.personalSpeedPoint,
    usePersonalSpeedPoint: false,
    idminPercent: DEFAULTS.idminPercent,
  };
}

/**
 * Создаёт новый документ плёнки с параметрами анализа из персональных значений
 * по умолчанию (spec: program-options / «Сохранение персональных значений по
 * умолчанию»).
 */
export function createNewFilm(): FilmDocument {
  return { ...createFilmDocument(), analysisParams: analysisParamsFromOptions() };
}

/** Создаёт новый документ бумаги с параметрами анализа из значений по умолчанию. */
export function createNewPaper(): PaperDocument {
  return { ...createPaperDocument(), analysisParams: analysisParamsFromOptions() };
}
