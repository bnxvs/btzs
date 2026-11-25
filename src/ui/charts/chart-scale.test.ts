import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLOT,
  LOG10_2,
  PLOT_VIEW,
  connectSegments,
  fromPixelX,
  fromPixelY,
  luxTicks,
  seriesScale,
  toPixelX,
  toPixelY,
} from './chart-scale';

/**
 * Геометрия графиков (задачи 6.2–6.3, 6.6): оси, масштабирование и разрывы
 * ломаной по флажку «Don't connect in chart».
 */

describe('масштаб осей', () => {
  it('диапазон охватывает данные с запасом по краям', () => {
    const scale = seriesScale([1, 2, 3], [0.5, 1.5]);
    expect(scale.xMin).toBeLessThan(1);
    expect(scale.xMax).toBeGreaterThan(3);
    expect(scale.yMin).toBeLessThan(0.5);
    expect(scale.yMax).toBeGreaterThan(1.5);
  });

  it('пустые данные дают симметричный диапазон', () => {
    const scale = seriesScale([], []);
    expect(scale.xMin).toBeCloseTo(-1.1, 9);
    expect(scale.xMax).toBeCloseTo(1.1, 9);
    expect(scale.yMin).toBeCloseTo(-1.1, 9);
    expect(scale.yMax).toBeCloseTo(1.1, 9);
  });

  it('совпадающие значения расширяются, чтобы точки не схлопнулись', () => {
    const scale = seriesScale([5, 5], [2, 2]);
    expect(scale.xMax).toBeGreaterThan(scale.xMin);
    expect(scale.yMax).toBeGreaterThan(scale.yMin);
  });

  it('clampYMinZero не заводит нижнюю границу плотности ниже нуля', () => {
    const scale = seriesScale([1, 2, 3], [0.05, 1.4, 2.3], { clampYMinZero: true });
    // Плотность неотрицательна: ось начинается ровно в нуле, а не в «-0,11».
    expect(scale.yMin).toBe(0);
    expect(scale.yMax).toBeGreaterThan(2.3);
  });

  it('clampYMinZero не трогает ось, если данные целиком положительны и далеки от нуля', () => {
    const scale = seriesScale([1, 2], [1.0, 2.0], { clampYMinZero: true });
    expect(scale.yMin).toBeGreaterThan(0);
  });

  it('clampYMinZero оставляет отрицательные данные как есть', () => {
    const scale = seriesScale([1, 2], [-1, 1], { clampYMinZero: true });
    expect(scale.yMin).toBeLessThan(0);
  });
});

describe('перевод координат', () => {
  it('центр диапазона попадает в центр области отрисовки', () => {
    const scale = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
    const cx = toPixelX(5, scale);
    const cy = toPixelY(5, scale);
    expect(cx).toBeCloseTo(DEFAULT_PLOT.padding + DEFAULT_PLOT.width / 2, 6);
    expect(cy).toBeCloseTo(DEFAULT_PLOT.padding + DEFAULT_PLOT.height / 2, 6);
  });

  it('ось y направлена вверх: большая плотность — меньше пиксель', () => {
    const scale = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    expect(toPixelY(1, scale)).toBeLessThan(toPixelY(0, scale));
  });

  it('перевод в пиксели и обратно — тождество', () => {
    const scale = { xMin: -2, xMax: 3, yMin: 0.4, yMax: 2.2 };
    for (const x of [-2, -0.5, 0, 1.5, 3]) {
      expect(fromPixelX(toPixelX(x, scale), scale)).toBeCloseTo(x, 9);
    }
    for (const y of [0.4, 0.9, 1.3, 2.2]) {
      expect(fromPixelY(toPixelY(y, scale), scale)).toBeCloseTo(y, 9);
    }
  });

  it('точки внутри области отрисовки', () => {
    const scale = seriesScale([1, 2, 3], [10, 20]);
    for (const x of [1, 2, 3]) {
      const px = toPixelX(x, scale);
      expect(px).toBeGreaterThanOrEqual(DEFAULT_PLOT.padding);
      expect(px).toBeLessThanOrEqual(DEFAULT_PLOT.padding + DEFAULT_PLOT.width);
    }
    expect(PLOT_VIEW.width).toBeGreaterThan(DEFAULT_PLOT.padding + DEFAULT_PLOT.width - 1);
  });
});

describe('деления шкалы экспозиции (Lux/с)', () => {
  it('деления идут через ступень ×2 от круглой декады с подписью 10^logE', () => {
    const scale = { xMin: -3.04, xMax: -0.04, yMin: 0, yMax: 3 };
    const ticks = luxTicks(scale);
    expect(ticks.length).toBeGreaterThan(3);
    // Начинается с ближайшей круглой декады внутри диапазона.
    expect(ticks[0].x).toBeCloseTo(-3, 9);
    expect(ticks[0].value).toBeCloseTo(0.001, 9);
    for (let i = 1; i < ticks.length; i++) {
      // Каждое следующее деление — ровно одна ступень (×2).
      expect(ticks[i].x - ticks[i - 1].x).toBeCloseTo(LOG10_2, 9);
      expect(ticks[i].value).toBeCloseTo(Math.pow(10, ticks[i].x), 9);
    }
  });

  it('деления не выходят за пределы диапазона', () => {
    const scale = { xMin: -3.04, xMax: -0.04, yMin: 0, yMax: 3 };
    for (const tick of luxTicks(scale)) {
      expect(tick.x).toBeGreaterThanOrEqual(scale.xMin - 1e-9);
      expect(tick.x).toBeLessThanOrEqual(scale.xMax + 1e-9);
    }
  });
});

describe('разрывы ломаной по «Don’t connect in chart»', () => {
  const p = (x: number, dontConnect = false) => ({ x, dontConnect });

  it('непрерывная серия — один отрезок', () => {
    expect(connectSegments([p(1), p(2), p(3)])).toHaveLength(1);
  });

  it('помеченная точка образует отдельный отрезок и не соединяется с соседями', () => {
    const segments = connectSegments([p(1), p(2, true), p(3), p(4)]);
    expect(segments).toEqual([
      [p(1)],
      [p(2, true)],
      [p(3), p(4)],
    ]);
  });

  it('первая точка без соединения отделяется от остальных', () => {
    const segments = connectSegments([p(1, true), p(2), p(3)]);
    expect(segments).toEqual([[p(1, true)], [p(2), p(3)]]);
  });

  it('пустая серия — нет отрезков', () => {
    expect(connectSegments([])).toEqual([]);
  });
});
