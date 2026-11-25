import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFilm, readPaper } from '@/core/format';
import {
  AnalysisMethod,
  LIMITS,
  ReferenceCurveType,
  fileReference,
} from '@/core/model';
import type { MatcherDocument, SavedMatch } from '@/core/model';
import { createMatcherDocument } from '@/core/model';
import {
  DEFAULT_REFERENCE_GRAYS,
  FLARED_REFERENCE_GRAYS,
  applyLockFilmDrToEs,
  approximateFilmCurve,
  approximationLabel,
  buildComparisonPlot,
  buildMatch,
  checkReferences,
  currentMatch,
  familyMetricRange,
  loadMatchFromDocument,
  loadReferenceFromDocument,
  normalizeMatches,
  overrideAnalysisParams,
  recomputeApproximatedCurves,
  referenceUpdated,
  removeSavedMatch,
  replaceMatcherSource,
  restoreFileDefaults,
  saveCurrentMatchForComparison,
  standardReferenceGrays,
  upgradeOutdatedFlaredReference,
} from './matcher';
import { analyzePaper } from './paper';

const APP_DIR = join(process.cwd(), 'app');

function filmDoc(name = '_400_TMax_ID11_23_75.pfc') {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, name))));
}
function paperDoc(name = 'Agfa_MCC.ppc') {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, name))));
}

function matcherDoc(): MatcherDocument {
  return createMatcherDocument(filmDoc(), paperDoc());
}

describe('приближённые кривые (задача 7.6)', () => {
  it('создаёт промежуточную кривую по SBR в диапазоне семейства', () => {
    const doc = matcherDoc();
    const range = familyMetricRange(doc.film!, 'sbr', doc.analysisParams)!;
    expect(range).toBeDefined();
    const mid = (range.min + range.max) / 2;
    const result = approximateFilmCurve(doc.film!, 'sbr', mid, doc.analysisParams);
    expect(result).toBeDefined();
    expect(result!.outOfRange).toBe(false);
    expect(result!.curve.label).toBe(approximationLabel('sbr', mid));
    expect(result!.curve.label).toMatch(/^SBR ~ /);
    expect(result!.curve.points.length).toBeGreaterThan(0);
    expect(result!.curve.approximated?.by).toBe('sbr');
  });

  it('создаёт приближённую кривую по средней G', () => {
    const doc = matcherDoc();
    const range = familyMetricRange(doc.film!, 'g', doc.analysisParams)!;
    const mid = (range.min + range.max) / 2;
    const result = approximateFilmCurve(doc.film!, 'g', mid, doc.analysisParams)!;
    expect(result.curve.label).toMatch(/^Ave\. G ~ /);
    expect(result.curve.approximated?.by).toBe('g');
  });

  it('отказывает при значении вне диапазона семейства и помечает out-of-range', () => {
    const doc = matcherDoc();
    const range = familyMetricRange(doc.film!, 'sbr', doc.analysisParams)!;
    const result = approximateFilmCurve(doc.film!, 'sbr', range.max + 5, doc.analysisParams)!;
    expect(result.outOfRange).toBe(true);
    expect(result.curve.approximated?.outOfRange).toBe(true);
    expect(result.curve.points).toHaveLength(0);
  });

  it('динамически пересчитывает приближённые кривые при изменении ES', () => {
    const doc = matcherDoc();
    const range = familyMetricRange(doc.film!, 'sbr', doc.analysisParams)!;
    const mid = (range.min + range.max) / 2;
    const approx = approximateFilmCurve(doc.film!, 'sbr', mid, doc.analysisParams)!.curve;
    const withApprox = { ...doc.film!, curves: [...doc.film!.curves, approx] };
    // Меняем ES — приближённая кривая должна пересчитаться.
    const changed = {
      ...withApprox,
      analysisParams: { ...withApprox.analysisParams, es: withApprox.analysisParams.es * 1.2 },
    };
    const recomputed = recomputeApproximatedCurves(changed);
    const newApprox = recomputed.curves[recomputed.curves.length - 1];
    expect(newApprox.approximated).toBeDefined();
    expect(newApprox.approximated!.value).toBeCloseTo(mid, 9);
  });

  it('пересчёт помечает кривую out-of-range, если значение больше не помещается', () => {
    const doc = matcherDoc();
    const range = familyMetricRange(doc.film!, 'sbr', doc.analysisParams)!;
    const approx = approximateFilmCurve(doc.film!, 'sbr', range.max, doc.analysisParams)!.curve;
    const withApprox = { ...doc.film!, curves: [...doc.film!.curves, approx] };
    // Уменьшаем ES так, чтобы требуемый SBR = max вышел за диапазон.
    const changed = {
      ...withApprox,
      analysisParams: { ...withApprox.analysisParams, es: withApprox.analysisParams.es * 0.5 },
    };
    const recomputed = recomputeApproximatedCurves(changed);
    const newApprox = recomputed.curves[recomputed.curves.length - 1];
    expect(newApprox.approximated?.outOfRange).toBe(true);
  });
});

