import { t } from '@/i18n';
import type { FilmDocument, PaperDocument } from '@/core/model';
import type { FamilyPlot } from '@/core/analysis';
import type { PrintSettings } from '@/store';
import { chartLabel } from '@/ui/charts/chart-label';
import { FamilyChart } from '@/ui/charts/FamilyChart';
import { ChartCanvas, buildChartSpec } from '@/ui/charts/chart-render';

/**
 * Содержимое одной страницы печати (spec: printing-and-export / «Отрисовка
 * кривых при печати»).
 *
 * Общее представление для предпросмотра на экране (`PrintPreview`) и для
 * печатного документа, передаваемого системному диалогу (`print-service`):
 * заголовок, график семейства характеристических кривых и каждый выбранный
 * график вкладки Charts — теми же представлениями, что и на экране.
 */
export interface PrintPageContentProps {
  /** Документ. */
  doc: FilmDocument | PaperDocument;
  /** Заголовок страницы (титул документа либо «Страница N из M»). */
  title: string;
  /** Упорядоченные ключи графиков страницы. */
  charts: string[];
  /** Настройки печати. */
  settings: PrintSettings;
  /** График семейства (строится один раз на документ). */
  family: FamilyPlot;
  /** Префикс идентификаторов для тестов (у печатной копии — свой). */
  testIdPrefix?: string;
}

export function PrintPageContent({
  doc,
  title,
  charts,
  settings,
  family,
  testIdPrefix = '',
}: PrintPageContentProps) {
  const id = (name: string) => `${testIdPrefix}${name}`;
  return (
    <>
      <h4>{title}</h4>
      <figure className="print-figure" data-testid={id('print-family')}>
        <figcaption>{t('familyChart.title')}</figcaption>
        <FamilyChart
          plot={family}
          xTitle={t('familyChart.axis.logE')}
          yTitle={t('familyChart.axis.density')}
          showGrid={settings.gridLineWidth > 0}
          colorCurves={settings.colorCurves}
          ariaLabel={t('familyChart.title')}
          testId={id('print-family-chart')}
        />
      </figure>
      {charts.map((chart) => (
        <figure key={chart} className="print-figure" data-testid={id(`print-chart-${chart}`)}>
          <figcaption>{chartLabel(chart)}</figcaption>
          <ChartCanvas
            spec={buildChartSpec(doc, chart)}
            testId={id(`print-svg-${chart}`)}
            className="chart-svg print-chart-svg"
          />
        </figure>
      ))}
    </>
  );
}
