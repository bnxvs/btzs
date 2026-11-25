import { useState } from 'react';
import { t } from '@/i18n';
import type { FilmDocument, PaperDocument } from '@/core/model';
import { getPrintSettings, setPrintSettings } from '@/store';
import type { PrintSettings } from '@/store';
import { Dialog, DialogButtons } from '@/ui/components/Dialog';
import { printDocument } from './print-service';

/**
 * Диалог «Print Curves» (spec: printing-and-export / «Диалог Print Curves»).
 *
 * Позволяет изменить область печати (весь документ либо только текущая
 * страница) и параметры графиков (сглаживание, цветные кривые, отображение
 * сведений). Значения по умолчанию — «Entire document» и «Color Curves».
 * После подтверждения вызывается системный диалог настройки печати.
 *
 * Настройки сеансовые: сохраняются в `store/print` до следующего изменения или
 * до выхода из программы.
 */
export interface PrintCurvesDialogProps {
  /** Печатаемый документ. */
  doc: FilmDocument | PaperDocument;
  /** Закрытие диалога. */
  onClose: () => void;
  /** Начальные настройки (по умолчанию — текущие сеансовые). */
  settings?: PrintSettings;
  /** Бэк печати (подменяется в тестах). */
  print?: (doc: FilmDocument | PaperDocument, settings: PrintSettings) => Promise<boolean>;
  /** Вызывается после успешной печати (перед закрытием). */
  onPrinted?: () => void;
}

export function PrintCurvesDialog({
  doc,
  onClose,
  settings,
  print,
  onPrinted,
}: PrintCurvesDialogProps) {
  const [current, setCurrent] = useState<PrintSettings>(() => settings ?? getPrintSettings());
  const [failed, setFailed] = useState(false);

  const patch = (next: Partial<PrintSettings>) => {
    setCurrent((prev) => ({ ...prev, ...next }));
  };

  const onPrint = async () => {
    setPrintSettings(current);
    const ok = await (print ?? printDocument)(doc, current);
    if (ok) {
      onPrinted?.();
      onClose();
    } else {
      setFailed(true);
    }
  };

  return (
    <Dialog
      title={t('print.title')}
      onClose={onClose}
      data-testid="print-curves-dialog"
      footer={
        <DialogButtons
          onOk={onPrint}
          onCancel={onClose}
          okLabel={t('print.print')}
          okDataTestId="print-confirm"
        />
      }
    >
      <fieldset className="print-scope">
        <legend>{t('print.scope')}</legend>
        <label>
          <input
            type="radio"
            name="print-scope"
            data-testid="print-entire"
            checked={current.scope === 'entire-document'}
            onChange={() => patch({ scope: 'entire-document' })}
          />
          <span>{t('print.entireDocument')}</span>
        </label>
        <label>
          <input
            type="radio"
            name="print-scope"
            data-testid="print-current-page"
            checked={current.scope === 'current-page'}
            onChange={() => patch({ scope: 'current-page' })}
          />
          <span>{t('print.currentPageOnly')}</span>
        </label>
      </fieldset>

      <fieldset className="print-graphing">
        <legend>{t('print.graphingOptions')}</legend>
        <label>
          <input
            type="checkbox"
            data-testid="print-smooth"
            checked={current.smoothCurves}
            onChange={(e) => patch({ smoothCurves: e.target.checked })}
          />
          <span>{t('print.smoothCurves')}</span>
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="print-color"
            checked={current.colorCurves}
            onChange={(e) => patch({ colorCurves: e.target.checked })}
          />
          <span>{t('print.colorCurves')}</span>
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="print-display-information"
            checked={current.displayInformation}
            onChange={(e) => patch({ displayInformation: e.target.checked })}
          />
          <span>{t('print.displayInformation')}</span>
        </label>
      </fieldset>

      {failed && (
        <p className="dialog-error" role="alert" data-testid="print-error">
          {t('print.failed', t('common.error'))}
        </p>
      )}
    </Dialog>
  );
}
