import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FilmChart, PaperChart, parseDevTime } from '@/core/model';
import { readFilm, readPaper } from '@/core/format';
import {
  analyzeFilm,
  analyzePaper,
  defaultAnalysisParams,
  filmChartMetric,
  filmChartSeries,
  isDevTimeChart,
  paperChartSeries,
} from '@/core/analysis';
import type { FilmChartPoint, PaperChartPoint } from '@/core/analysis';

/**
 * Серии графиков вкладки Charts (задачи 6.2–6.3).
 *
 * Числовые результаты анализа калибровкой не подтверждены (см. Open
 * Questions дизайна), поэтому проверяются структура серий, соответствие
 * осей, порядок точек и правила округления — то, что задано спекой.
 */

const APP_DIR = join(process.cwd(), 'app');
const params = defaultAnalysisParams();

function filmFixture() {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, '400 TMax ID-11 2+3 75.pfc'))));
}

function paperFixture() {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, 'Agfa_MCC.ppc'))));
}

describe('графики плёнки: состав и оси', () => {
  it('группа Dev. Time определяется только у трёх графиков', () => {
    expect(isDevTimeChart(FilmChart.DevTimeSbr)).toBe(true);
    expect(isDevTimeChart(FilmChart.DevTimeG)).toBe(true);
    expect(isDevTimeChart(FilmChart.DevTimeN)).toBe(true);
    expect(isDevTimeChart(FilmChart.EfsSbr)).toBe(false);
    expect(isDevTimeChart(FilmChart.EfsG)).toBe(false);
    expect(isDevTimeChart(FilmChart.EfsN)).toBe(false);
  });

  it('метрика оси y соответствует графику', () => {
    expect(filmChartMetric(FilmChart.DevTimeSbr)).toBe('sbr');
    expect(filmChartMetric(FilmChart.EfsSbr)).toBe('sbr');
    expect(filmChartMetric(FilmChart.DevTimeG)).toBe('g');
    expect(filmChartMetric(FilmChart.EfsG)).toBe('g');
    expect(filmChartMetric(FilmChart.DevTimeN)).toBe('n');
    expect(filmChartMetric(FilmChart.EfsN)).toBe('n');
  });

  it('Dev. Time: ось x — время проявления, ось y — метрика кривой', () => {
    const doc = filmFixture();
    const analysis = analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso);
    for (const chart of [FilmChart.DevTimeSbr, FilmChart.DevTimeG, FilmChart.DevTimeN]) {
      const series = filmChartSeries(chart, analysis);
      expect(series).toHaveLength(analysis.curves.length);
      series.forEach((point, i) => {
        const curve = analysis.curves[i];
        expect(point.x).toBeCloseTo(parseDevTime(curve.curve.label)!, 9);
        expect(point.dontConnect).toBe(curve.curve.dontConnectInChart);
      });
    }
  });

  it('EFS: ось x — эффективная светочувствительность', () => {
    const doc = filmFixture();
    const analysis = analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso);
    const series = filmChartSeries(FilmChart.EfsSbr, analysis);
    series.forEach((point, i) => {
      expect(point.x).toBeCloseTo(analysis.curves[i].efs!, 9);
    });
  });

  it('SBR выражается в стопах, а не в логарифмических единицах', () => {
    const doc = filmFixture();
    const analysis = analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso);
    const series = filmChartSeries(FilmChart.DevTimeSbr, analysis);
    series.forEach((point, i) => {
      expect(point.y).toBeCloseTo(analysis.curves[i].sbrStops!, 9);
    });
  });
});

describe('графики плёнки: корректность точек', () => {
  it('все точки имеют конечные координаты и метку кривой', () => {
    const doc = filmFixture();
    const analysis = analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso);
    for (const chart of Object.values(FilmChart)) {
      for (const point of filmChartSeries(chart, analysis)) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
        expect(point.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('точки идут в порядке кривых семейства', () => {
    const doc = filmFixture();
    const analysis = analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso);
    const series = filmChartSeries(FilmChart.DevTimeSbr, analysis);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].index).toBeGreaterThan(series[i - 1].index);
    }
  });

  it('кривая с некорректным временем не попадает на Dev. Time графики', () => {
    const doc = filmFixture();
    const broken = { ...doc.curves[0], label: 'N5.5' };
    const curves = [broken, ...doc.curves.slice(1)];
    const analysis = analyzeFilm(curves, doc.stepTablet, params, doc.family.filmIso);
    const devTime = filmChartSeries(FilmChart.DevTimeSbr, analysis);
    expect(devTime.every((p: FilmChartPoint) => p.label !== 'N5.5')).toBe(true);
  });

  it('число точек Dev. Time совпадает с числом корректных меток времени', () => {
    const doc = filmFixture();
    const analysis = analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso);
    const valid = doc.curves.filter((c) => parseDevTime(c.label) !== null).length;
    expect(filmChartSeries(FilmChart.DevTimeSbr, analysis)).toHaveLength(valid);
  });
});

