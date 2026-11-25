import { LIMITS, ReferenceCurveType } from '@/core/model';
import type {
  AnalysisParams,
  Curve,
  CurvePoint,
  FilmDocument,
  MatcherApproximatedCurve,
  MatcherDocument,
  PaperDocument,
  SavedMatch,
} from '@/core/model';
import { analyzeFilm, analyzeFilmCurve } from './film';
import type { FilmCurveAnalysis } from './film';
import { analyzePaper, analyzePaperCurve } from './paper';
import type { PaperCurveAnalysis } from './paper';
import { buildSamples } from './curve';
import type { FamilyPlot, FamilySeries } from './family';

/**
 * Расчётное ядро Matcher (spec: matcher).
 *
 * Чистые функции без UI:
 *  - приближённые промежуточные кривые плёнки по SBR или средней G
 *    (создание, отказ вне диапазона, динамический пересчёт);
 *  - «Lock Film DR = ES» — перезапись диапазона плотностей плёнки значением ES
 *    выбранной бумажной кривой;
 *  - построение совмещённого сопоставления (зоны негатива → зоны печати);
 *  - нормализация сопоставлений для сравнения (общий диапазон плотностей, обрезка).
 */

/** Стандартная (без вуали) эталонная кривая: [min, max, 8 отсчётов]. */
export const DEFAULT_REFERENCE_GRAYS: readonly number[] = [
  0.04, 1.885, 0.04, 0.1116, 0.2531, 0.5011, 0.8755, 1.3001, 1.6474, 1.885,
];

/**
 * Стандартная эталонная кривая с вуалью (flared): тени подняты смоделированной
 * вуалью, поэтому нижняя часть контура плотнее обычной.
 */
export const FLARED_REFERENCE_GRAYS: readonly number[] = [
  0.05, 1.885, 0.06, 0.134, 0.276, 0.521, 0.889, 1.308, 1.65, 1.885,
];

/** Эталонные плотности стандартной кривой по её типу. */
export function standardReferenceGrays(type: ReferenceCurveType): number[] {
  return [...(type === ReferenceCurveType.Flared ? FLARED_REFERENCE_GRAYS : DEFAULT_REFERENCE_GRAYS)];
}

/** Возможные значения метрики приближения. */
export type ApproximationBy = 'sbr' | 'g';

/** Результат создания/пересчёта приближённой кривой. */
export interface ApproximationResult {
  /** Созданная кривая (с меткой «SBR ~X.xx»/«Ave. G ~X.xx»). */
  curve: Curve;
  /** Запрошенное значение вышло за диапазон семейства. */
  outOfRange: boolean;
}

/** Метрика кривой плёнки, по которой строится приближение. */
function metricOf(by: ApproximationBy, curve: FilmCurveAnalysis): number | undefined {
  return by === 'sbr' ? curve.sbrStops : curve.gBar;
}

/** Метка приближённой кривой по типу и значению. */
export function approximationLabel(by: ApproximationBy, value: number): string {
  const rounded = value.toFixed(2);
  return by === 'sbr' ? `SBR ~ ${rounded}` : `Ave. G ~ ${rounded}`;
}

/** Тип приближения по метке (для обратного разбора из `.pmf`). */
export function approximationByFromLabel(label: string): ApproximationBy | undefined {
  if (/^SBR/i.test(label)) return 'sbr';
  if (/G/i.test(label) && /Ave/i.test(label)) return 'g';
  return undefined;
}

