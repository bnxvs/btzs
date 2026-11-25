/**
 * Тесты вкладки Charts (задачи 6.1, 6.4, 6.5, 6.6).
 *
 * Компонент получает документ через props и возвращает изменения через
 * `onDocChange`; харнесс держит документ в состоянии React.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFilm, readPaper } from '@/core/format';
import { FilmChart, PaperChart } from '@/core/model';
import type { CurveDocument, FilmDocument, PaperDocument } from '@/core/model';
import { setLocale } from '@/i18n';
import { ChartsTab } from './ChartsTab';

const APP_DIR = join(process.cwd(), 'app');

function Harness({ doc, sink }: { doc: CurveDocument; sink: { latest: CurveDocument } }) {
  const [current, setCurrent] = useState(doc);
  return (
    <ChartsTab
      doc={current}
      onDocChange={(next) => {
        sink.latest = next;
        setCurrent(next);
      }}
    />
  );
}

function renderCharts(doc: CurveDocument) {
  const sink = { latest: doc };
  render(<Harness doc={doc} sink={sink} />);
  return { current: () => sink.latest };
}

function filmFixture(): FilmDocument {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, '400 TMax ID-11 2+3 75.pfc'))));
}

function paperFixture(): PaperDocument {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, 'Agfa_MCC.ppc'))));
}

beforeEach(() => setLocale('ru'));
afterEach(() => setLocale('ru'));

describe('каркас вкладки Charts (задача 6.1)', () => {
  it('документ плёнки показывает шесть графиков и имя отображаемого выделено', () => {
    renderCharts(filmFixture());
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(6);
    const selected = screen.getByTestId(`chart-item-${FilmChart.DevTimeSbr}`);
    expect(selected).toHaveAttribute('aria-current', 'true');
  });

  it('документ бумаги показывает два графика', () => {
    renderCharts(paperFixture());
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId(`chart-item-${PaperChart.IsoRange}`)).toBeInTheDocument();
    expect(screen.getByTestId(`chart-item-${PaperChart.PaperGrade}`)).toBeInTheDocument();
  });

  it('переключение графика меняет выделение и отрисовку', () => {
    renderCharts(filmFixture());
    const target = screen.getByTestId(`chart-item-${FilmChart.DevTimeN}`);
    fireEvent.click(target);
    expect(target).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('chart-svg')).toHaveAttribute('aria-label');
  });
});

describe('панель параметров (задача 6.4)', () => {
  it('содержит Paper ES, Flare Density, Exp. Adj. и Zone Spread', () => {
    renderCharts(filmFixture());
    expect(screen.getByTestId('param-es')).toBeInTheDocument();
    expect(screen.getByTestId('param-flare')).toBeInTheDocument();
    expect(screen.getByTestId('param-expadj')).toBeInTheDocument();
    expect(screen.getByTestId('param-zonespread')).toBeInTheDocument();
  });

  it('Zone Spread доступно только для N-графиков', () => {
    renderCharts(filmFixture());
    // Стартовый график Dev. Time/SBR — не N.
    expect(screen.getByTestId('param-zonespread')).toBeDisabled();
    fireEvent.click(screen.getByTestId(`chart-item-${FilmChart.DevTimeN}`));
    expect(screen.getByTestId('param-zonespread')).toBeEnabled();
    fireEvent.click(screen.getByTestId(`chart-item-${FilmChart.EfsG}`));
    expect(screen.getByTestId('param-zonespread')).toBeDisabled();
  });

  it('изменение ES обновляет параметры анализа в документе', () => {
    const { current } = renderCharts(filmFixture());
    const field = screen.getByTestId('param-es');
    fireEvent.change(field, { target: { value: '1,4' } });
    expect(current().analysisParams.es).toBeCloseTo(1.4, 9);
  });

  it('изменение Zone Spread на N-графике обновляет документ', () => {
    const { current } = renderCharts(filmFixture());
    fireEvent.click(screen.getByTestId(`chart-item-${FilmChart.DevTimeN}`));
    fireEvent.change(screen.getByTestId('param-zonespread'), { target: { value: '6' } });
    expect(current().analysisParams.zoneSpread).toBe(6);
  });

  it('дробное значение вводится посимвольно (0,015), разделитель не теряется', async () => {
    const user = userEvent.setup();
    const { current } = renderCharts(filmFixture());
    const field = screen.getByTestId('param-flare');
    await user.clear(field);
    await user.type(field, '0,015');
    expect(field).toHaveValue('0,015');
    expect(current().analysisParams.flareDensity).toBeCloseTo(0.015, 9);
  });

  it('пустое значение поля не меняет документ (guard)', () => {
    const { current } = renderCharts(filmFixture());
    const before = current().analysisParams.es;
    fireEvent.change(screen.getByTestId('param-es'), { target: { value: '' } });
    expect(current().analysisParams.es).toBe(before);
  });
});

describe('инструмент Track (задача 6.5)', () => {
  it('доступен на Dev. Time и выводит время проявления в строку состояния', () => {
    renderCharts(filmFixture());
    const toggle = screen.getByTestId('track-toggle');
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);
    const svg = screen.getByTestId('chart-svg');
    // Движение по области графика — координаты клиента совпадают с viewBox
    // (в jsdom layout нулевой, масштаб берётся 1:1).
    fireEvent.mouseMove(svg, { clientX: 100, clientY: 100 });
    expect(screen.getByTestId('chart-status').textContent).not.toBe('');
  });

  it('недоступен на графиках группы EFS', () => {
    renderCharts(filmFixture());
    fireEvent.click(screen.getByTestId(`chart-item-${FilmChart.EfsSbr}`));
    expect(screen.getByTestId('track-toggle')).toBeDisabled();
  });

  it('недоступен на бумажных графиках', () => {
    renderCharts(paperFixture());
    expect(screen.getByTestId('track-toggle')).toBeDisabled();
  });
});

describe('флажок «Don’t connect in chart» (задача 6.6)', () => {
  it('помеченная точка на бумажном графике стоит отдельным отрезком', () => {
    const doc = paperFixture();
    const curves = doc.curves.map((c, i) =>
      i === 0 ? { ...c, dontConnectInChart: true } : c,
    );
    renderCharts({ ...doc, curves });
    // Точка 0 (помеченная) — отдельный отрезок; остальные объединены.
    expect(screen.getByTestId('chart-point-0')).toBeInTheDocument();
    const svg = screen.getByTestId('chart-svg');
    const lines = svg.querySelectorAll('polyline.chart-line');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0].getAttribute('points')?.includes(' ')).toBe(false);
  });

  it('без флажка все точки бумажного графика соединены одной линией', () => {
    renderCharts(paperFixture());
    const svg = screen.getByTestId('chart-svg');
    expect(svg.querySelectorAll('polyline.chart-line')).toHaveLength(1);
  });
});