describe('«Lock Film DR=ES» (задача 7.5)', () => {
  it('перезаписывает ES параметров значением ES выбранной бумажной кривой', () => {
    const doc = matcherDoc();
    const analysis = analyzePaper(doc.paper!.curves, doc.paper!.stepTablet, doc.analysisParams);
    const es = analysis[0].es!;
    const locked = applyLockFilmDrToEs(doc.analysisParams, true, analysis[0]);
    expect(locked.es).toBeCloseTo(es, 12);
  });

  it('без флажка параметры не меняются', () => {
    const doc = matcherDoc();
    const analysis = analyzePaper(doc.paper!.curves, doc.paper!.stepTablet, doc.analysisParams);
    const kept = applyLockFilmDrToEs(doc.analysisParams, false, analysis[0]);
    expect(kept.es).toBe(doc.analysisParams.es);
  });
});

describe('эталонные кривые (задача 7.7)', () => {
  it('стандартная кривая по умолчанию и flared различаются', () => {
    expect(standardReferenceGrays(ReferenceCurveType.Default)).toEqual(DEFAULT_REFERENCE_GRAYS);
    expect(standardReferenceGrays(ReferenceCurveType.Flared)).toEqual(FLARED_REFERENCE_GRAYS);
  });

  it('загрузка эталонной кривой из документа с сопоставлением', () => {
    const source = saveCurrentMatchForComparison(matcherDoc()).doc;
    const result = loadReferenceFromDocument(source);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.curve.points.length).toBeGreaterThan(0);
  });

  it('отказывает для документа без сопоставления', () => {
    const empty: MatcherDocument = { ...matcherDoc(), film: undefined, paper: undefined };
    expect(loadReferenceFromDocument(empty).ok).toBe(false);
  });

  it('обновляет устаревшую flared-эталонную кривую до стандартной', () => {
    const doc = { ...matcherDoc(), referenceCurveType: ReferenceCurveType.Flared };
    const { doc: next, upgraded } = upgradeOutdatedFlaredReference(doc);
    expect(upgraded).toBe(true);
    expect(next.referenceCurveType).toBe(ReferenceCurveType.Default);
    expect(next.referenceCurveGrays).toEqual(DEFAULT_REFERENCE_GRAYS);
  });

  it('стандартный документ не требует обновления', () => {
    const { upgraded } = upgradeOutdatedFlaredReference(matcherDoc());
    expect(upgraded).toBe(false);
  });
});

describe('сохранение сопоставлений для сравнения (задача 7.8)', () => {
  it('сохраняет текущее сопоставление', () => {
    const { doc, error } = saveCurrentMatchForComparison(matcherDoc());
    expect(error).toBeUndefined();
    expect(doc.savedMatches).toHaveLength(1);
    expect(doc.savedMatches[0].source).toBe('current');
  });

  it('не добавляет сопоставление сверх предела в 15 сравнений', () => {
    const matches: SavedMatch[] = Array.from({ length: LIMITS.maxComparisons }, (_, i) => ({
      name: `m${i}`,
      filmLabel: 'f',
      paperLabel: 'p',
      points: [{ step: 2, density: 1 }],
    }));
    const doc = { ...matcherDoc(), savedMatches: matches };
    const { doc: next, error } = saveCurrentMatchForComparison(doc);
    expect(error).toBe('limit');
    expect(next.savedMatches).toHaveLength(LIMITS.maxComparisons);
  });

  it('удаляет сохранённое сопоставление по индексу', () => {
    const base = saveCurrentMatchForComparison(matcherDoc()).doc;
    const two = { ...base, savedMatches: [...base.savedMatches, { ...base.savedMatches[0] }] };
    expect(removeSavedMatch(two, 0).savedMatches).toHaveLength(1);
  });

  it('загружает внешнее сопоставление и помечает источник', () => {
    const source = saveCurrentMatchForComparison(matcherDoc()).doc;
    const match = loadMatchFromDocument(source)!;
    expect(match.source).toBe('external');
  });

  it('нормализует сопоставления к общему диапазону плотностей', () => {
    const matches: SavedMatch[] = [
      { name: 'a', filmLabel: 'f', paperLabel: 'p', points: [{ step: 2, density: 0.2 }, { step: 8, density: 1.8 }] },
      { name: 'b', filmLabel: 'f', paperLabel: 'p', points: [{ step: 2, density: 1.0 }, { step: 8, density: 1.4 }] },
    ];
    const normalized = normalizeMatches(matches);
    expect(normalized[0].clipped).toBe(false);
    for (const m of normalized) {
      const densities = m.points.map((p) => p.density);
      expect(Math.min(...densities)).toBeCloseTo(0.2, 9);
      expect(Math.max(...densities)).toBeCloseTo(1.8, 9);
    }
  });

  it('вырожденное сопоставление помечается как обрезанное', () => {
    const matches: SavedMatch[] = [
      { name: 'flat', filmLabel: 'f', paperLabel: 'p', points: [{ step: 2, density: 1 }, { step: 8, density: 1 }] },
    ];
    const normalized = normalizeMatches(matches);
    expect(normalized[0].clipped).toBe(true);
  });
});

