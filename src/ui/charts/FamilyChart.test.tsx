/**
 * Тесты графика семейства характеристических кривых (spec: charts /
 * «Family curve graph»).
 *
 * Проверяется отрисовка кривых, сетки, зон и линий построения; геометрия
 * (пиксели) считается в компоненте через `chart-scale`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFilm, readPaper } from '@/core/format';
import type { FilmDocument, PaperDocument } from '@/core/model';
import {
  analyzeFilm,
  analyzePaper,
  buildFamilyPlot,
  filmGraphZones,
  paperGraphZones,
} from '@/core/analysis';
import { setLocale } from '@/i18n';
import { FamilyChart, HIGHLIGHT_COLOR, HIGHLIGHT_STROKE_WIDTH } from './FamilyChart';

const APP_DIR = join(process.cwd(), 'app');

function filmFixture(): FilmDocument {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, '_400_TMax_ID11_23_75.pfc'))));
}
function paperFixture(): PaperDocument {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, 'Agfa_MCC.ppc'))));
}

beforeEach(() => setLocale('ru'));
afterEach(() => setLocale('ru'));

describe('FamilyChart', () => {
  it('рисует по серии на каждую кривую', () => {
    const doc = filmFixture();
    const plot = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams);
    render(<FamilyChart plot={plot} xTitle="logE" yTitle="D" ariaLabel="график" />);
    expect(screen.getByTestId('family-chart')).toBeInTheDocument();
    for (let i = 0; i < doc.curves.length; i++) {
      expect(screen.getByTestId(`family-series-${i}`)).toBeInTheDocument();
    }
  });

  it('рисует зоны сюжета и полосы зон', () => {
    const doc = filmFixture();
    const analysis = analyzeFilm(
      doc.curves,
      doc.stepTablet,
      doc.analysisParams,
      doc.family.filmIso,
    );
    const selected = analysis.curves[0];
    const plot = {
      ...buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams),
      zones: filmGraphZones(
        selected.curve,
        doc.stepTablet,
        doc.analysisParams,
        selected.speedPointLogE,
        selected.sbrLog,
      ),
    };
    render(<FamilyChart plot={plot} xTitle="logE" yTitle="D" ariaLabel="график" />);
    expect(screen.getByTestId('zone-band-2')).toBeInTheDocument();
    expect(screen.getByTestId('zone-label-8')).toBeInTheDocument();
  });

  it('рисует зоны печати бумаги', () => {
    const doc = paperFixture();
    const analysis = analyzePaper(doc.curves, doc.stepTablet, doc.analysisParams);
    const selected = analysis[0];
    const plot = {
      ...buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams),
      zones: paperGraphZones(
        selected.curve,
        doc.stepTablet,
        doc.analysisParams,
        selected.idMinLogE,
        selected.idMaxLogE,
      ),
    };
    render(<FamilyChart plot={plot} xTitle="logE" yTitle="D" ariaLabel="график" />);
    expect(screen.getByTestId('zone-band-5')).toBeInTheDocument();
  });

  it('рисует пунктирные серии, маркеры и линии построения', () => {
    const doc = filmFixture();
    const plot = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams);
    render(
      <FamilyChart
        plot={plot}
        xTitle="logE"
        yTitle="D"
        ariaLabel="график"
        dashed={[
          {
            key: 'ext',
            points: [
              { x: 0, y: 1 },
              { x: 1, y: 2 },
            ],
          },
        ]}
        markers={[{ key: 'sp', x: 0, y: 0, label: 'SP' }]}
        verticalGuides={[{ x: 0.5 }]}
        horizontalGuides={[{ y: 1 }]}
      />,
    );
    expect(screen.getByTestId('ext')).toBeInTheDocument();
    expect(screen.getByTestId('sp')).toBeInTheDocument();
    expect(screen.getByText('SP')).toBeInTheDocument();
  });

  it('без сетки не рисует линии сетки', () => {
    const doc = filmFixture();
    const plot = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams);
    const { container } = render(
      <FamilyChart plot={plot} xTitle="logE" yTitle="D" ariaLabel="график" showGrid={false} />,
    );
    expect(container.querySelectorAll('.chart-grid')).toHaveLength(0);
  });

  it('подсвечивает выбранную кривую красным, остальные — нет', () => {
    const doc = filmFixture();
    const plot = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams);
    render(
      <FamilyChart
        plot={plot}
        xTitle="logE"
        yTitle="D"
        ariaLabel="график"
        highlightIndex={2}
      />,
    );
    const group = screen.getByTestId('family-series-2');
    expect(group).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('family-series-line-2').style.stroke).toBe(HIGHLIGHT_COLOR);
    // Прочие кривые не подсвечены.
    expect(screen.getByTestId('family-series-0')).not.toHaveAttribute('data-highlighted');
    expect(screen.getByTestId('family-series-line-0').style.stroke).not.toBe(HIGHLIGHT_COLOR);
  });

  it('без highlightIndex ни одна кривая не подсвечена', () => {
    const doc = filmFixture();
    const plot = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams);
    render(<FamilyChart plot={plot} xTitle="logE" yTitle="D" ariaLabel="график" />);
    for (let i = 0; i < doc.curves.length; i++) {
      expect(screen.getByTestId(`family-series-${i}`)).not.toHaveAttribute('data-highlighted');
    }
  });

  it('подсвеченная линия толще обычной, обычные — без встроенного стиля', () => {
    const doc = filmFixture();
    const plot = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams);
    render(
      <FamilyChart plot={plot} xTitle="logE" yTitle="D" ariaLabel="график" highlightIndex={0} />,
    );
    const highlighted = screen.getByTestId('family-series-line-0');
    const plain = screen.getByTestId('family-series-line-1');
    expect(highlighted.style.stroke).toBe(HIGHLIGHT_COLOR);
    expect(highlighted.style.strokeWidth).toBe(String(HIGHLIGHT_STROKE_WIDTH));
    // Обычная кривая не переопределяет цвет встроенно — остаётся из таблицы
    // стилей (синей).
    expect(plain.style.stroke).toBe('');
  });
});
