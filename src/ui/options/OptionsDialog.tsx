import { useState } from 'react';
import { t } from '@/i18n';
import { AnalysisMethod, ReferenceCurveType } from '@/core/model';
import type { AnalysisParams } from '@/core/model';
import { getOptions, restoreDefaultOptions, saveOptions } from '@/store';
import type { ProgramOptions } from '@/store';
import { Dialog, DialogButtons } from '@/ui/components/Dialog';
import { NumberField } from '@/ui/components/NumberField';

/**
 * Диалог «Options» (spec: program-options / «Options dialog content»).
 *
 * Группы «Analysis defaults», «Display defaults», «Display and printing
 * options» и «Matcher defaults», а также кнопка «Restore Defaults». Значения
 * сохраняются как персональные значения по умолчанию и используются при
 * создании новых документов.
 */
export interface OptionsDialogProps {
  /** Закрытие диалога. */
  onClose: () => void;
  /** Начальные значения (по умолчанию — текущие персональные). */
  initial?: ProgramOptions;
  /** Сохранение значений (по умолчанию — `store/options`). */
  onSave?: (options: ProgramOptions) => void;
}

export function OptionsDialog({ onClose, initial, onSave }: OptionsDialogProps) {
  const [options, setOptions] = useState<ProgramOptions>(() => initial ?? getOptions());

  const patchAnalysis = (patch: Partial<AnalysisParams>) =>
    setOptions((prev) => ({ ...prev, analysis: { ...prev.analysis, ...patch } }));

  const onOk = () => {
    (onSave ?? saveOptions)(options);
    onClose();
  };

  const onRestore = () => {
    // Кнопка немедленно возвращает значения по умолчанию во всех группах.
    setOptions(restoreDefaultOptions());
  };

  return (
    <Dialog
      title={t('options.title')}
      onClose={onClose}
      data-testid="options-dialog"
      footer={
        <>
          <button type="button" onClick={onRestore} data-testid="options-restore">
            {t('options.restoreDefaults')}
          </button>
          <DialogButtons
            onOk={onOk}
            onCancel={onClose}
            okDataTestId="options-ok"
          />
        </>
      }
    >
      <fieldset className="options-group" data-testid="options-analysis">
        <legend>{t('options.analysis')}</legend>
        <NumberField
          testId="options-es"
          label={t('analysis.es')}
          className="options-field"
          value={options.analysis.es}
          fractionDigits={1}
          onChange={(v) => patchAnalysis({ es: v })}
        />
        <NumberField
          testId="options-flare"
          label={t('charts.flareDensity')}
          className="options-field"
          value={options.analysis.flareDensity}
          fractionDigits={2}
          onChange={(v) => patchAnalysis({ flareDensity: v })}
        />
        <NumberField
          testId="options-zone-spread"
          label={t('charts.zoneSpread')}
          className="options-field"
          value={options.analysis.zoneSpread}
          inputMode="numeric"
          fractionDigits={0}
          onChange={(v) => patchAnalysis({ zoneSpread: v })}
        />
        <label className="options-field">
          <span>{t('analysis.method')}</span>
          <select
            data-testid="options-method"
            value={options.analysis.method}
            onChange={(e) =>
              patchAnalysis({ method: e.target.value as AnalysisParams['method'] })
            }
          >
            <option value={AnalysisMethod.ApproximateCI}>{t('analysis.approximateCi')}</option>
            <option value={AnalysisMethod.OverFbF}>{t('analysis.overFbF')}</option>
          </select>
        </label>
        <NumberField
          testId="options-personal-speed-point"
          label={t('analyze.personalSpeedPoint')}
          className="options-field"
          value={options.analysis.personalSpeedPoint}
          fractionDigits={1}
          onChange={(v) => patchAnalysis({ personalSpeedPoint: v })}
        />
      </fieldset>

      <fieldset className="options-group" data-testid="options-display">
        <legend>{t('options.display')}</legend>
        <Toggle
          testId="options-display-information"
          label={t('print.displayInformation')}
          checked={options.display.displayInformation}
          onChange={(v) => setOptions((p) => ({ ...p, display: { ...p.display, displayInformation: v } }))}
        />
        <Toggle
          testId="options-smooth-curves"
          label={t('print.smoothCurves')}
          checked={options.display.smoothCurves}
          onChange={(v) => setOptions((p) => ({ ...p, display: { ...p.display, smoothCurves: v } }))}
        />
        <Toggle
          testId="options-color-curves"
          label={t('print.colorCurves')}
          checked={options.display.colorCurves}
          onChange={(v) => setOptions((p) => ({ ...p, display: { ...p.display, colorCurves: v } }))}
        />
        <Toggle
          testId="options-display-grid"
          label={t('options.displayGrid')}
          checked={options.display.displayGrid}
          onChange={(v) => setOptions((p) => ({ ...p, display: { ...p.display, displayGrid: v } }))}
        />
      </fieldset>

      <fieldset className="options-group" data-testid="options-printing">
        <legend>{t('options.displayPrinting')}</legend>
        <NumberField
          testId="options-grid-line-width"
          label={t('print.gridLineWidth')}
          className="options-field"
          value={options.printing.gridLineWidth}
          inputMode="numeric"
          fractionDigits={0}
          onChange={(v) =>
            setOptions((p) => ({ ...p, printing: { ...p.printing, gridLineWidth: v } }))
          }
        />
        <NumberField
          testId="options-print-grid-line-width"
          label={t('print.printGridLineWidth')}
          className="options-field"
          value={options.printing.printGridLineWidth}
          inputMode="numeric"
          fractionDigits={0}
          onChange={(v) =>
            setOptions((p) => ({ ...p, printing: { ...p.printing, printGridLineWidth: v } }))
          }
        />
        <Toggle
          testId="options-all-charts-same-page"
          label={t('print.allChartsSamePage')}
          checked={options.printing.printAllChartsOnSamePage}
          onChange={(v) =>
            setOptions((p) => ({ ...p, printing: { ...p.printing, printAllChartsOnSamePage: v } }))
          }
        />
      </fieldset>

      <fieldset className="options-group" data-testid="options-matcher">
        <legend>{t('options.matcher')}</legend>
        <label className="options-field">
          <span>{t('matcher.reference.title')}</span>
          <select
            data-testid="options-reference-curve"
            value={options.matcher.referenceCurveType}
            onChange={(e) =>
              setOptions((p) => ({
                ...p,
                matcher: { ...p.matcher, referenceCurveType: e.target.value as never },
              }))
            }
          >
            <option value={ReferenceCurveType.Default}>{t('matcher.reference.default')}</option>
            <option value={ReferenceCurveType.Flared}>{t('matcher.reference.flared')}</option>
          </select>
        </label>
      </fieldset>
    </Dialog>
  );
}

/** Переключатель с подписью. */
function Toggle({
  testId,
  label,
  checked,
  onChange,
}: {
  testId: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="options-field">
      <input
        type="checkbox"
        data-testid={testId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
