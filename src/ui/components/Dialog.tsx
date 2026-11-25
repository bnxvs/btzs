import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { t } from '@/i18n';

/**
 * Базовый модальный диалог ( рамка для окон-диалогов приложения ).
 *
 * Доступность: `role="dialog"`, `aria-modal`, заголовок связан через
 * `aria-labelledby`; Escape закрывает диалог (кнопка отмены).
 */
export interface DialogProps {
  /** Заголовок окна. */
  title: string;
  /** Содержимое диалога. */
  children: ReactNode;
  /** Кнопки внизу диалога (обычно ОК/Отмена). */
  footer?: ReactNode;
  /** Вызывается при закрытии (Escape или кнопка отмены). */
  onClose: () => void;
  /** Идентификатор для тестов/ссылок. */
  'data-testid'?: string;
}

export function Dialog({ title, children, footer, onClose, ...rest }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    // Слушается на фазе перехвата, чтобы закрывать диалог из любого поля ввода.
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  return (
    <div className="dialog-overlay">
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={rest['data-testid']}
      >
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-footer">{footer ?? (
          <button type="button" onClick={onClose}>
            {t('common.ok')}
          </button>
        )}</div>
      </div>
    </div>
  );
}

/** Кнопка «ОК»/«Отмена» для подвала диалога. */
export function DialogButtons({
  onOk,
  onCancel,
  okLabel,
  cancelLabel,
  okDisabled,
  okDataTestId,
}: {
  onOk?: () => void;
  onCancel: () => void;
  okLabel?: string;
  cancelLabel?: string;
  okDisabled?: boolean;
  okDataTestId?: string;
}) {
  return (
    <>
      <button type="button" onClick={onCancel} data-testid="dialog-cancel">
        {cancelLabel ?? t('common.cancel')}
      </button>
      {onOk && (
        <button
          type="button"
          onClick={onOk}
          disabled={okDisabled}
          data-testid={okDataTestId ?? 'dialog-ok'}
        >
          {okLabel ?? t('common.ok')}
        </button>
      )}
    </>
  );
}