describe('ссылки и параметры анализа (задачи 7.3, 7.4)', () => {
  it('обнаруживает обновление исходного файла по дате изменения', () => {
    expect(referenceUpdated({ modifiedAt: 100 }, 200)).toBe(true);
    expect(referenceUpdated({ modifiedAt: 200 }, 100)).toBe(false);
    expect(referenceUpdated({}, 100)).toBe(false);
  });

  it('сообщает, какие исходные файлы отсутствуют или обновились', () => {
    const doc = {
      ...matcherDoc(),
      filmRef: fileReference('a.pfc', 0, 100),
      paperRef: fileReference('b.ppc', 5, 100),
    };
    const { missing, updated } = checkReferences(doc, { film: 200 });
    expect(missing).toEqual(['paper']);
    expect(updated).toEqual(['film']);
  });

  it('переопределение параметров помечает документ', () => {
    const doc = overrideAnalysisParams(matcherDoc(), { es: 1.4 });
    expect(doc.analysisParams.es).toBeCloseTo(1.4, 9);
    expect(doc.analysisOverridden).toBe(true);
  });

  it('восстановление значений файлов снимает пометку', () => {
    const overridden = overrideAnalysisParams(matcherDoc(), { es: 1.9 });
    const restored = restoreFileDefaults(overridden);
    expect(restored.analysisOverridden).toBe(false);
    expect(restored.analysisParams.es).toBe(overridden.paper!.analysisParams.es);
  });

  it('загрузка нового исходного файла отбрасывает переопределения и приближения', () => {
    const doc = overrideAnalysisParams(matcherDoc(), { es: 2 });
    const next = replaceMatcherSource(doc, 'film', filmDoc(), 'other.pfc');
    expect(next.analysisOverridden).toBe(false);
    expect(next.approximatedCurves).toHaveLength(0);
    expect(next.filmRef.path).toBe('other.pfc');
  });
});

describe('построение сопоставления', () => {
  it('строит совмещённое сопоставление с зонами 2..8', () => {
    const doc = matcherDoc();
    const match = currentMatch(doc)!;
    expect(match).toBeDefined();
    expect(match.points.map((p) => p.step)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it('метод анализа по умолчанию — Approximate CI', () => {
    expect(matcherDoc().analysisParams.method).toBe(AnalysisMethod.ApproximateCI);
  });

  it('buildMatch возвращает undefined без выбранных кривых', () => {
    const doc = matcherDoc();
    expect(buildMatch(doc.film!, 99, doc.paper!, 0, doc.analysisParams)).toBeUndefined();
  });
});

describe('график сравнения сопоставлений', () => {
  it('строит серию на каждое сопоставление по номерам зон 2..8', () => {
    const matches: SavedMatch[] = [
      {
        name: 'm1',
        filmLabel: 'f',
        paperLabel: 'p',
        points: [2, 3, 4, 5, 6, 7, 8].map((step) => ({ step, density: step / 10 })),
      },
    ];
    const plot = buildComparisonPlot(matches);
    expect(plot.hasData).toBe(true);
    expect(plot.series).toHaveLength(1);
    expect(plot.series[0].points.map((p) => p.x)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it('пустой список даёт график без данных', () => {
    const plot = buildComparisonPlot([]);
    expect(plot.hasData).toBe(false);
    expect(plot.series).toHaveLength(0);
  });
});
