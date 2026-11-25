import { t } from '@/i18n';
import { Dialog, DialogButtons } from './Dialog';

/**
 * Диалог подтверждения действия (удаление кривой, перезапись клина и т. п.).
 */
export function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  'data-testid': testId,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  'data-testid'?: string;
}) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      data-testid={testId ?? 'confirm-dialog'}
      footer={
        <DialogButtons
          onOk={onConfirm}
          onCancel={onCancel}
          okLabel={confirmLabel ?? t('common.yes')}
          okDataTestId="confirm-ok"
        />
      }
    >
      <p>{message}</p>
    </Dialog>
  );
}
