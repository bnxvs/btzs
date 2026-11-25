import { t } from '@/i18n';
import { PRODUCT } from '@/core/model';
import { Dialog, DialogButtons } from '@/ui/components/Dialog';

/**
 * Окно «О программе» (spec: app-shell / «Help and About»).
 *
 * Показывает название и версию продукта, а также сведения об организации и
 * авторских правах BTZS Software / Phil Davis — значения берутся из ресурсов
 * версии `Plotter.exe` (см. `PRODUCT`).
 */
export interface AboutDialogProps {
  /** Закрытие окна. */
  onClose: () => void;
}

export function AboutDialog({ onClose }: AboutDialogProps) {
  return (
    <Dialog
      title={t('about.title')}
      onClose={onClose}
      data-testid="about-dialog"
      footer={<DialogButtons onOk={onClose} onCancel={onClose} okLabel={t('about.close')} />}
    >
      <h2 className="about-product" data-testid="about-product">
        {t('about.productLine')}
      </h2>
      <p className="about-version" data-testid="about-version">
        {t('about.versionLine', PRODUCT.version)}
      </p>
      <p className="about-copyright" data-testid="about-copyright">
        {PRODUCT.copyright}
      </p>
      <p className="about-company" data-testid="about-company">
        {PRODUCT.company} · {PRODUCT.author}
      </p>
      <p className="about-website" data-testid="about-website">
        {t('about.btzs')} — {t('about.website')}
      </p>
    </Dialog>
  );
}
