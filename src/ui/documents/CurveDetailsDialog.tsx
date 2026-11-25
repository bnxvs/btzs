import { useState } from 'react';
import { t } from '@/i18n';
import { parseDevTime } from '@/core/model';
import type { Curve } from '@/core/model';
import { Dialog, DialogButtons } from '@/ui/components/Dialog';

/**
 * Диалог параметров кривой (Curve Details).
 *
 * Плёнка: время проявления («минуты:секунды» или десятичное) и примечания;
 * бумага: «ID or Name». Для обоих — флажок «Не соединять на графике».
 *
 * Spec (film-documents / «Ввод времени проявления», «Некорректный формат
 * времени»): некорректное время (например, `N5.5`) не блокирует сохранение —
 * кривая помечается как некорректная и не отображается на графиках «Dev».
 */
export interface CurveDetailsDialogProps {
  /** Режим: плёнка (время проявления) или бумага (ID/Name). */
  kind: 'film' | 'paper';
  /** Редактируемая кривая (label/note/dontConnectInChart). */
  curve: Pick<Curve, 'label' | 'note' | 'dontConnectInChart'>;
  /** Сохранение (кривая с введёнными полями). */
  onSave: (curve: Pick<Curve, 'label' | 'note' | 'dontConnectInChart'>) => void;
  /** Отмена. */
  onCancel: () => void;
}

export function CurveDetailsDialog({ kind, curve, onSave, onCancel }: CurveDetailsDialogProps) {
  const [label, setLabel] = useState(curve.label);
  const [note, setNote] = useState(curve.note);
  const [dontConnect, setDontConnect] = useState(curve.dontConnectInChart);

  const invalidTime = kind === 'film' && label.trim() !== '' && parseDevTime(label) === null;

  return (
    <Dialog
      title={t('curveDetails.title')}
      onClose={onCancel}
      data-testid="curve-details-dialog"
      footer={
        <DialogButtons
          onOk={() => onSave({ label, note, dontConnectInChart: dontConnect })}
          onCancel={onCancel}
        />
      }
    >
      <label className="dialog-field">
        <span>{kind === 'film' ? t('curveDetails.devTime') : t('curveDetails.idOrName')}</span>
        <input
          type="text"
          value={label}
          data-testid="curve-label"
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      {kind === 'film' && <p className="dialog-hint">{t('curveDetails.devTimeHint')}</p>}
      {invalidTime && (
        <p className="dialog-error" role="alert" data-testid="curve-invalid-warning">
          {t('curveDetails.curveInvalid')}
        </p>
      )}
      <label className="dialog-field">
        <span>{t('curveDetails.note')}</span>
        <input
          type="text"
          value={note}
          data-testid="curve-note"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <label className="dialog-check">
        <input
          type="checkbox"
          checked={dontConnect}
          data-testid="curve-dont-connect"
          onChange={(e) => setDontConnect(e.target.checked)}
        />
        <span>{t('curveDetails.dontConnect')}</span>
      </label>
    </Dialog>
  );
}