/** Диапазон метрики по семейству плёнки (по её кривым). */
export function familyMetricRange(
  film: FilmDocument,
  by: ApproximationBy,
  params: AnalysisParams,
): { min: number; max: number } | undefined {
  const values: number[] = [];
  for (const curve of film.curves) {
    if (curve.approximated) continue;
    const value = metricOf(by, analyzeFilmCurve(curve, film.stepTablet, params, film.family.filmIso));
    if (value !== undefined && Number.isFinite(value)) values.push(value);
  }
  if (values.length < 2) return undefined;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Создаёт (или пересчитывает) приближённую кривую плёнки.
 *
 * Значение интерполируется между двумя ближайшими кривыми семейства по
 * соответствующей метрике. Если значение вне диапазона семейства — возвращается
 * кривая, помеченная `outOfRange` (пересчёт сохраняет старые точки). Если
 * семейство содержит менее двух пригодных кривых — `undefined`.
 */
export function approximateFilmCurve(
  film: FilmDocument,
  by: ApproximationBy,
  value: number,
  params: AnalysisParams,
  previousPoints?: readonly CurvePoint[],
): ApproximationResult | undefined {
  if (!Number.isFinite(value)) return undefined;
  const entries: { value: number; curve: Curve; metrics: Map<number, number> }[] = [];
  for (const curve of film.curves) {
    if (curve.approximated) continue;
    const analysis = analyzeFilmCurve(curve, film.stepTablet, params, film.family.filmIso);
    const metric = metricOf(by, analysis);
    if (metric === undefined || !Number.isFinite(metric)) continue;
    const metrics = new Map<number, number>();
    for (const point of curve.points) metrics.set(point.step, point.density);
    entries.push({ value: metric, curve, metrics });
  }
  if (entries.length < 2) return undefined;
  entries.sort((a, b) => a.value - b.value);
  const range = { min: entries[0].value, max: entries[entries.length - 1].value };
  const label = approximationLabel(by, value);
  if (value < range.min || value > range.max) {
    return {
      outOfRange: true,
      curve: {
        label,
        note: '',
        points: [...(previousPoints ?? [])],
        reserved: [],
        dontConnectInChart: false,
        approximated: { by, value, outOfRange: true },
      },
    };
  }
  // Ближайшие соседи по метрике.
  let lower = entries[0];
  let upper = entries[entries.length - 1];
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].value >= value) {
      lower = entries[i - 1];
      upper = entries[i];
      break;
    }
  }
  const span = upper.value - lower.value;
  const t = span === 0 ? 0 : (value - lower.value) / span;
  const steps = new Set<number>([...lower.metrics.keys(), ...upper.metrics.keys()]);
  const points: CurvePoint[] = [];
  for (const step of [...steps].sort((a, b) => a - b)) {
    const a = lower.metrics.get(step);
    const b = upper.metrics.get(step);
    const density = a !== undefined && b !== undefined ? a + t * (b - a) : (a ?? b) ?? 0;
    points.push({ step, density });
  }
  return {
    outOfRange: false,
    curve: {
      label,
      note: '',
      points,
      reserved: [],
      dontConnectInChart: false,
      approximated: { by, value },
    },
  };
}

/**
 * Динамически пересчитывает приближённые кривые при изменении параметров.
 *
 * Пересчитываются все приближённые кривые семейства; если запрошенное значение
 * более не помещается в диапазон, кривая не пересчитывается и помечается
 * `outOfRange` (spec: matcher / «Динамический пересчёт приближённых кривых»).
 */
export function recomputeApproximatedCurves(film: FilmDocument): FilmDocument {
  const curves = film.curves.map((curve) => {
    if (!curve.approximated) return curve;
    const result = approximateFilmCurve(
      film,
      curve.approximated.by,
      curve.approximated.value,
      film.analysisParams,
      curve.points,
    );
    return result ? result.curve : curve;
  });
  return { ...film, curves };
}

/** Переводит точку «step, density» в запись приближённой кривой `.pmf`. */
export function curveToApproximated(curve: Curve): MatcherApproximatedCurve {
  const info = curve.approximated ?? { by: 'sbr' as const, value: 0 };
  return {
    by: info.by,
    value: info.value,
    label: curve.label,
    points: curve.points.map((p) => ({ ...p })),
    reserved: [info.by === 'sbr' ? 1 : 2, 0, 0, 1, 0],
    outOfRange: info.outOfRange,
  };
}

/** Восстанавливает приближённую кривую из записи `.pmf`. */
export function approximatedToCurve(record: MatcherApproximatedCurve): Curve {
  return {
    label: record.label,
    note: '',
    points: record.points.map((p) => ({ ...p })),
    reserved: [],
    dontConnectInChart: false,
    approximated: { by: record.by, value: record.value, outOfRange: record.outOfRange },
  };
}

/**
 * «Lock Film DR = ES»: при включённом флажке диапазон плотностей плёнки
 * приравнивается ES выбранной бумажной кривой.
 *
 * @returns параметры анализа с ES, равным ES бумажной кривой (или исходные).
 */
export function applyLockFilmDrToEs(
  params: AnalysisParams,
  lockEnabled: boolean,
  paperCurve: PaperCurveAnalysis | undefined,
): AnalysisParams {
  if (!lockEnabled || paperCurve?.es === undefined) return params;
  return { ...params, es: paperCurve.es };
}

/** Результат построения сопоставления. */
export interface MatchResult {
  name: string;
  filmLabel: string;
  paperLabel: string;
  points: CurvePoint[];
  /** Диапазон плотностей негатива (DR плёнки). */
  filmDr: number;
  /** Экспозиционная шкала бумажной кривой (ES). */
  paperEs: number;
}

