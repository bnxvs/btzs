import { AnalysisMethod, DEFAULTS, ReferenceCurveType, TemperatureUnit } from './constants';
import type {
  FileReference,
  FilmDocument,
  MatcherDocument,
  PaperDocument,
  RawHeader,
} from './types';
import { STEP_COUNT, defaultStepTabletDensities } from './curve-ops';

/**
 * Фабрики новых документов плёнки и бумаги.
 *
 * Значения по умолчанию соответствуют окну New исходного приложения:
 * дата — сегодняшняя (в формате ММ/ДД/ГГГГ, как в образцах), клин —
 * стандартный 21-ступенчатый, параметры анализа — из `DEFAULTS`.
 */

/** Номинальный ISO-класс бумаги по умолчанию в заголовке. */
const DEFAULT_PAPER_ISO = 0;

/** Номинальный ISO плёнки по умолчанию для нового документа. */
const DEFAULT_FILM_ISO = 100;

/** Маркеры формата: 104 — современная плёнка, 103 — бумага. */
const FILM_MARKER = 104;
const PAPER_MARKER = 103;

/**
 * Блок настроек заголовка (0x0c..0x48) нового документа: значения по
 * умолчанию, наблюдаемые в образцах (f64 0.9; f64 1.0; u32 1, 4, 1;
 * остальное — нули). Семантика полей не подтверждена реверсом (см.
 * `docs/btzs-format.md`), поэтому для новых документов берётся типовой
 * набор, а для открытых файлов блок сохраняется «как есть».
 */
function defaultSettings(): number[] {
  const settings = Array.from({ length: 0x48 - 0x0c }, () => 0);
  const writeF64 = (offset: number, value: number) => {
    const buf = new DataView(new ArrayBuffer(8));
    buf.setFloat64(0, value, true);
    for (let i = 0; i < 8; i++) settings[offset + i] = buf.getUint8(i);
  };
  const writeU32 = (offset: number, value: number) => {
    settings[offset] = value & 0xff;
    settings[offset + 1] = (value >>> 8) & 0xff;
    settings[offset + 2] = (value >>> 16) & 0xff;
    settings[offset + 3] = (value >>> 24) & 0xff;
  };
  writeF64(0, 0.9);
  writeF64(0x18, 1.0);
  writeU32(0x20, 1);
  writeU32(0x24, 4);
  writeU32(0x28, 1);
  return settings;
}

/** Параметры анализа нового документа (общие значения по умолчанию). */
function defaultParams() {
  return {
    method: AnalysisMethod.ApproximateCI,
    es: DEFAULTS.paperEs,
    flareDensity: DEFAULTS.flareDensity,
    expAdj: 0,
    zoneSpread: DEFAULTS.zoneSpread,
    personalSpeedPoint: DEFAULTS.personalSpeedPoint,
    usePersonalSpeedPoint: false,
    idminPercent: DEFAULTS.idminPercent,
  };
}

/** Сегодняшняя дата в формате ММ/ДД/ГГГГ (как в образцах файлов). */
export function todayString(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function rawHeader(marker: number, iso: number): RawHeader {
  return {
    settings: defaultSettings(),
    marker,
    formatVersion: 1,
    iso,
    flag: 1,
  };
}

/** Создаёт новый документ плёнки. */
export function createFilmDocument(overrides?: Partial<FilmDocument['family']>): FilmDocument {
  return {
    kind: 'film',
    rawHeader: rawHeader(FILM_MARKER, DEFAULT_FILM_ISO),
    family: {
      date: todayString(),
      name: '',
      filmIso: 100,
      developer: '',
      dilution: '',
      temperature: 68,
      temperatureUnit: TemperatureUnit.Fahrenheit,
      volume: '',
      agitation: '',
      notes: '',
      ...overrides,
    },
    stepTablet: { densities: defaultStepTabletDensities(STEP_COUNT) },
    curves: [],
    analysisParams: defaultParams(),
  };
}

/** Создаёт новый документ бумаги. */
export function createPaperDocument(overrides?: Partial<PaperDocument['family']>): PaperDocument {
  return {
    kind: 'paper',
    rawHeader: rawHeader(PAPER_MARKER, DEFAULT_PAPER_ISO),
    family: {
      date: todayString(),
      name: '',
      printMethod: 'contact',
      developer: '',
      dilution: '',
      temperature: 68,
      temperatureUnit: TemperatureUnit.Fahrenheit,
      developingTime: '',
      toner: '',
      drying: '',
      notes: '',
      ...overrides,
    },
    stepTablet: { densities: defaultStepTabletDensities(STEP_COUNT) },
    curves: [],
    analysisParams: defaultParams(),
  };
}

/** Байт версии внутри магии `.pmf` (наблюден 0x92 в образце). */
const MATCHER_MAGIC_VERSION = 0x92;
/** Версия `.pmf` после магии (наблюдена 5). */
const MATCHER_VERSION = 5;
/** u32 после версии (наблюдено 1). */
const MATCHER_CONST = 1;
/** Размер непонятого блока между ссылками и приближёнными кривыми. */
const MATCHER_MIDDLE_SIZE = 48;
/** Эталонные серые нового Matcher-документа (стандартная кривая). */
const MATCHER_DEFAULT_GRAYS = [
  0.04, 1.885, 0.04, 0.1116, 0.2531, 0.5011, 0.8755, 1.3001, 1.6474, 1.885,
];

/** Ссылка на исходный файл по пути (имя — базовое). */
export function fileReference(path: string, code = 0, modifiedAt?: number): FileReference {
  const idx = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return {
    path,
    name: idx >= 0 ? path.slice(idx + 1) : path,
    code,
    modifiedAt,
  };
}

/**
 * Создаёт новый документ Matcher по выбранным документам плёнки и бумаги.
 *
 * Spec (matcher / «Matcher document creation»): выбранные файлы плёнки и бумаги
 * сохраняются как ссылки; параметры анализа берутся из файла бумаги (ES),
 * переопределение — отдельный флаг.
 */
export function createMatcherDocument(
  film: FilmDocument,
  paper: PaperDocument,
  filmPath = '',
  paperPath = '',
  overrides?: Partial<MatcherDocument>,
): MatcherDocument {
  return {
    kind: 'matcher',
    rawHeader: {
      magicVersion: MATCHER_MAGIC_VERSION,
      version: MATCHER_VERSION,
      constValue: MATCHER_CONST,
      middle: Array.from({ length: MATCHER_MIDDLE_SIZE }, () => 0),
      trailing: 0,
    },
    filmRef: fileReference(filmPath || `${film.family.name || 'film'}.pfc`, 0),
    paperRef: fileReference(paperPath || `${paper.family.name || 'paper'}.ppc`, 5),
    selectedFilmCurve: 0,
    selectedPaperCurve: 0,
    referenceCurveType: ReferenceCurveType.Default,
    referenceCurveGrays: [...MATCHER_DEFAULT_GRAYS],
    approximatedCurves: [],
    savedMatches: [],
    film,
    paper,
    analysisParams: { ...paper.analysisParams },
    analysisOverridden: false,
    lockFilmDrToEs: false,
    ...overrides,
  };
}
