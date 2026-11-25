/**
 * Тесты сеансовых параметров отображения (spec: program-options / app-shell).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getOptions, resetOptionsToDefaults, setOptions } from './options';
import {
  getViewSettings,
  resetViewSettings,
  setViewSettings,
  subscribeViewSettings,
  toggleViewSetting,
} from './view';

beforeEach(() => {
  resetOptionsToDefaults();
  resetViewSettings();
});
afterEach(() => {
  resetOptionsToDefaults();
  resetViewSettings();
});

describe('store/view', () => {
  it('начальные значения берутся из Options', () => {
    setOptions({
      display: {
        displayInformation: true,
        smoothCurves: true,
        colorCurves: false,
        displayGrid: false,
      },
    });
    resetViewSettings();
    const view = getViewSettings();
    const display = getOptions().display;
    expect(view.smoothCurves).toBe(display.smoothCurves);
    expect(view.colorCurves).toBe(display.colorCurves);
    expect(view.displayGrid).toBe(display.displayGrid);
  });

  it('toggle переключает параметр и уведомляет подписчиков', () => {
    let notified = 0;
    const unsubscribe = subscribeViewSettings(() => (notified += 1));
    const before = getViewSettings().displayGrid;
    const next = toggleViewSetting('displayGrid');
    expect(next.displayGrid).toBe(!before);
    expect(notified).toBe(1);
    unsubscribe();
  });

  it('setViewSettings частично обновляет значения', () => {
    const before = getViewSettings();
    const next = setViewSettings({ smoothCurves: !before.smoothCurves });
    expect(next.smoothCurves).toBe(!before.smoothCurves);
    expect(next.colorCurves).toBe(before.colorCurves);
  });

  it('снимок стабилен между вызовами без изменений (для useSyncExternalStore)', () => {
    expect(getViewSettings()).toBe(getViewSettings());
  });

  it('шкала оси X по умолчанию — logE и переключается', () => {
    expect(getViewSettings().xScale).toBe('logE');
    expect(setViewSettings({ xScale: 'lux' }).xScale).toBe('lux');
    expect(getViewSettings().xScale).toBe('lux');
  });
});
