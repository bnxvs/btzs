import { useState } from 'react';
import { formatNumber, parseNumber, t } from '@/i18n';
import type { FilmDocument, MatcherApproximatedCurve } from '@/core/model';
import {
  approximateFilmCurve,
  curveToApproximated,
  familyMetricRange,
} from '@/core/analysis';
import type { ApproximationBy } from '@/core/analysis';
import { Dialog, DialogButtons } from '@/ui/components/Dialog';

/**
 * Диалог «Управление приближёнными кривыми» (spec: matcher / «Approximated
 * film curves»).
 *
 * Позволяет задать значение SBR или средней G и добавить приближённую кривую;
 * при выходе значения за диапазон семейства показывается сообщение; выбранную
 * кривую можно удалить.
 */
export interface ApproximatedCurvesDialogProps {
  /** Документ плёнки (для диапазона семейства). */
  film: FilmDocument;
  /** Текущие приближённые кривые документа. */
  curves: readonly MatcherApproximatedCurve[];
  /** Добавление новой приближённой кривой. */
  onAdd: (curve: MatcherApproximatedCurve) => void;
  /** Удаление приближённой кривой по индексу. */
  onRemove: (index: number) => void;
  /** Закрытие диалога. */
  onClose: () => void;
}

export function ApproximatedCurvesDialog({
  film,
  curves,
  onAdd,
  onRemove,
  onClose,
}: ApproximatedCurvesDialogProps) {
  const [by, setBy] = useState<ApproximationBy>('sbr');
  const [text, setText] = useState('');
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const value = parseNumber(text);
    if (Number.isNaN(value)) return;
    const range = familyMetricRange(film, by, film.analysisParams);
    if (!range) {
      setError(t('matcher.approx.needCurves'));
      return;
    }
    const result = approximateFilmCurve(film, by, value, film.analysisParams);
    if (!result || result.outOfRange) {
      setError(t('matcher.approx.notInRange'));
      return;
    }
    onAdd(curveToApproximated(result.curve));
    onClose();
  };

  return (
    <Dialog
      title={t('matcher.approx.title')}
      onClose={onClose}
      data-testid="approx-curves-dialog"
      footer={<DialogButtons onOk={add} cancelLabel={t('common.close')} onCancel={onClose} />}
    >
      <label className="dialog-field">
        <span>{t('matcher.approx.by')}</span>
        <select
          data-testid="approx-by"
          value={by}
          onChange={(e) => setBy(e.target.value as ApproximationBy)}
        >
          <option value="sbr">{t('matcher.approx.bySbr')}</option>
          <option value="g">{t('matcher.approx.byG')}</option>
        </select>
      </label>
      <label className="dialog-field">
        <span>{t('matcher.approx.value')}</span>
        <input
          type="text"
          inputMode="decimal"
          data-testid="approx-value"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
        />
      </label>
      {error && (
        <p className="dialog-error" role="alert" data-testid="approx-error">
          {error}
        </p>
      )}

      <h3>{t('matcher.approx.list')}</h3>
      {curves.length === 0 ? (
        <p className="dialog-hint">{t('matcher.noCurves')}</p>
      ) : (
        <ul className="approx-list" role="listbox" aria-label={t('matcher.approx.list')}>
          {curves.map((curve, i) => (
            <li key={`${curve.label}-${i}`}>
              <button
                type="button"
                role="option"
                aria-selected={selected === i}
                className={selected === i ? 'approx-item selected' : 'approx-item'}
                data-testid={`approx-item-${i}`}
                onClick={() => setSelected(i)}
              >
                {curve.outOfRange ? `${curve.label} ${t('matcher.approx.outOfRange')}` : curve.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {curves.length > 0 && (
        <button
          type="button"
          data-testid="approx-remove"
          disabled={curves.length === 0}
          onClick={() => {
            onRemove(selected);
            setSelected(0);
          }}
        >
          {t('matcher.approx.remove')}
        </button>
      )}
      <p className="dialog-hint">
        {formatNumber(film.analysisParams.es, 2)} {t('analysis.es')}
      </p>
    </Dialog>
  );
}