/**
 * Строит текущее сопоставление плёнка+бумага.
 *
 * Зоны плотности негатива (2..8), вычисленные по выбранной кривой плёнки,
 * линейно переносятся в диапазон плотностей бумаги: полученные «точки печати»
 * и составляют совмещённую кривую сопоставления.
 */
export function buildMatch(
  film: FilmDocument,
  filmIndex: number,
  paper: PaperDocument,
  paperIndex: number,
  params: AnalysisParams,
): MatchResult | undefined {
  const filmCurve = film.curves[filmIndex];
  const paperCurve = paper.curves[paperIndex];
  if (!filmCurve || !paperCurve) return undefined;
  const filmAnalysis = analyzeFilmCurve(filmCurve, film.stepTablet, params, film.family.filmIso);
  const paperAnalysis = analyzePaperCurve(paperCurve, paper.stepTablet, params);
  if (
    filmAnalysis.speedPointLogE === undefined ||
    filmAnalysis.sbrLog === undefined ||
    paperAnalysis.idMin === undefined ||
    paperAnalysis.dr === undefined
  ) {
    return undefined;
  }
  const samples = buildSamples(filmCurve, film.stepTablet);
  const filmDr = paperAnalysis.es ?? filmAnalysis.sbrLog;
  const points: CurvePoint[] = [];
  for (let zone = 2; zone <= 8; zone++) {
    const logE = filmAnalysis.speedPointLogE + ((zone - 2) / 6) * filmAnalysis.sbrLog;
    const density = densityAtSample(samples, logE);
    points.push({ step: zone, density });
  }
  return {
    name: `${filmCurve.label} + ${paperCurve.label}`,
    filmLabel: filmCurve.label,
    paperLabel: paperCurve.label,
    points,
    filmDr,
    paperEs: paperAnalysis.es ?? 0,
  };
}

/** Плотность выборки в точке logE (линейная интерполяция, без обращения к темам). */
function densityAtSample(samples: readonly { logE: number; density: number }[], logE: number): number {
  if (samples.length === 0) return 0;
  if (logE <= samples[0].logE) return samples[0].density;
  const last = samples[samples.length - 1];
  if (logE >= last.logE) return last.density;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (logE <= b.logE) {
      if (b.logE === a.logE) return b.density;
      const t = (logE - a.logE) / (b.logE - a.logE);
      return a.density + t * (b.density - a.density);
    }
  }
  return last.density;
}

/**
 * Нормализует сопоставления для сравнения: все масштабируются к одинаковому
 * диапазону плотностей, сопоставления с вырожденным диапазоном помечаются как
 * обрезанные (spec: matcher / «Нормализация сравниваемых сопоставлений»).
 */
export function normalizeMatches(matches: readonly SavedMatch[]): SavedMatch[] {
  const withRange = matches.map((match) => {
    const densities = match.points.map((p) => p.density).filter((d) => Number.isFinite(d));
    const min = densities.length ? Math.min(...densities) : 0;
    const max = densities.length ? Math.max(...densities) : 0;
    return { match, min, max, degenerate: max - min <= 1e-9 };
  });
  const finite = withRange.filter((m) => !m.degenerate);
  if (finite.length === 0) {
    return withRange.map((m) => ({ ...m.match, clipped: true }));
  }
  const commonMin = Math.min(...finite.map((m) => m.min));
  const commonMax = Math.max(...finite.map((m) => m.max));
  const commonSpan = commonMax - commonMin || 1;
  return withRange.map((m) => {
    if (m.degenerate) return { ...m.match, clipped: true };
    const span = m.max - m.min;
    const points = m.match.points.map((p) => ({
      ...p,
      density: commonMin + ((p.density - m.min) / span) * commonSpan,
    }));
    return { ...m.match, points, clipped: false };
  });
}

/**
 * Строит график сравнения сопоставлений для вкладки Compare.
 *
 * Spec (matcher / «Нормализация сравниваемых сопоставлений»): сопоставления
 * масштабируются к общему диапазону плотностей, чтобы их можно было сравнить
 * визуально. По оси x откладываются номера зон (2..8), по оси y — плотность;
 * каждая серия — одно сопоставление.
 */
export function buildComparisonPlot(matches: readonly SavedMatch[]): FamilyPlot {
  const series: FamilySeries[] = normalizeMatches(matches).map((match, index) => {
    const points = match.points.map((p) => ({ x: p.step, y: p.density }));
    return {
      index,
      label: match.name,
      points,
      markers: points,
      dontConnect: false,
    };
  });
  return {
    series,
    zones: { zones: [] },
    hasData: series.some((s) => s.points.length > 0),
  };
}

