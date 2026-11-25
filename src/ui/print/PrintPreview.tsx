import { useState, useSyncExternalStore } from 'react';
import { t } from '@/i18n';
import type { FilmDocument, PaperDocument } from '@/core/model';
import { buildFamilyPlot } from '@/core/analysis';
import { getViewSettings, subscribeViewSettings } from '@/store';
import type { PrintSettings } from '@/store';
import { Dialog } from '@/ui/components/Dialog';
import { buildPrintJob } from './print-layout';
import { PrintPageContent } from './PrintPageContent';

/**
 * Предпросмотр печати (spec: printing-and-export / «Предпросмотр печати»).
 *
 * Показывает страницы задания печати, позволяет переходить по страницам
 * («предыдущая»/«следующая»), возвращаться на первую и менять масштаб.
 * Содержимое страницы — общее с печатным документом (`PrintPageContent`):
 * график семейства характеристических кривых (spec: charts / «Family curve
 * graph») и перечисленные графики вкладки Charts.
 */
export interface PrintPreviewProps {
  /** Документ. */
  doc: FilmDocument | PaperDocument;
  /** Настройки печати (из диалога Print Curves). */
  settings: PrintSettings;
  /** Закрытие предпросмотра. */
  onClose: () => void;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PrintPreview({ doc, settings, onClose }: PrintPreviewProps) {
  const job = buildPrintJob(doc, settings);
  const [page, setPage] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(2); // 1.0
  const view = useSyncExternalStore(subscribeViewSettings, getViewSettings, getViewSettings);

  const total = job.pages.length;
  const current = job.pages[page];

  const zoomIn = () => setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1));
  const zoomOut = () => setZoomIndex((i) => Math.max(i - 1, 0));

  const family = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams, {
    smooth: settings.smoothCurves,
  });

  return (
    <Dialog
      title={t('print.previewTitle')}
      onClose={onClose}
      data-testid="print-preview"
      footer={
        <>
          <button type="button" onClick={() => setPage(0)} disabled={page === 0} data-testid="print-first">
            {t('common.reset')}
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
            disabled={page === 0}
            data-testid="print-prev"
          >
            {t('common.moveUp')}
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(p + 1, total - 1))}
            disabled={page >= total - 1}
            data-testid="print-next"
          >
            {t('common.moveDown')}
          </button>
          <button type="button" onClick={zoomOut} disabled={zoomIndex === 0} data-testid="print-zoom-out">
            {t('print.zoomOut')}
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            data-testid="print-zoom-in"
          >
            {t('print.zoomIn')}
          </button>
          <button type="button" onClick={onClose} data-testid="print-close">
            {t('common.close')}
          </button>
        </>
      }
    >
      <p className="print-page-label" data-testid="print-page-label">
        {current?.title ?? t('print.pageOf', '1', '1')}
      </p>
      <div
        className="print-page"
        data-testid="print-page"
        data-page={page}
        data-zoom={ZOOM_STEPS[zoomIndex]}
        style={{ transform: `scale(${ZOOM_STEPS[zoomIndex]})` }}
      >
        <PrintPageContent
          doc={doc}
          title={job.documentTitle}
          charts={current?.charts ?? []}
          settings={settings}
          family={family}
          xScale={view.xScale}
        />
      </div>
    </Dialog>
  );
}
