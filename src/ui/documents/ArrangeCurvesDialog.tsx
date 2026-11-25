import { useState } from 'react';
import { t } from '@/i18n';
import type { Curve, CurveDocument } from '@/core/model';
import { Dialog, DialogButtons } from '@/ui/components/Dialog';

/**
 * Диалог «Упорядочить кривые» (Arrange Curves).
 *
 * Spec (film-documents / «Изменение порядка кривых»): пользователь выделяет
 * кривую и перемещает её вверх или вниз; порядок кривых в семействе
 * изменяется соответственно.
 */
export interface ArrangeCurvesDialogProps {
  doc: CurveDocument;
  /** Применение нового порядка кривых. */
  onReorder: (curves: Curve[]) => void;
  /** Закрытие без изменений. */
  onClose: () => void;
}

export function ArrangeCurvesDialog({ doc, onReorder, onClose }: ArrangeCurvesDialogProps) {
  const [order, setOrder] = useState<Curve[]>(() => [...doc.curves]);
  const [selected, setSelected] = useState(0);

  const move = (delta: -1 | 1) => {
    const target = selected + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(selected, 1);
    next.splice(target, 0, moved);
    setOrder(next);
    setSelected(target);
  };

  return (
    <Dialog
      title={t('curves.arrangeTitle')}
      onClose={onClose}
      data-testid="arrange-dialog"
      footer={
        <DialogButtons onOk={() => onReorder(order)} onCancel={onClose} />
      }
    >
      <ul className="arrange-list" role="listbox" aria-label={t('curves.arrangeTitle')}>
        {order.map((curve, i) => (
          <li key={`${curve.label}-${i}`}>
            <button
              type="button"
              role="option"
              aria-selected={selected === i}
              className={selected === i ? 'arrange-item selected' : 'arrange-item'}
              data-testid={`arrange-item-${i}`}
              onClick={() => setSelected(i)}
            >
              {curve.label || `${t('data.curve')} ${i + 1}`}
            </button>
          </li>
        ))}
      </ul>
      <div className="arrange-buttons">
        <button
          type="button"
          data-testid="arrange-up"
          disabled={selected <= 0}
          onClick={() => move(-1)}
        >
          {t('common.moveUp')}
        </button>
        <button
          type="button"
          data-testid="arrange-down"
          disabled={selected >= order.length - 1}
          onClick={() => move(1)}
        >
          {t('common.moveDown')}
        </button>
      </div>
    </Dialog>
  );
}