/**
 * Строит текущее сопоставление документа (по выбранным кривым).
 *
 * @returns сопоставление или `undefined`, если кривые не выбраны либо данных
 *          для сопоставления недостаточно
 */
export function currentMatch(doc: MatcherDocument): MatchResult | undefined {
  if (!doc.film || !doc.paper) return undefined;
  return buildMatch(
    doc.film,
    doc.selectedFilmCurve,
    doc.paper,
    doc.selectedPaperCurve,
    doc.analysisParams,
  );
}

/**
 * Сохраняет текущее сопоставление для сравнения.
 *
 * Spec (matcher / «Сохранение текущего сопоставления для сравнения», «Предел
 * числа сравнений»): при достижении 15 сохранённых сопоставлений новое не
 * добавляется.
 */
export function saveCurrentMatchForComparison(
  doc: MatcherDocument,
): { doc: MatcherDocument; error?: 'limit' | 'no-match' } {
  const match = currentMatch(doc);
  if (!match) return { doc, error: 'no-match' };
  if (doc.savedMatches.length >= LIMITS.maxComparisons) return { doc, error: 'limit' };
  const saved: SavedMatch = {
    name: match.name,
    filmLabel: match.filmLabel,
    paperLabel: match.paperLabel,
    points: match.points.map((p) => ({ ...p })),
    source: 'current',
  };
  return { doc: { ...doc, savedMatches: [...doc.savedMatches, saved] } };
}

/** Удаляет сохранённое сопоставление по индексу. */
export function removeSavedMatch(doc: MatcherDocument, index: number): MatcherDocument {
  if (index < 0 || index >= doc.savedMatches.length) return doc;
  return { ...doc, savedMatches: doc.savedMatches.filter((_, i) => i !== index) };
}

/**
 * Загружает внешнее сопоставление из другого документа Matcher.
 *
 * Spec (matcher / «Загрузка внешних сопоставлений»): сопоставление
 * встраивается в текущий документ и более не связано с внешним файлом.
 */
export function loadMatchFromDocument(source: MatcherDocument): SavedMatch | undefined {
  const saved = source.savedMatches[source.savedMatches.length - 1];
  if (saved) {
    return {
      ...saved,
      points: saved.points.map((p) => ({ ...p })),
      source: 'external',
    };
  }
  const match = currentMatch(source);
  if (!match) return undefined;
  return {
    name: match.name,
    filmLabel: match.filmLabel,
    paperLabel: match.paperLabel,
    points: match.points.map((p) => ({ ...p })),
    source: 'external',
  };
}

/** Результат загрузки эталонной кривой из документа Matcher. */
export type LoadReferenceResult =
  | { ok: true; curve: Curve }
  | { ok: false; error: 'no-match' };

/**
 * Загружает эталонную кривую из другого документа Matcher.
 *
 * Spec (matcher / «Загрузка пользовательской эталонной кривой»,
 * «Недопустимый источник эталонной кривой»): если документ не содержит
 * сохранённого сопоставления, загрузка отклоняется.
 */
export function loadReferenceFromDocument(source: MatcherDocument): LoadReferenceResult {
  const match = loadMatchFromDocument(source);
  if (!match || match.points.length === 0) return { ok: false, error: 'no-match' };
  return {
    ok: true,
    curve: {
      label: match.name,
      note: '',
      points: match.points.map((p) => ({ ...p })),
      reserved: [],
      dontConnectInChart: false,
    },
  };
}

/** Результат загрузки нового файла плёнки/бумаги в документ Matcher. */
export function replaceMatcherSource(
  doc: MatcherDocument,
  kind: 'film' | 'paper',
  source: FilmDocument | PaperDocument,
  path: string,
): MatcherDocument {
  const next: MatcherDocument = { ...doc };
  if (kind === 'film' && source.kind === 'film') {
    next.film = source;
    next.filmRef = { path, name: baseNameOf(path), code: 0, modifiedAt: undefined };
    next.selectedFilmCurve = 0;
    // При перезагрузке исходного файла приближённые кривые отбрасываются
    // (spec работает через «Reloading Film and Paper files»).
    next.approximatedCurves = [];
  }
  if (kind === 'paper' && source.kind === 'paper') {
    next.paper = source;
    next.paperRef = { path, name: baseNameOf(path), code: 5, modifiedAt: undefined };
    next.selectedPaperCurve = 0;
  }
  // Перезагрузка исходного файла отбрасывает переопределения параметров.
  next.analysisParams = source.analysisParams;
  next.analysisOverridden = false;
  return next;
}

