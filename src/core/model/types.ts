import type {
  AnalysisMethod,
  DocumentKind,
  ReferenceCurveType,
  TemperatureUnit,
  ToeClass,
} from './constants';

/** Одна точка кривой: номер ступени клина и измеренная плотность. */
export interface CurvePoint {
  /** Номер ступени (0-based). */
  step: number;
  /** Плотность. */
  density: number;
}

/** Кривая плёнки или бумаги. */
export interface Curve {
  /** Отображаемое имя: время проявления (плёнка) либо ID/Name (бумага). */
  label: string;
  /** Примечание к кривой. */
  note: string;
  /** Точки кривой. */
  points: CurvePoint[];
  /**
   * Сохранённые «как есть» байты, значение которых не понято реверсом.
   * Нужны для round-trip без потерь.
   */
  reserved: number[];
  /** Флажок «Don't connect in chart». */
  dontConnectInChart: boolean;
  /** Признак приближённой (approx) кривой для Matcher. */
  approximated?: {
    by: 'sbr' | 'g';
    value: number;
    outOfRange?: boolean;
  };
}

/** Ступенчатый клин: плотности ступеней. */
export interface StepTablet {
  /** Плотности ступеней по порядку, начиная со ступени 0. */
  densities: number[];
}

/** Параметры семейства кривых плёнки. */
export interface FilmFamilyDetails {
  date: string;
  name: string;
  filmIso: number;
  developer: string;
  dilution: string;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  volume: string;
  agitation: string;
  notes: string;
}

/** Параметры семейства кривых бумаги. */
export interface PaperFamilyDetails {
  date: string;
  name: string;
  printMethod: string;
  developer: string;
  dilution: string;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  developingTime: string;
  toner: string;
  drying: string;
  notes: string;
}

/**
 * Сохранённый «сырой» заголовок формата (0x0c..0x48) и прочие поля, семантика
 * которых не подтверждена. Сохраняются для побайтового round-trip.
 */
export interface RawHeader {
  /** Блок 0x0c..0x48 как есть. */
  settings: number[];
  /** Значение u32 в 0x08 (104/103). */
  marker: number;
  /** f32 версии формата, следующее после строк. */
  formatVersion: number;
  /** u32 ISO-значение в заголовке (плёнка и бумага). */
  iso: number;
  /** u32 флаг после температуры. */
  flag: number;
}

/** Параметры анализа (по умолчанию общие, но могут храниться в документе). */
export interface AnalysisParams {
  method: AnalysisMethod;
  /** Значение ES (экспозиционная шкала). */
  es: number;
  /** Плотность вуали. */
  flareDensity: number;
  /** Коррекция экспозиции в стопах. */
  expAdj: number;
  /** Разброс зон (для N-чисел). */
  zoneSpread: number;
  /** Персональная точка скорости. */
  personalSpeedPoint: number;
  /** Использовать персональную точку скорости. */
  usePersonalSpeedPoint: boolean;
  /** IDmin % (для бумаги). */
  idminPercent: number;
}

/** Документ плёнки. */
export interface FilmDocument {
  kind: 'film';
  rawHeader: RawHeader;
  family: FilmFamilyDetails;
  stepTablet: StepTablet;
  curves: Curve[];
  analysisParams: AnalysisParams;
}

/** Документ бумаги. */
export interface PaperDocument {
  kind: 'paper';
  rawHeader: RawHeader;
  family: PaperFamilyDetails;
  stepTablet: StepTablet;
  curves: Curve[];
  analysisParams: AnalysisParams;
}

/** Сохранённое для сравнения сопоставление. */
export interface SavedMatch {
  name: string;
  filmLabel: string;
  paperLabel: string;
  /** Точки совмещённой кривой (пленка+бумага), как сохранены. */
  points: CurvePoint[];
  /** Источник сопоставления: сохранено в текущем документе или загружено извне. */
  source?: 'current' | 'external';
  /**
   * Признак обрезки: сопоставление нельзя масштабировать к общему диапазону
   * плотностей (например, все плотности одинаковы), поэтому при сравнении оно
   * обрезается (spec: matcher / «Нормализация сравниваемых сопоставлений»).
   */
  clipped?: boolean;
}

