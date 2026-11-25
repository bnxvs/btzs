/**
 * Перечисления и константы предметной области Plotter.
 *
 * Значения `as const` используются как строковые литературы и сериализуются
 * как есть; числовые — соответствуют наблюдаемым кодам формата.
 */

/** Метод определения точки скорости кривой плёнки. */
export const AnalysisMethod = {
  /** Приблизительная CI (по умолчанию, «Approximate CI»). */
  ApproximateCI: 'approximate-ci',
  /** «0.1 over FB+F». */
  OverFbF: 'over-fbf',
} as const;
export type AnalysisMethod = (typeof AnalysisMethod)[keyof typeof AnalysisMethod];

/** Тип эталонной кривой Matcher. */
export const ReferenceCurveType = {
  /** Стандартная эталонная кривая без вуали. */
  Default: 'default',
  /** Стандартная эталонная кривая с вуалью (flared). */
  Flared: 'flared',
  /** Пользовательская загруженная кривая. */
  Loaded: 'loaded',
} as const;
export type ReferenceCurveType = (typeof ReferenceCurveType)[keyof typeof ReferenceCurveType];

/** Класс носка кривой бумаги. */
export const ToeClass = {
  Short: 'short',
  Normal: 'normal',
  Long: 'long',
} as const;
export type ToeClass = (typeof ToeClass)[keyof typeof ToeClass];

/** Зона (сюжета, плотности негатива или печати). */
export const ZONE_RANGE = { min: 2, max: 8 } as const;

/** Класс документа. */
export const DocumentKind = {
  Film: 'film',
  Paper: 'paper',
  Matcher: 'matcher',
} as const;
export type DocumentKind = (typeof DocumentKind)[keyof typeof DocumentKind];

/** Единица измерения температуры. */
export const TemperatureUnit = {
  Fahrenheit: 'F',
  Celsius: 'C',
} as const;
export type TemperatureUnit = (typeof TemperatureUnit)[keyof typeof TemperatureUnit];

/** Тип графика плёнки. */
export const FilmChart = {
  DevTimeSbr: 'dev-time-sbr',
  DevTimeG: 'dev-time-g',
  DevTimeN: 'dev-time-n',
  EfsSbr: 'efs-sbr',
  EfsG: 'efs-g',
  EfsN: 'efs-n',
} as const;
export type FilmChart = (typeof FilmChart)[keyof typeof FilmChart];

/** Тип графика бумаги. */
export const PaperChart = {
  IsoRange: 'iso-range',
  PaperGrade: 'paper-grade',
} as const;
export type PaperChart = (typeof PaperChart)[keyof typeof PaperChart];

/**
 * Порядок графиков плёнки в списке панели информации (spec: charts /
 * «Film charts»): сначала группа Dev. Time, затем группа EFS.
 */
export const FILM_CHARTS = [
  'dev-time-sbr',
  'dev-time-g',
  'dev-time-n',
  'efs-sbr',
  'efs-g',
  'efs-n',
] as const satisfies readonly FilmChart[];

/** Порядок графиков бумаги (spec: charts / «Paper charts»). */
export const PAPER_CHARTS = ['iso-range', 'paper-grade'] as const satisfies readonly PaperChart[];

/** Идентификаторы вкладок документов. */
export const FILM_PAPER_TABS = ['family', 'data', 'analyze', 'charts'] as const;
export const MATCHER_TABS = ['info', 'film', 'paper', 'compare'] as const;
export type FilmPaperTab = (typeof FILM_PAPER_TABS)[number];
export type MatcherTab = (typeof MATCHER_TABS)[number];

/** Библиотека эталонных значений по умолчанию (значения Options). */
export const DEFAULTS = {
  paperEs: 1.0,
  flareDensity: 0,
  zoneSpread: 4,
  analysisMethod: AnalysisMethod.ApproximateCI,
  personalSpeedPoint: 2.4,
  idminPercent: 90,
  displayInformation: true,
  smoothCurves: false,
  colorCurves: true,
  displayGrid: true,
  printAllChartsOnSamePage: true,
  gridLineWidth: 1,
  printGridLineWidth: 1,
  temperatureUnit: TemperatureUnit.Fahrenheit,
  maxComparisons: 15,
} as const;

/** Ограничения предметной области. */
export const LIMITS = {
  /** Стандартное число ступеней денситометрического клина. */
  stepCount: 21,
  /** Максимальное число сохранённых для сравнения сопоставлений. */
  maxComparisons: 15,
} as const;

/** Расширения файлов по типам документов. */
export const FILE_EXTENSIONS = {
  film: '.pfc',
  paper: '.ppc',
  matcher: '.pmf',
} as const;

/** Магия файлов формата BTZS. */
export const FILE_MAGIC = {
  film: 'BTZSFILM',
  paper: 'BTZSPAPR',
  /** Магия Matcher/эталонной кривой. */
  matcher: 'BTZSPAP',
} as const;

/** Порог плотности (relative paper speed, ISO paper speed), по которому
 * определяется относительная светочувствительность бумаги. */
export const PAPER_SPEED_DENSITY = 0.6;

/**
 * Сведения о продукте (для заголовка окна и окна «О программе»).
 *
 * Источник — ресурсы версии `Plotter.exe`: `ProductName` «Plotter for
 * Windows», `FileDescription` «Plotter for Windows 1.2», `LegalCopyright`
 * «Copyright (C) 1999-2003 Phil Davis», `CompanyName` «The View Camera Store».
 * Отображаемая версия — 1.2 (спека app-shell / «Окно About»).
 */
export const PRODUCT = {
  /** Название продукта. */
  name: 'Plotter for Windows',
  /** Короткая версия для интерфейса. */
  version: '1.2',
  /** Полная строка заголовка окна. */
  title: 'Plotter for Windows v1.2',
  /** Организация. */
  company: 'The View Camera Store',
  /** Копирайт. */
  copyright: 'Copyright (C) 1999-2003 Phil Davis',
  /** Автор. */
  author: 'Phil Davis',
  /** Сайт BTZS.org (пункт меню «Go to www.BTZS.org…»). */
  website: 'http://www.BTZS.org',
} as const;

/** Номинальная точка скорости ISO по умолчанию (Personal Speed Point). */
export const DEFAULT_PERSONAL_SPEED_POINT = 2.4;
