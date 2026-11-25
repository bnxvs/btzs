import { t } from '@/i18n';
import { FilmChart, PaperChart } from '@/core/model';

/**
 * Подпись графика по его ключу.
 *
 * Общая для вкладки Charts и предпросмотра печати, чтобы названия графиков не
 * расходились между экраном и печатью (spec: localization — весь текст из
 * каталога переводов).
 */
export function chartLabel(key: string): string {
  switch (key) {
    case FilmChart.DevTimeSbr:
      return t('charts.devTimeSbr');
    case FilmChart.DevTimeG:
      return t('charts.devTimeG');
    case FilmChart.DevTimeN:
      return t('charts.devTimeN');
    case FilmChart.EfsSbr:
      return t('charts.efsSbr');
    case FilmChart.EfsG:
      return t('charts.efsG');
    case FilmChart.EfsN:
      return t('charts.efsN');
    case PaperChart.IsoRange:
      return t('charts.isoRange');
    default:
      return t('charts.paperGrade');
  }
}