/** Ссылка на внешний файл (для Matcher). */
export interface FileReference {
  /** Сохранённый путь/имя файла как строка из формата. */
  path: string;
  /** Базовое имя файла (для отображения). */
  name: string;
  /**
   * Код ссылки из формата `.pmf` (наблюдались 0 для плёнки и 5 для бумаги);
   * семантика не подтверждена, сохраняется как есть.
   */
  code: number;
  /** Время изменения исходного файла (Unix-секунды). */
  modifiedAt?: number;
}

/**
 * Приближённая кривая плёнки в документе Matcher (создаётся по значению
 * SBR или средней G).
 */
export interface MatcherApproximatedCurve {
  /** Точка расчёта: по SBR или по средней G. */
  by: 'sbr' | 'g';
  /** Запрошенное значение SBR или средней G. */
  value: number;
  /** Метка как сохранена в файле (например, «SBR ~ 7.00»). */
  label: string;
  /** Точки приближённой кривой. */
  points: CurvePoint[];
  /** Непонятые байты записи (для потерь-совместимого round-trip). */
  reserved: number[];
  /**
   * Признак «(approx. is out of range)»: после изменения параметров анализа
   * запрошенное значение SBR/G более не помещается в диапазон семейства, и
   * кривая не пересчитывается (spec: matcher / «Динамический пересчёт
   * приближённых кривых»).
   */
  outOfRange?: boolean;
}

/**
 * Сохранённый «сырой» заголовок `.pmf`; поля, семантика которых не
 * подтверждена, сохраняются для побайтового round-trip.
 */
export interface MatcherRawHeader {
  /** Байт версии внутри магии (8-й байт после «BTZSPAP»; в образце 0x92). */
  magicVersion: number;
  /** u32 после магии — версия `.pmf` (в образце 5). */
  version: number;
  /** u32 после версии (в образце 1). */
  constValue: number;
  /** Неизвестный блок между ссылками на файлы и приближёнными кривыми. */
  middle: number[];
  /** Замыкающий u32 в конце файла (в образце 0). */
  trailing: number;
}

/** Документ Matcher. */
export interface MatcherDocument {
  kind: 'matcher';
  rawHeader: MatcherRawHeader;
  filmRef: FileReference;
  paperRef: FileReference;
  /** Выбранные кривые плёнки и бумаги (индексы). */
  selectedFilmCurve: number;
  selectedPaperCurve: number;
  referenceCurveType: ReferenceCurveType;
  /** Эталонные плотности (серые), как сохранены в заголовке `.pmf`. */
  referenceCurveGrays: number[];
  /** Загруженная пользователем эталонная кривая. */
  loadedReferenceCurve?: Curve;
  /** Приближённые кривые плёнки, сохранённые в документе. */
  approximatedCurves: MatcherApproximatedCurve[];
  /** Сохранённые для сравнения сопоставления. */
  savedMatches: SavedMatch[];
  /** Кэш исходных данных (плёнка/бумага), если загружены. */
  film?: FilmDocument;
  paper?: PaperDocument;
  analysisParams: AnalysisParams;
  /** Признак переопределения параметров анализа. */
  analysisOverridden: boolean;
  /** «Lock Film DR = ES». */
  lockFilmDrToEs: boolean;
}

/** Любой документ Plotter. */
export type PlotterDocument = FilmDocument | PaperDocument | MatcherDocument;

/** Общая проверка: документ относится к указанному виду. */
export function isDocumentKind<K extends DocumentKind>(
  doc: PlotterDocument,
  kind: K,
): doc is Extract<PlotterDocument, { kind: K }> {
  return doc.kind === kind;
}

/** Пустой клин на 21 ступень (заполняется из файла или значения по умолчанию). */
export function emptyStepTablet(count = 21): StepTablet {
  return { densities: Array.from({ length: count }, () => 0) };
}

/** Класс носка, выводимый из значения ES (утилита отображения). */
export interface ToeClassification {
  toeClass: ToeClass;
  /** Номер класса бумаги. */
  grade?: number;
}