describe('графики бумаги: оси и округление', () => {
  it('ISO Range Chart: ось y — ISO-диапазон (ES, округлённая до 10)', () => {
    const doc = paperFixture();
    const analysis = analyzePaper(doc.curves, doc.stepTablet, params);
    const series = paperChartSeries(PaperChart.IsoRange, analysis);
    expect(series).toHaveLength(analysis.length);
    series.forEach((point: PaperChartPoint, i) => {
      const es = analysis[i].es!;
      expect(point.y).toBe(Math.round(es * 10) * 10);
      expect(point.isoRange).toBe(point.y);
    });
  });

  it('Paper Grade Chart: ось y — ES, ось классов — номера классов', () => {
    const doc = paperFixture();
    const analysis = analyzePaper(doc.curves, doc.stepTablet, params);
    const series = paperChartSeries(PaperChart.PaperGrade, analysis);
    series.forEach((point: PaperChartPoint, i) => {
      expect(point.y).toBeCloseTo(analysis[i].es!, 9);
      expect(point.grade).toBe(analysis[i].grade);
    });
  });

  it('точки обеих бумажных серий упорядочены по кривым семейства', () => {
    const doc = paperFixture();
    const analysis = analyzePaper(doc.curves, doc.stepTablet, params);
    for (const chart of [PaperChart.IsoRange, PaperChart.PaperGrade]) {
      const series = paperChartSeries(chart, analysis);
      for (let i = 1; i < series.length; i++) {
        expect(series[i].index).toBeGreaterThan(series[i - 1].index);
      }
    }
  });

  it('флажок «Don’t connect in chart» попадает в точки бумажных серий', () => {
    const doc = paperFixture();
    const curves = doc.curves.map((c, i) =>
      i === 0 ? { ...c, dontConnectInChart: true } : c,
    );
    const analysis = analyzePaper(curves, doc.stepTablet, params);
    const series = paperChartSeries(PaperChart.IsoRange, analysis);
    expect(series[0].dontConnect).toBe(true);
    expect(series.slice(1).every((p) => p.dontConnect === false)).toBe(true);
  });
});

describe('графики: реакция на параметры анализа', () => {
  it('изменение ES меняет серии плёнки', () => {
    const doc = filmFixture();
    const base = filmChartSeries(
      FilmChart.DevTimeSbr,
      analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso),
    );
    const changed = filmChartSeries(
      FilmChart.DevTimeSbr,
      analyzeFilm(doc.curves, doc.stepTablet, { ...params, es: 1.4 }, doc.family.filmIso),
    );
    expect(changed.map((p) => p.y)).not.toEqual(base.map((p) => p.y));
  });

  it('Zone Spread влияет только на N-графики', () => {
    const doc = filmFixture();
    const wide = analyzeFilm(doc.curves, doc.stepTablet, { ...params, zoneSpread: 6 }, doc.family.filmIso);
    const tight = analyzeFilm(doc.curves, doc.stepTablet, { ...params, zoneSpread: 2 }, doc.family.filmIso);
    const nWide = filmChartSeries(FilmChart.DevTimeN, wide).map((p) => p.y);
    const nTight = filmChartSeries(FilmChart.DevTimeN, tight).map((p) => p.y);
    const sbrWide = filmChartSeries(FilmChart.DevTimeSbr, wide).map((p) => p.y);
    const sbrTight = filmChartSeries(FilmChart.DevTimeSbr, tight).map((p) => p.y);
    expect(nWide).not.toEqual(nTight);
    expect(sbrWide).toEqual(sbrTight);
  });

  it('Paper ES влияет на бумажные серии', () => {
    const doc = paperFixture();
    const base = paperChartSeries(
      PaperChart.IsoRange,
      analyzePaper(doc.curves, doc.stepTablet, params),
    );
    const changed = paperChartSeries(
      PaperChart.IsoRange,
      analyzePaper(doc.curves, doc.stepTablet, { ...params, idminPercent: 95 }),
    );
    expect(changed.map((p) => p.y)).not.toEqual(base.map((p) => p.y));
  });
});