/** Базовое имя пути (для ссылок). */
function baseNameOf(path: string): string {
  const idx = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return idx >= 0 ? path.slice(idx + 1) : path;
}

/**
 * Переопределяет параметры анализа в документе Matcher.
 *
 * Spec (matcher / «Переопределение параметров»): изменённые значения заменяют
 * исходные, сохраняются в документе и помечаются флагом `analysisOverridden`.
 */
export function overrideAnalysisParams(
  doc: MatcherDocument,
  override: Partial<AnalysisParams>,
): MatcherDocument {
  return {
    ...doc,
    analysisParams: { ...doc.analysisParams, ...override },
    analysisOverridden: true,
  };
}

/**
 * Восстанавливает параметры анализа из исходных файлов плёнки и бумаги.
 *
 * Spec (matcher / «Восстановление значений файлов»).
 */
export function restoreFileDefaults(doc: MatcherDocument): MatcherDocument {
  const base = doc.paper?.analysisParams ?? doc.film?.analysisParams ?? doc.analysisParams;
  return { ...doc, analysisParams: { ...base }, analysisOverridden: false };
}

/** Итог разбора `.pmf` в набор полей документа для UI/логики. */
export interface MatcherLoadResult {
  doc: MatcherDocument;
  /** Ссылки на исходные файлы, которые нужно найти (отсутствуют/не загружены). */
  missingReferences: ('film' | 'paper')[];
  /** Обновлённые исходные файлы (по дате изменения) — предложить перезагрузку. */
  updatedReferences: ('film' | 'paper')[];
}

/** Проверяет, обновился ли исходный файл с момента создания документа. */
export function referenceUpdated(
  ref: { modifiedAt?: number },
  currentModifiedAt: number | undefined,
): boolean {
  if (ref.modifiedAt === undefined || currentModifiedAt === undefined) return false;
  return currentModifiedAt > ref.modifiedAt;
}

/**
 * Проверяет ссылки документа на исходные файлы.
 *
 * @param doc        документ Matcher
 * @param modifyTimes время изменения доступных исходных файлов (по видам);
 *                    `undefined` — файл недоступен
 */
export function checkReferences(
  doc: MatcherDocument,
  modifyTimes: { film?: number; paper?: number },
): { missing: ('film' | 'paper')[]; updated: ('film' | 'paper')[] } {
  const missing: ('film' | 'paper')[] = [];
  const updated: ('film' | 'paper')[] = [];
  if (modifyTimes.film === undefined) missing.push('film');
  else if (referenceUpdated(doc.filmRef, modifyTimes.film)) updated.push('film');
  if (modifyTimes.paper === undefined) missing.push('paper');
  else if (referenceUpdated(doc.paperRef, modifyTimes.paper)) updated.push('paper');
  return { missing, updated };
}

/**
 * Обновляет устаревшую стандартную эталонную кривую с вуалью.
 *
 * Spec (matcher / «Устаревшая эталонная кривая с вуалью»): если документ был
 * сохранён с более не поддерживаемой стандартной кривой с вуалью, он
 * обновляется до стандартной кривой.
 *
 * @returns новый документ и признак того, что обновление произошло
 */
export function upgradeOutdatedFlaredReference(doc: MatcherDocument): {
  doc: MatcherDocument;
  upgraded: boolean;
} {
  if (doc.referenceCurveType !== ReferenceCurveType.Flared) {
    return { doc, upgraded: false };
  }
  return {
    doc: {
      ...doc,
      referenceCurveType: ReferenceCurveType.Default,
      referenceCurveGrays: [...DEFAULT_REFERENCE_GRAYS],
    },
    upgraded: true,
  };
}

/** Анализирует семейство плёнки Matcher (с приближёнными кривыми). */
export function analyzeMatcherFilm(doc: MatcherDocument): FilmCurveAnalysis[] {
  if (!doc.film) return [];
  return analyzeFilm(doc.film.curves, doc.film.stepTablet, doc.analysisParams, doc.film.family.filmIso)
    .curves;
}

/** Анализирует семейство бумаги Matcher. */
export function analyzeMatcherPaper(doc: MatcherDocument): PaperCurveAnalysis[] {
  if (!doc.paper) return [];
  return analyzePaper(doc.paper.curves, doc.paper.stepTablet, doc.analysisParams);
}

/** Максимально допустимое число сравнений. */
export const MAX_COMPARISONS = LIMITS.maxComparisons;
