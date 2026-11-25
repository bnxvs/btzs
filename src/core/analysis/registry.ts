import { AnalysisMethod, DocumentKind } from '@/core/model';
import type { AnalysisParams, Curve, PlotterDocument, StepTablet } from '@/core/model';
import { analyzeFilm, analyzeFilmCurve } from './film';
import type { FilmAnalysis, FilmCurveAnalysis } from './film';
import { analyzePaper } from './paper';
import type { PaperCurveAnalysis } from './paper';

/**
 * Реестр анализа: единая точка входа для расчёта по документу любого вида.
 *
 * Ядро — детерминированные чистые функции над данными документа (см.
 * `openspec/changes/macos-port/design.md`). UI вызывает их для отображения
 * результатов и не содержит собственной арифметики анализа.
 */

/** Параметры анализа по умолчанию (совпадают со значениями Options). */
export function defaultAnalysisParams(): AnalysisParams {
  return {
    method: AnalysisMethod.ApproximateCI,
    es: 1.0,
    flareDensity: 0,
    expAdj: 0,
    zoneSpread: 4,
    personalSpeedPoint: 2.4,
    usePersonalSpeedPoint: false,
    idminPercent: 90,
  };
}

/** Переопределяет часть параметров анализа поверх заданной базы. */
export function withAnalysisParams(
  base: AnalysisParams,
  override: Partial<AnalysisParams>,
): AnalysisParams {
  return { ...base, ...override };
}

/** Результат анализа документа. */
export type DocumentAnalysis =
  | { kind: 'film'; film: FilmAnalysis }
  | { kind: 'paper'; paper: PaperCurveAnalysis[] }
  | { kind: 'matcher'; film: FilmAnalysis; paper: PaperCurveAnalysis[] };

/** Анализирует одну кривую плёнки по параметрам документа. */
export function analyzeCurveAsFilm(
  curve: Curve,
  tablet: StepTablet,
  params: AnalysisParams,
  filmIso: number,
  referenceSpeedPoint?: number,
): FilmCurveAnalysis {
  return analyzeFilmCurve(curve, tablet, params, filmIso, referenceSpeedPoint);
}

/**
 * Анализирует документ целиком согласно его виду.
 *
 * Для Matcher анализируются встроенные (загруженные) документы плёнки и бумаги,
 * если они присутствуют; иначе возвращаются пустые результаты.
 */
export function analyzeDocument(doc: PlotterDocument): DocumentAnalysis {
  switch (doc.kind) {
    case DocumentKind.Film:
      return {
        kind: 'film',
        film: analyzeFilm(doc.curves, doc.stepTablet, doc.analysisParams, doc.family.filmIso),
      };
    case DocumentKind.Paper:
      return { kind: 'paper', paper: analyzePaper(doc.curves, doc.stepTablet, doc.analysisParams) };
    case DocumentKind.Matcher: {
      const matcher = doc;
      const film = matcher.film
        ? analyzeFilm(
            matcher.film.curves,
            matcher.film.stepTablet,
            matcher.analysisParams,
            matcher.film.family.filmIso,
          )
        : { curves: [] };
      const paper = matcher.paper
        ? analyzePaper(matcher.paper.curves, matcher.paper.stepTablet, matcher.analysisParams)
        : [];
      return { kind: 'matcher', film, paper };
    }
  }
}
