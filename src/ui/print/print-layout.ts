import { t } from '@/i18n';
import { FILM_CHARTS, PAPER_CHARTS } from '@/core/model';
import type { FilmDocument, PaperDocument } from '@/core/model';
import type { PrintSettings } from '@/store';

/**
 * Раскладка страниц печати (spec: printing-and-export).
 *
 * Чистая логика: по документу и настройкам печати строит список страниц, где
 * каждая страница содержит упорядоченный список ключей графиков. Используется
 * диалогом «Print Curves» и предпросмотром; вынесено из компонентов, чтобы
 * правило «все графики на одной странице» и область печати проверялись
 * юнит-тестами без графической среды.
 *
 * Правила:
 *  - область «Entire document» — все графики документа;
 *  - область «Current page only» — только первая страница раскладки;
 *  - «Print all charts on the same page» включено — все выбранные графики на
 *    одной странице; выключено — каждый график на отдельной странице (крупнее).
 */

/** Графики документа (ключи в порядке панели информации). */
export function documentCharts(doc: FilmDocument | PaperDocument): string[] {
  return doc.kind === 'film' ? [...FILM_CHARTS] : [...PAPER_CHARTS];
}

/** Одна страница печати: список ключей графиков. */
export interface PrintPage {
  /** Ключи графиков на странице (в порядке отрисовки). */
  charts: string[];
}

/** Одна страница задания печати, готовая к передаче бэку. */
export interface PrintJobPage {
  /** Упорядоченные ключи графиков страницы. */
  charts: string[];
  /** Заголовок страницы (номер и общее число страниц). */
  title: string;
}

/** Задание печати. */
export interface PrintJob {
  /** Титул документа. */
  documentTitle: string;
  /** Страницы печати. */
  pages: PrintJobPage[];
  /** Эффективные настройки печати. */
  settings: PrintSettings;
}

/** Строит раскладку страниц печати по документу и настройкам. */
export function layoutPrintPages(
  doc: FilmDocument | PaperDocument,
  settings: PrintSettings,
): PrintPage[] {
  const charts = documentCharts(doc);
  if (charts.length === 0) return [];
  if (settings.allChartsSamePage) {
    return [{ charts }];
  }
  return charts.map((chart) => ({ charts: [chart] }));
}

/**
 * Применяет область печати к раскладке.
 *
 * @param pages   полная раскладка
 * @param settings настройки (используется `scope`)
 */
export function applyPrintScope(pages: PrintPage[], settings: PrintSettings): PrintPage[] {
  if (settings.scope === 'current-page') return pages.slice(0, 1);
  return pages;
}

/** Полная раскладка с учётом области печати. */
export function printPages(
  doc: FilmDocument | PaperDocument,
  settings: PrintSettings,
): PrintPage[] {
  return applyPrintScope(layoutPrintPages(doc, settings), settings);
}

/** Строит задание печати по документу и настройкам. */
export function buildPrintJob(
  doc: FilmDocument | PaperDocument,
  settings: PrintSettings,
): PrintJob {
  const pages = printPages(doc, settings);
  const total = pages.length;
  return {
    documentTitle: doc.family.name || t('print.previewTitle'),
    pages: pages.map((page: PrintPage, index) => ({
      charts: page.charts,
      title: t('print.pageOf', String(index + 1), String(total)),
    })),
    settings,
  };
}
