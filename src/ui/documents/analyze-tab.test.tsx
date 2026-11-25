/**
 * Тесты вкладки Analyze (задача 5.8).
 *
 * Компонент контролируемый; харнесс держит документ в состоянии React.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFilm, readPaper } from '@/core/format';
import { AnalysisMethod, DEFAULTS } from '@/core/model';
import type { AnalysisParams, FilmDocument, PaperDocument } from '@/core/model';
import { setLocale } from '@/i18n';
import { AnalyzeTab } from './AnalyzeTab';

const APP_DIR = join(process.cwd(), 'app');

function filmFixture(): FilmDocument {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, '_400_TMax_ID11_23_75.pfc'))));
}
function paperFixture(): PaperDocument {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, 'Agfa_MCC.ppc'))));
}

type CurveDoc = FilmDocument | PaperDocument;

function Harness({
  doc,
  sink,
}: {
  doc: CurveDoc;
  sink: { latest: CurveDoc };
}) {
  const [current, setCurrent] = useState(doc);
  return (
    <AnalyzeTab
      doc={current}
      onDocChange={(next) => {
        sink.latest = next;
        setCurrent(next);
      }}
    />
  );
}

function renderAnalyze(doc: CurveDoc) {
  const sink = { latest: doc };
  render(<Harness doc={doc} sink={sink} />);
  return { current: () => sink.latest };
}

beforeEach(() => setLocale('ru'));
afterEach(() => setLocale('ru'));

describe('5.8 Вкладка Analyze плёнки', () => {
  it('показывает строку анализа на каждую кривую (EFS/G-bar/SBR)', () => {
    const doc = filmFixture();
    renderAnalyze(doc);
    expect(screen.getByTestId('analyze-tab')).toBeInTheDocument();
    expect(screen.getByTestId('film-analysis-table')).toBeInTheDocument();
    for (let i = 0; i < doc.curves.length; i++) {
      expect(screen.getByTestId(`film-analysis-row-${i}`)).toBeInTheDocument();
    }
  });

  it('изменение ES пересчитывает документ', () => {
    const { current } = renderAnalyze(filmFixture());
    fireEvent.change(screen.getByTestId('analyze-es'), { target: { value: '1,5' } });
    expect(current().analysisParams.es).toBeCloseTo(1.5, 9);
  });

  it('переключение метода точки скорости обновляет параметр', async () => {
    const user = userEvent.setup();
    const { current } = renderAnalyze(filmFixture());
    await user.selectOptions(screen.getByTestId('analyze-method'), AnalysisMethod.OverFbF);
    expect(current().analysisParams.method).toBe(AnalysisMethod.OverFbF);
  });

  it('флажок «Display Information» показывает построения', () => {
    renderAnalyze(filmFixture());
    expect(screen.getByTestId('analyze-constructions')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('display-information'));
    expect(screen.queryByTestId('analyze-constructions')).not.toBeInTheDocument();
  });

  it('показывает объединённую таблицу зон (плотность и экспозиция)', () => {
    renderAnalyze(filmFixture());
    const table = screen.getByTestId('analyze-negative-zones');
    expect(table).toBeInTheDocument();
    expect(table).toHaveTextContent('Плотность');
    expect(table).toHaveTextContent('Экспозиция, logE');
    // Строки зон — 2..8.
    expect(screen.getByTestId('analyze-negative-zones-row-2')).toBeInTheDocument();
    expect(screen.getByTestId('analyze-negative-zones-row-8')).toBeInTheDocument();
  });

  it('переносит зоны на график семейства', () => {
    renderAnalyze(filmFixture());
    expect(screen.getByTestId('analyze-film-graph')).toBeInTheDocument();
    expect(screen.getByTestId('analyze-film-chart')).toBeInTheDocument();
    expect(screen.getByTestId('zone-band-2')).toBeInTheDocument();
    expect(screen.getByTestId('zone-band-8')).toBeInTheDocument();
  });

  it('пустой документ показывает сообщение об отсутствии кривых', () => {
    renderAnalyze({ ...filmFixture(), curves: [] });
    expect(screen.getByTestId('analyze-empty')).toBeInTheDocument();
  });

  it('изменение Flare Density и Exp. Adj. сохраняются в параметрах', () => {
    const { current } = renderAnalyze(filmFixture());
    fireEvent.change(screen.getByTestId('analyze-flare'), { target: { value: '0,02' } });
    fireEvent.change(screen.getByTestId('analyze-expadj'), { target: { value: '-1' } });
    expect(current().analysisParams.flareDensity).toBeCloseTo(0.02, 9);
    expect(current().analysisParams.expAdj).toBeCloseTo(-1, 9);
  });

  it('дробное значение вводится посимвольно (0,015), разделитель не теряется', async () => {
    const user = userEvent.setup();
    const { current } = renderAnalyze(filmFixture());
    const field = screen.getByTestId('analyze-flare');
    await user.clear(field);
    await user.type(field, '0,015');
    expect(field).toHaveValue('0,015');
    expect(current().analysisParams.flareDensity).toBeCloseTo(0.015, 9);
    // По потере фокуса — канонический вид с сохранённой точностью.
    await user.tab();
    expect(field).toHaveValue('0,015');
  });

  it('показывает легенду с расшифровкой сокращений', () => {
    renderAnalyze(filmFixture());
    const legend = screen.getByTestId('analyze-legend');
    expect(legend).toHaveTextContent('EFS');
    expect(legend).toHaveTextContent('G-bar');
    expect(legend).toHaveTextContent('SBR');
    expect(legend).toHaveTextContent('эффективная светочувствительность');
    expect(legend).toHaveTextContent('средняя градиентность');
    expect(legend).toHaveTextContent('диапазон яркостей сюжета');
  });

  it('пометка о низком градиенте и продление — только для слабой выбранной кривой', () => {
    const doc = filmFixture();
    renderAnalyze(doc);
    // Выбрана первая (самая слабая) кривая — продление применяется.
    expect(screen.getByTestId('low-gradient-note')).toBeInTheDocument();
    expect(screen.getByTestId('family-extension')).toBeInTheDocument();
    // Переключаемся на последнюю (сильную) кривую — ни продления, ни пометки.
    fireEvent.click(screen.getByTestId(`analyze-curve-${doc.curves.length - 1}`));
    expect(screen.queryByTestId('low-gradient-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('family-extension')).not.toBeInTheDocument();
  });

  it('подсвечивает выбранную кривую и переносит подсветку при выборе другой', () => {
    const doc = filmFixture();
    renderAnalyze(doc);
    // По умолчанию выбрана первая кривая.
    expect(screen.getByTestId('family-series-0')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('family-series-1')).not.toHaveAttribute('data-highlighted');
    // Выбор другой кривой переносит подсветку.
    fireEvent.click(screen.getByTestId('analyze-curve-2'));
    expect(screen.getByTestId('family-series-2')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('family-series-0')).not.toHaveAttribute('data-highlighted');
  });
});

describe('5.8 Вкладка Analyze бумаги', () => {
  it('показывает метки IDmin/IDmax/DR/ES/ISO-диапазон/класс', () => {
    const doc = paperFixture();
    renderAnalyze(doc);
    expect(screen.getByTestId('paper-analysis-table')).toBeInTheDocument();
    for (let i = 0; i < doc.curves.length; i++) {
      expect(screen.getByTestId(`paper-analysis-row-${i}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('paper-relative-speed')).toBeInTheDocument();
  });

  it('изменение «IDmax %» помечает результаты как нестандартные', () => {
    const { current } = renderAnalyze(paperFixture());
    fireEvent.change(screen.getByTestId('analyze-idmin-percent'), { target: { value: '80' } });
    expect(current().analysisParams.idminPercent).toBe(80);
    expect(screen.getByTestId('analyze-nonstandard')).toBeInTheDocument();
  });

  it('при стандартном «IDmax %» пометки нет', () => {
    const base = paperFixture();
    const doc: PaperDocument = {
      ...base,
      analysisParams: { ...base.analysisParams, idminPercent: DEFAULTS.idminPercent },
    };
    renderAnalyze(doc);
    expect(screen.queryByTestId('analyze-nonstandard')).not.toBeInTheDocument();
  });

  it('наведение на зону печати показывает границы и медиану', () => {
    renderAnalyze(paperFixture());
    expect(screen.getByTestId('analyze-print-zones')).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId('analyze-print-zones-row-5'));
    const popup = screen.getByTestId('print-zone-popup');
    expect(popup).toHaveTextContent('Медиана');
    fireEvent.mouseLeave(screen.getByTestId('analyze-print-zones-row-5'));
    expect(screen.queryByTestId('print-zone-popup')).not.toBeInTheDocument();
  });

  it('переносит зоны печати на график семейства', () => {
    renderAnalyze(paperFixture());
    expect(screen.getByTestId('analyze-paper-graph')).toBeInTheDocument();
    expect(screen.getByTestId('analyze-paper-chart')).toBeInTheDocument();
    expect(screen.getByTestId('zone-band-2')).toBeInTheDocument();
    expect(screen.getByTestId('zone-band-8')).toBeInTheDocument();
  });

  it('выбор одной кривой не влияет на данные других', async () => {
    const user = userEvent.setup();
    renderAnalyze(paperFixture());
    await user.click(screen.getByTestId('analyze-curve-2'));
    expect(screen.getByTestId('analyze-curve-2')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('analyze-curve-0')).toHaveAttribute('aria-selected', 'false');
  });

  it('подсвечивает выбранную кривую бумаги', () => {
    renderAnalyze(paperFixture());
    expect(screen.getByTestId('family-series-0')).toHaveAttribute('data-highlighted', 'true');
    fireEvent.click(screen.getByTestId('analyze-curve-1'));
    expect(screen.getByTestId('family-series-1')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('family-series-0')).not.toHaveAttribute('data-highlighted');
  });
});

describe('5.8 параметры анализа как локальные для документа', () => {
  it('изменение ES не мутирует исходный объект', () => {
    const original = filmFixture();
    const before: AnalysisParams = original.analysisParams;
    renderAnalyze(original);
    fireEvent.change(screen.getByTestId('analyze-es'), { target: { value: '2' } });
    expect(original.analysisParams.es).toBe(before.es);
  });
});
