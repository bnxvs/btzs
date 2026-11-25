import { renderToStaticMarkup } from 'react-dom/server';
import type { FilmDocument, PaperDocument } from '@/core/model';
import { buildFamilyPlot } from '@/core/analysis';
import type { PrintSettings } from '@/store';
import { PrintPageContent } from './PrintPageContent';
import type { PrintJob } from './print-layout';

/**
 * Печатный документ (spec: printing-and-export / «Отрисовка кривых при печати»).
 *
 * `window.print()` печатает текущий DOM окна, поэтому одной логики раскладки
 * мало: помимо интерфейса (меню, вкладки, диалог «Print Curves», строка
 * состояния) в макет попадали элементы, которых на бумаге быть не должно.
 *
 * Решение — отдельный печатный корень `#print-root` вне оболочки приложения:
 *  - на экране он скрыт (`display: none`);
 *  - в режиме печати (`@media print`) скрывается оболочка `.app-shell`, а
 *    печатается только `#print-root` с чистым содержимым страниц.
 *
 * Так печатается ровно задание печати — как в исходной программе, где печать
 * рисует страницы документа, а не окно интерфейса.
 */

/** Идентификатор печатного корня. */
export const PRINT_ROOT_ID = 'print-root';

/** Содержимое печатного корня: все страницы задания подряд. */
function PrintRoot({
  doc,
  job,
  settings,
}: {
  doc: FilmDocument | PaperDocument;
  job: PrintJob;
  settings: PrintSettings;
}) {
  const family = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams, {
    smooth: settings.smoothCurves,
  });
  return (
    <div className="print-document" data-testid="print-document">
      {job.pages.map((page, index) => (
        <article
          key={index}
          className="print-page"
          data-testid="print-document-page"
          data-page={index}
        >
          <PrintPageContent
            doc={doc}
            title={job.documentTitle}
            charts={page.charts}
            settings={settings}
            family={family}
            testIdPrefix="print-document-"
          />
        </article>
      ))}
    </div>
  );
}

/**
 * Монтирует печатный корень с заданием печати и возвращает функцию очистки.
 *
 * Содержимое собирается статической разметкой (`renderToStaticMarkup`): она
 * синхронна и не создаёт отдельного дерева React — печать не зависит от
 * жизненного цикла приложения и не влияет на него.
 */
export function mountPrintRoot(
  doc: FilmDocument | PaperDocument,
  job: PrintJob,
  settings: PrintSettings,
): () => void {
  const host = document.createElement('div');
  host.id = PRINT_ROOT_ID;
  host.innerHTML = renderToStaticMarkup(<PrintRoot doc={doc} job={job} settings={settings} />);
  document.body.appendChild(host);
  document.body.classList.add('printing');
  return () => {
    host.remove();
    document.body.classList.remove('printing');
  };
}
