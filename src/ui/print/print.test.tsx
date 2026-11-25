/**
 * Тесты печати и предпросмотра (задачи 9.1–9.4).
 *
 * Раскладка страниц проверяется юнит-тестами; диалоги — тестами компонента;
 * системный диалог печати подменяется бэком.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFilm, readPaper } from '@/core/format';
import { FILM_CHARTS, PAPER_CHARTS } from '@/core/model';
import type { FilmDocument, PaperDocument } from '@/core/model';
import { setLocale } from '@/i18n';
import {
  defaultPrintSettings,
  getPrintSettings,
  resetPrintSettings,
  setPrintSettings,
} from '@/store';
import { PrintCurvesDialog } from './PrintCurvesDialog';
import { PrintPreview } from './PrintPreview';
import { applyPrintScope, documentCharts, layoutPrintPages, printPages } from './print-layout';
import { buildPrintJob, printDocument, setPrintBackend } from './print-service';
import { PRINT_ROOT_ID } from './print-root';

const APP_DIR = join(process.cwd(), 'app');

function filmFixture(): FilmDocument {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, '400 TMax ID-11 2+3 75.pfc'))));
}
function paperFixture(): PaperDocument {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, 'Agfa_MCC.ppc'))));
}

beforeEach(() => {
  setLocale('ru');
  resetPrintSettings();
});
afterEach(() => {
  setLocale('ru');
  resetPrintSettings();
  setPrintBackend(null);
});

describe('9.4 Раскладка страниц печати', () => {
  it('графики документа: плёнка — шесть, бумага — два', () => {
    expect(documentCharts(filmFixture())).toEqual([...FILM_CHARTS]);
    expect(documentCharts(paperFixture())).toEqual([...PAPER_CHARTS]);
  });

  it('«все графики на одной странице» даёт одну страницу', () => {
    const settings = { ...defaultPrintSettings(), allChartsSamePage: true };
    const pages = layoutPrintPages(filmFixture(), settings);
    expect(pages).toHaveLength(1);
    expect(pages[0].charts).toEqual([...FILM_CHARTS]);
  });

  it('выключенная опция даёт по странице на график', () => {
    const settings = { ...defaultPrintSettings(), allChartsSamePage: false };
    const pages = layoutPrintPages(filmFixture(), settings);
    expect(pages).toHaveLength(FILM_CHARTS.length);
    pages.forEach((page, i) => expect(page.charts).toEqual([FILM_CHARTS[i]]));
  });

  it('область «Current page only» оставляет первую страницу', () => {
    const settings = { ...defaultPrintSettings(), allChartsSamePage: false, scope: 'current-page' as const };
    const pages = printPages(filmFixture(), settings);
    expect(pages).toHaveLength(1);
    expect(pages[0].charts).toEqual([FILM_CHARTS[0]]);
  });

  it('применение области к пустой раскладке безопасно', () => {
    const settings = defaultPrintSettings();
    expect(applyPrintScope([], settings)).toEqual([]);
  });
});

describe('9.2 Печать документа', () => {
  it('задание печати содержит титул и страницы с заголовками', () => {
    const job = buildPrintJob(paperFixture(), defaultPrintSettings());
    expect(job.pages).toHaveLength(1);
    expect(job.documentTitle.length).toBeGreaterThan(0);
    expect(job.pages[0].title).toContain('1');
  });

  it('печать передаёт задание бэку и сообщает об успехе', async () => {
    const captured: { pages: unknown[] }[] = [];
    setPrintBackend({
      print: async (job) => {
        captured.push(job);
        return true;
      },
    });
    const ok = await printDocument(paperFixture(), defaultPrintSettings());
    expect(ok).toBe(true);
    expect(captured[0]?.pages).toHaveLength(1);
  });

  it('отмена печати бэком возвращает false', async () => {
    setPrintBackend({ print: async () => false });
    expect(await printDocument(paperFixture(), defaultPrintSettings())).toBe(false);
  });

  it('ошибка бэка не выбрасывается наружу', async () => {
    setPrintBackend({
      print: async () => {
        throw new Error('принтер недоступен');
      },
    });
    expect(await printDocument(paperFixture(), defaultPrintSettings())).toBe(false);
  });

  it('во время печати монтирует отдельный печатный корень и убирает его после', async () => {
    const seen: { root: HTMLElement | null } = { root: null };
    setPrintBackend({
      print: async () => {
        seen.root = document.getElementById(PRINT_ROOT_ID);
        return true;
      },
    });
    await printDocument(paperFixture(), defaultPrintSettings());
    // Внутри бэка печатный корень присутствует…
    expect(seen.root).not.toBeNull();
    expect(seen.root?.querySelectorAll('[data-testid="print-document-page"]')).toHaveLength(1);
    // …а после печати удалён.
    expect(document.getElementById(PRINT_ROOT_ID)).toBeNull();
    expect(document.body.classList.contains('printing')).toBe(false);
  });

  it('печатный корень печатает только страницы графиков, а не оболочку', async () => {
    const seen: { html: string } = { html: '' };
    setPrintBackend({
      print: async () => {
        seen.html = document.getElementById(PRINT_ROOT_ID)?.innerHTML ?? '';
        return true;
      },
    });
    await printDocument(paperFixture(), defaultPrintSettings());
    // Содержимое страницы: семейство и каждый аналитический график.
    expect(seen.html).toContain('print-family-chart');
    expect(seen.html).toContain('print-svg-iso-range');
    expect(seen.html).toContain('print-svg-paper-grade');
    // В печатном корне нет интерфейса оболочки.
    expect(seen.html).not.toContain('menu-bar');
    expect(seen.html).not.toContain('dialog-overlay');
  });

  it('подменяемый бэк не получает печатный корень до/после вызова', async () => {
    setPrintBackend({ print: async () => true });
    expect(document.getElementById(PRINT_ROOT_ID)).toBeNull();
    await printDocument(paperFixture(), defaultPrintSettings());
    expect(document.getElementById(PRINT_ROOT_ID)).toBeNull();
  });
});

describe('9.1 Диалог «Print Curves»', () => {
  it('по умолчанию «Entire document» и «Color Curves»', () => {
    render(<PrintCurvesDialog doc={paperFixture()} onClose={() => undefined} />);
    expect(screen.getByTestId('print-entire')).toBeChecked();
    expect(screen.getByTestId('print-color')).toBeChecked();
    expect(screen.getByTestId('print-display-information')).toBeChecked();
    expect(screen.getByTestId('print-smooth')).not.toBeChecked();
  });

  it('переключение области печати и параметров сохраняется в сеанс', async () => {
    const user = userEvent.setup();
    render(
      <PrintCurvesDialog
        doc={paperFixture()}
        onClose={() => undefined}
        print={async () => true}
      />,
    );
    await user.click(screen.getByTestId('print-current-page'));
    await user.click(screen.getByTestId('print-smooth'));
    await user.click(screen.getByTestId('print-confirm'));
    const saved = getPrintSettings();
    expect(saved.scope).toBe('current-page');
    expect(saved.smoothCurves).toBe(true);
  });

  it('подтверждение вызывает бэк печати и закрывает диалог', async () => {
    const user = userEvent.setup();
    const print = vi.fn(async () => true);
    const onClose = vi.fn();
    render(
      <PrintCurvesDialog doc={paperFixture()} onClose={onClose} print={print} />,
    );
    await user.click(screen.getByTestId('print-confirm'));
    expect(print).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('ошибка печати показывается и диалог не закрывается', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PrintCurvesDialog
        doc={paperFixture()}
        onClose={onClose}
        print={async () => false}
      />,
    );
    await user.click(screen.getByTestId('print-confirm'));
    expect(screen.getByTestId('print-error')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('сеансовые настройки не переживают сброс (выход из программы)', () => {
    setPrintSettings({ scope: 'current-page', smoothCurves: true });
    resetPrintSettings();
    expect(getPrintSettings()).toEqual(defaultPrintSettings());
  });
});

describe('9.3 Предпросмотр печати', () => {
  it('переход по страницам ограничен раскладкой', async () => {
    const user = userEvent.setup();
    const settings = { ...defaultPrintSettings(), allChartsSamePage: false };
    render(<PrintPreview doc={filmFixture()} settings={settings} onClose={() => undefined} />);
    expect(screen.getByTestId('print-page')).toHaveAttribute('data-page', '0');
    expect(screen.getByTestId('print-prev')).toBeDisabled();
    await user.click(screen.getByTestId('print-next'));
    expect(screen.getByTestId('print-page')).toHaveAttribute('data-page', '1');
    await user.click(screen.getByTestId('print-first'));
    expect(screen.getByTestId('print-page')).toHaveAttribute('data-page', '0');
  });

  it('изменение масштаба отражается на странице', async () => {
    const user = userEvent.setup();
    render(<PrintPreview doc={paperFixture()} settings={defaultPrintSettings()} onClose={() => undefined} />);
    expect(screen.getByTestId('print-page')).toHaveAttribute('data-zoom', '1');
    await user.click(screen.getByTestId('print-zoom-in'));
    expect(screen.getByTestId('print-page')).toHaveAttribute('data-zoom', '1.25');
    await user.click(screen.getByTestId('print-zoom-out'));
    await user.click(screen.getByTestId('print-zoom-out'));
    expect(screen.getByTestId('print-page')).toHaveAttribute('data-zoom', '0.75');
  });

  it('показывает графики страницы', () => {
    render(<PrintPreview doc={paperFixture()} settings={defaultPrintSettings()} onClose={() => undefined} />);
    expect(screen.getByTestId('print-chart-iso-range')).toBeInTheDocument();
    expect(screen.getByTestId('print-chart-paper-grade')).toBeInTheDocument();
  });

  it('дорисовывает кривые: график семейства и SVG каждого графика', () => {
    render(<PrintPreview doc={paperFixture()} settings={defaultPrintSettings()} onClose={() => undefined} />);
    expect(screen.getByTestId('print-family-chart')).toBeInTheDocument();
    expect(screen.getByTestId('print-svg-iso-range')).toBeInTheDocument();
    expect(screen.getByTestId('print-svg-paper-grade')).toBeInTheDocument();
  });

  it('плёнка: семейство и все шесть аналитических графиков', () => {
    const settings = { ...defaultPrintSettings(), allChartsSamePage: true };
    render(<PrintPreview doc={filmFixture()} settings={settings} onClose={() => undefined} />);
    expect(screen.getByTestId('print-family-chart')).toBeInTheDocument();
    for (const chart of FILM_CHARTS) {
      expect(screen.getByTestId(`print-svg-${chart}`)).toBeInTheDocument();
    }
  });

  it('кнопка печати страницы неизменна при одной странице', () => {
    render(<PrintPreview doc={paperFixture()} settings={defaultPrintSettings()} onClose={() => undefined} />);
    expect(screen.getByTestId('print-next')).toBeDisabled();
    expect(screen.getByTestId('print-page-label')).toHaveTextContent('1');
    fireEvent.click(screen.getByTestId('print-close'));
  });
});
