import { t } from '@/i18n';
import { Dialog } from '@/ui/components/Dialog';

/**
 * Запрос сохранения при закрытии документа с несохранёнными изменениями
 * (spec: app-shell / «Закрытие документа с несохранёнными изменениями»).
 *
 * Выбор «Сохранить / Не сохранять / Отмена» соответствует MFC-запросу
 * «Save changes to %1?».
 */
export interface ClosePromptDialogProps {
  /** Имя документа для сообщения. */
  name: string;
  /** Сохранить и закрыть. */
  onSave: () => void;
  /** Закрыть без сохранения. */
  onDiscard: () => void;
  /** Отменить закрытие. */
  onCancel: () => void;
}

export function ClosePromptDialog({ name, onSave, onDiscard, onCancel }: ClosePromptDialogProps) {
  return (
    <Dialog
      title={t('common.save')}
      onClose={onCancel}
      data-testid="close-prompt"
      footer={
        <>
          <button type="button" onClick={onDiscard} data-testid="close-discard">
            {t('common.no')}
          </button>
          <button type="button" onClick={onCancel} data-testid="close-cancel">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={onSave} data-testid="close-save">
            {t('common.yes')}
          </button>
        </>
      }
    >
      <p data-testid="close-prompt-message">{t('shell.closePrompt', name)}</p>
    </Dialog>
  );
}
