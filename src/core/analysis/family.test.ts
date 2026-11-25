/**
 * Тесты данных графика семейства характеристических кривых
 * (spec: charts / «Family curve graph»).
 *
 * `buildFamilyPlot`, `filmGraphZones` и `paperGraphZones` — чистые функции:
 * строят точки (logE, плотность) и зоны по кривым, клину и результатам анализа.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFilm, readPaper } from '@/core/format';
import type { FilmDocument, PaperDocument } from '@/core/model';
import { analyzeFilm, analyzePaper } from '@/core/analysis';
import {
  FAMILY_ZONE_COUNT,
  buildFamilyPlot,
  filmGraphZones,
  paperGraphZones,
} from '@/core/analysis';

const APP_DIR = join(process.cwd(), 'app');

function filmFixture(): FilmDocument {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, '400 TMax ID-11 2+3 75.pfc'))));
}
function paperFixture(): PaperDocument {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, 'Agfa_MCC.ppc'))));
}

describe('buildFamilyPlot', () => {
  it('строит по серии на каждую кривую с точками (logE, плотность)', () => {
    const doc = filmFixture();
    const plot = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams);
    expect(plot.hasData).toBe(true);
    expect(plot.series).toHaveLength(doc.curves.length);
    for (const series of plot.series) {
      expect(series.points.length).toBeGreaterThan(0);
      expect(series.markers.length).toEqual(series.points.length);
      for (const point of series.points) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    }
  });

  it('сглаживание увеличивает число точек линии, но не маркеров', () => {
    const doc = filmFixture();
    const raw = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams);
    const smooth = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams, {
      smooth: true,
    });
    expect(smooth.series[0].points.length).toBeGreaterThan(raw.series[0].points.length);
    expect(smooth.series[0].markers.length).toEqual(raw.series[0].markers.length);
  });

  it('пустое семейство не содержит данных', () => {
    const doc = filmFixture();
    const plot = buildFamilyPlot([], doc.stepTablet, doc.analysisParams);
    expect(plot.hasData).toBe(false);
    expect(plot.series).toHaveLength(0);
  });

  it('точки отсортированы по возрастанию logE', () => {
    const doc = filmFixture();
    const plot = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams);
    for (const series of plot.series) {
      for (let i = 1; i < series.points.length; i++) {
        expect(series.points[i].x).toBeGreaterThanOrEqual(series.points[i - 1].x);
      }
    }
  });
});

describe('filmGraphZones', () => {
  it('строит семь зон сюжета и проекции', () => {
    const doc = filmFixture();
    const analysis = analyzeFilm(
      doc.curves,
      doc.stepTablet,
      doc.analysisParams,
      doc.family.filmIso,
    );
    const curve = analysis.curves[0];
    const zones = filmGraphZones(
      curve.curve,
      doc.stepTablet,
      doc.analysisParams,
      curve.speedPointLogE,
      curve.sbrLog,
    );
    expect(zones.zones).toHaveLength(FAMILY_ZONE_COUNT);
    expect(zones.zones[0].zone).toBe(2);
    expect(zones.zones[FAMILY_ZONE_COUNT - 1].zone).toBe(8);
    for (const zone of zones.zones) {
      expect(zone.x1).toBeGreaterThan(zone.x0);
      expect(zone.high).toBeGreaterThanOrEqual(zone.low);
    }
  });

  it('без точки скорости зон нет', () => {
    const doc = filmFixture();
    expect(
      filmGraphZones(doc.curves[0], doc.stepTablet, doc.analysisParams, undefined, undefined).zones,
    ).toHaveLength(0);
  });
});

describe('paperGraphZones', () => {
  it('строит зоны печати по границам IDmin/IDmax', () => {
    const doc = paperFixture();
    const analysis = analyzePaper(doc.curves, doc.stepTablet, doc.analysisParams);
    const curve = analysis[0];
    const zones = paperGraphZones(
      curve.curve,
      doc.stepTablet,
      doc.analysisParams,
      curve.idMinLogE,
      curve.idMaxLogE,
    );
    expect(zones.zones).toHaveLength(FAMILY_ZONE_COUNT);
    expect(zones.zones[0].x0).toBeCloseTo(curve.idMinLogE!, 9);
    // Зоны идут слева направо без разрывов.
    for (let i = 1; i < zones.zones.length; i++) {
      expect(zones.zones[i].x0).toBeCloseTo(zones.zones[i - 1].x1, 9);
    }
  });

  it('без границ IDmin/IDmax зон нет', () => {
    const doc = paperFixture();
    expect(
      paperGraphZones(doc.curves[0], doc.stepTablet, doc.analysisParams, undefined, undefined)
        .zones,
    ).toHaveLength(0);
  });
});
