/**
 * Тесты окна опций (задачи 10.1–10.3).
 *
 * Хранение и область действия проверяются юнит-тестами `store/options`; диалог
 * — тестом компонента.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisMethod, ReferenceCurveType } from '@/core/model';
import { setLocale } from '@/i18n';
import {
  OPTIONS_STORAGE_KEY,
  analysisParamsFromOptions,
  createNewFilm,
  createNewPaper,
  defaultOptions,
  getOptions,
  parseOptions,
  resetOptionsToDefaults,
  restoreDefaultOptions,
  saveOptions,
  setOptions,
} from '@/store';
import { OptionsDialog } from './OptionsDialog';

beforeEach(() => {
  setLocale('ru');
  resetOptionsToDefaults();
});
afterEach(() => {
  setLocale('ru');
  resetOptionsToDefaults();
});

describe('10.1 Диалог Options', () => {
  it('показывает значения по умолчанию всех групп', () => {
    render(<OptionsDialog onClose={() => undefined} />);
    expect(screen.getByTestId('options-analysis')).toBeInTheDocument();
    expect(screen.getByTestId('options-display')).toBeInTheDocument();
    expect(screen.getByTestId('options-printing')).toBeInTheDocument();
    expect(screen.getByTestId('options-matcher')).toBeInTheDocument();
    expect(screen.getByTestId('options-es')).toHaveValue('1,0');
    expect(screen.getByTestId('options-flare')).toHaveValue('0,00');
    expect(screen.getByTestId('options-zone-spread')).toHaveValue('4');
    expect(screen.getByTestId('options-method')).toHaveValue(AnalysisMethod.ApproximateCI);
    expect(screen.getByTestId('options-personal-speed-point')).toHaveValue('2,4');
    expect(screen.getByTestId('options-display-information')).toBeChecked();
    expect(screen.getByTestId('options-smooth-curves')).not.toBeChecked();
    expect(screen.getByTestId('options-color-curves')).toBeChecked();
    expect(screen.getByTestId('options-display-grid')).toBeChecked();
    expect(screen.getByTestId('options-all-charts-same-page')).toBeChecked();
    expect(screen.getByTestId('options-reference-curve')).toHaveValue(ReferenceCurveType.Default);
  });

  it('изменение значений сохраняется как персональные по умолчанию', async () => {
    const user = userEvent.setup();
    render(<OptionsDialog onClose={() => undefined} />);
    await user.selectOptions(screen.getByTestId('options-method'), AnalysisMethod.OverFbF);
    await user.click(screen.getByTestId('options-smooth-curves'));
    await user.click(screen.getByTestId('options-ok'));
    const saved = getOptions();
    expect(saved.analysis.method).toBe(AnalysisMethod.OverFbF);
    expect(saved.display.smoothCurves).toBe(true);
  });

  it('метод обновляется и сохраняется через переданный onSave', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<OptionsDialog onClose={onClose} onSave={onSave} />);
    await user.selectOptions(screen.getByTestId('options-method'), AnalysisMethod.OverFbF);
    await user.click(screen.getByTestId('options-ok'));
    expect(onSave.mock.calls[0][0].analysis.method).toBe(AnalysisMethod.OverFbF);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('10.2 Restore Defaults', () => {
  it('возвращает все значения к умолчаниям', async () => {
    const user = userEvent.setup();
    render(<OptionsDialog onClose={() => undefined} />);
    await user.selectOptions(screen.getByTestId('options-method'), AnalysisMethod.OverFbF);
    await user.click(screen.getByTestId('options-smooth-curves'));
    await user.click(screen.getByTestId('options-restore'));
    expect(getOptions()).toEqual(defaultOptions());
    expect(screen.getByTestId('options-method')).toHaveValue(AnalysisMethod.ApproximateCI);
    expect(screen.getByTestId('options-smooth-curves')).not.toBeChecked();
  });
});

describe('10.3 Персистентность и область действия', () => {
  it('персональные значения используются при создании новых документов', () => {
    setOptions({
      analysis: { method: AnalysisMethod.OverFbF, es: 1.5, flareDensity: 0.02, zoneSpread: 5, personalSpeedPoint: 2.7 },
    });
    const film = createNewFilm();
    const paper = createNewPaper();
    expect(film.analysisParams.es).toBeCloseTo(1.5, 10);
    expect(film.analysisParams.method).toBe(AnalysisMethod.OverFbF);
    expect(paper.analysisParams.zoneSpread).toBe(5);
    expect(analysisParamsFromOptions().flareDensity).toBeCloseTo(0.02, 10);
  });

  it('значения сохраняются между перезагрузками (парсинг хранилища)', () => {
    saveOptions({
      ...defaultOptions(),
      analysis: { ...defaultOptions().analysis, es: 2.0 },
    });
    const raw = globalThis.localStorage?.getItem(OPTIONS_STORAGE_KEY) ?? null;
    // Хранилище может быть недоступно (Node) — тогда проверяем round-trip логики.
    const parsed = raw ? parseOptions(raw) : getOptions();
    expect(parsed.analysis.es).toBeCloseTo(2.0, 10);
  });

  it('parseOptions заменяет испорченные группы умолчаниями', () => {
    const parsed = parseOptions(JSON.stringify({ analysis: { es: 'нет' }, display: null }));
    expect(parsed.analysis.es).toBeCloseTo(defaultOptions().analysis.es, 10);
    expect(parsed.display).toEqual(defaultOptions().display);
  });

  it('локальное изменение ES в документе не меняет значения по умолчанию', () => {
    const doc = createNewFilm();
    const localized = { ...doc, analysisParams: { ...doc.analysisParams, es: 9 } };
    expect(localized.analysisParams.es).toBe(9);
    expect(getOptions().analysis.es).toBeCloseTo(defaultOptions().analysis.es, 10);
    expect(createNewFilm().analysisParams.es).toBeCloseTo(defaultOptions().analysis.es, 10);
  });

  it('restoreDefaultOptions сбрасывает персональные значения', () => {
    setOptions({ analysis: { ...getOptions().analysis, es: 3 } });
    restoreDefaultOptions();
    expect(getOptions()).toEqual(defaultOptions());
  });
});
