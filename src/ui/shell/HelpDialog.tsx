import { t } from '@/i18n';
import { Dialog, DialogButtons } from '@/ui/components/Dialog';

/**
 * Встроенная справка приложения (spec: app-shell / «Открытие справки»).
 *
 * Показывает оглавление тем (соответствует разделам исходного файла справки);
 * открывается из меню «Help Topics» или по F1. Содержимое — из каталога
 * переводов, без англоязычных фрагментов (spec: localization).
 */
export interface HelpDialogProps {
  /** Закрытие окна справки. */
  onClose: () => void;
}

/** Темы справки: ключ подписи + ключ краткого описания. */
const TOPICS: readonly { title: string; body: string }[] = [
  { title: 'help.overview', body: 'help.overviewBody' },
  { title: 'help.files', body: 'help.filesBody' },
  { title: 'help.tabs', body: 'help.tabsBody' },
  { title: 'help.matcher', body: 'help.matcherBody' },
  { title: 'help.charts', body: 'help.chartsBody' },
  { title: 'help.printing', body: 'help.printingBody' },
];

export function HelpDialog({ onClose }: HelpDialogProps) {
  return (
    <Dialog
      title={t('help.title')}
      onClose={onClose}
      data-testid="help-dialog"
      footer={<DialogButtons onOk={onClose} onCancel={onClose} okLabel={t('common.close')} />}
    >
      <ul className="help-topics" data-testid="help-topics">
        {TOPICS.map((topic) => (
          <li key={topic.title} className="help-topic" data-testid={`help-${topic.title}`}>
            <h3>{t(topic.title as never)}</h3>
            <p>{t(topic.body as never)}</p>
          </li>
        ))}
      </ul>
      <p className="help-footer" data-testid="help-footer">
        {t('help.footer')}
      </p>
    </Dialog>
  );
}
