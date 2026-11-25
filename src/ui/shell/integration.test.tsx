/**
 * Интеграционные и приёмочные проверки (группа 13).
 *
 * 13.1 — сквозной сценарий на образцах `app/` (открыть → вкладки → сопоставление →
 *        сохранить/открыть `.pmf`).
 * 13.2 — круговая совместимость форматов на полном наборе образцов.
 * 13.3 — отсутствие непереведённых строк при русском языке (автоматизируемая
 *        часть: каталоги, окна и диалоги рендерятся в русской локали).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readFilm,
  readPaper,
  writeFilm,
  writePaper,
} from '@/core/format';
import { createMatcherDocument } from '@/core/model';
import type { FilmDocument, PaperDocument } from '@/core/model';
import { formatDate, setLocale, t } from '@/i18n';
import { en, ru } from '@/i18n';
import type { MessageKey } from '@/i18n';
import { resetShell } from '@/store';
import { renderDocumentWorkflow, roundTripFile } from './integration-harness';
import { AboutDialog } from '@/ui/shell/AboutDialog';
import { HelpDialog } from '@/ui/shell/HelpDialog';
import { OptionsDialog } from '@/ui/options/OptionsDialog';
import { PrintCurvesDialog } from '@/ui/print/PrintCurvesDialog';
import { StepTabletDialog } from '@/ui/documents/StepTabletDialog';

const APP_DIR = join(process.cwd(), 'app');

function filmFiles(): string[] {
  return readdirSync(APP_DIR).filter((f) => f.endsWith('.pfc'));
}
function paperFiles(): string[] {
  return readdirSync(APP_DIR).filter((f) => f.endsWith('.ppc'));
}
function readFilmFile(name: string): FilmDocument {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, name))));
}
function readPaperFile(name: string): PaperDocument {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, name))));
}

beforeEach(() => {
  setLocale('ru');
  resetShell();
});
afterEach(() => {
  resetShell();
  setLocale('ru');
});

describe('13.1 Сквозной сценарий документов', () => {
  it('открыть плёнку, перейти по всем вкладкам, данные сохраняются', async () => {
    const user = userEvent.setup();
    const doc = readFilmFile('_400_TMax_ID11_23_75.pfc');
    const { entry, latest } = renderDocumentWorkflow(doc, 'film.pfc');

    // Новый документ из файла открывается на Family.
    for (const tab of ['family', 'data', 'analyze', 'charts'] as const) {
      await user.click(screen.getByTestId(`tab-${entry.id}-${tab}`));
      expect(screen.getByTestId(`document-body-${entry.id}`)).toHaveAttribute('data-tab', tab);
    }
    // Документ не изменился при простом переходе по вкладкам.
    expect(latest()).toEqual(doc);
  });

  it('открыть бумагу и убедиться, что вкладки Analyzer/Charts доступны', async () => {
    const user = userEvent.setup();
    const doc = readPaperFile('Agfa_MCC.ppc');
    const { entry } = renderDocumentWorkflow(doc, 'paper.ppc');
    for (const tab of ['family', 'data', 'analyze', 'charts'] as const) {
      expect(screen.getByTestId(`tab-${entry.id}-${tab}`)).toBeInTheDocument();
    }
    await user.click(screen.getByTestId(`tab-${entry.id}-analyze`));
    expect(screen.getByTestId(`document-body-${entry.id}`)).toHaveAttribute('data-tab', 'analyze');
  });

  it('выполнить сопоставление и повторно открыть .pmf — данные сохраняются', async () => {
    const film = readFilmFile('_400_TMax_ID11_23_75.pfc');
    const paper = readPaperFile('Agfa_MCC.ppc');
    const match = createMatcherDocument(film, paper, 'film.pfc', 'paper.ppc');
    const opened = roundTripFile(match);
    expect(opened.kind).toBe('matcher');
    if (opened.kind !== 'matcher') return;
    expect(opened.filmRef.name).toBe(match.filmRef.name);
    expect(opened.paperRef.name).toBe(match.paperRef.name);
    expect(opened.referenceCurveGrays).toEqual(match.referenceCurveGrays);
  });

  it('расчёт анализа плёнки не меняется после сохранения/открытия', () => {
    const doc = readFilmFile('_100_TMax_DDX_17_75.pfc');
    const reopened = roundTripFile(doc);
    expect(reopened).toEqual(doc);
    expect(reopened.analysisParams).toEqual(doc.analysisParams);
  });
});

describe('13.2 Круговая совместимость форматов', () => {
  it.each(filmFiles())('плёнка %s: байты → документ → байты', (name) => {
    const bytes = new Uint8Array(readFileSync(join(APP_DIR, name)));
    const doc = readFilm(bytes);
    expect(writeFilm(doc)).toEqual(bytes);
  });

  it.each(paperFiles())('бумага %s: байты → документ → байты', (name) => {
    const bytes = new Uint8Array(readFileSync(join(APP_DIR, name)));
    const doc = readPaper(bytes);
    expect(writePaper(doc)).toEqual(bytes);
  });

  it('документ → байты → документ: двойной цикл идемпотентен', () => {
    const doc = readFilmFile('_400_TMax_ID11_23_75.pfc');
    const once = readFilm(writeFilm(doc));
    const twice = readFilm(writeFilm(once));
    expect(once).toEqual(doc);
    expect(twice).toEqual(doc);
  });

  it('полный набор образцов читается без исключений', () => {
    for (const name of filmFiles()) expect(() => readFilmFile(name)).not.toThrow();
    for (const name of paperFiles()) expect(() => readPaperFile(name)).not.toThrow();
  });
});

describe('13.3 Русская локализация интерфейса', () => {
  const CYRILLIC = /[А-Яа-яЁё]/;

  it('каталоги ru/en полностью синхронны по ключам', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  });

  it('все подписи интерфейса на русском содержат кириллицу (кроме имён собственных)', () => {
    // Имена собственные, аббревиатуры и канонические названия графиков
    // допустимы как заимствованные термины: названия графиков заданы в
    // spec: charts («Dev. Time/SBR», «ISO Range Chart» и т. п.), а EFS/G/SBR/ES/
    // IDmin/IDmax/DR/G-bar — стандартные фотографические сокращения BTZS.
    const allowed = new Set<MessageKey>([
      'matcher.title',
      'about.website',
      'shell.noDocumentTitle',
      'about.productLine',
      'about.copyright',
      'about.company',
      'about.btzs',
      'charts.devTimeSbr',
      'charts.devTimeG',
      'charts.devTimeN',
      'charts.efsSbr',
      'charts.efsG',
      'charts.efsN',
      'charts.isoRange',
      'charts.paperGrade',
      'charts.axis.efs',
      'charts.axis.g',
      'charts.axis.n',
      'charts.axis.es',
      'charts.axis.isoRange',
      'analysis.idminPercent',
      'analysis.es',
      'analyze.efs',
      'analyze.gBar',
      'analyze.sbr',
      'analyze.idMin',
      'analyze.idMax',
      'analyze.dr',
    ]);
    for (const key of Object.keys(ru) as MessageKey[]) {
      if (allowed.has(key)) continue;
      expect(CYRILLIC.test(ru[key]), `ключ ${key} = «${ru[key]}»`).toBe(true);
    }
  });

  it('окна и диалоги рендерятся на русском без английских фрагментов', () => {
    const renders: (() => void)[] = [
      () => render(<AboutDialog onClose={() => undefined} />),
      () => render(<HelpDialog onClose={() => undefined} />),
      () => render(<OptionsDialog onClose={() => undefined} />),
      () =>
        render(
          <PrintCurvesDialog
            doc={readPaperFile('Agfa_MCC.ppc')}
            onClose={() => undefined}
            print={async () => false}
          />,
        ),
      () => {
        const film = readFilmFile('_400_TMax_ID11_23_75.pfc');
        render(
          <StepTabletDialog
            doc={film}
            onDocChange={() => undefined}
            onClose={() => undefined}
            deps={{
              openStepTabletFile: async () => null,
              loadSaved: () => [film.stepTablet, film.stepTablet],
              saveSaved: () => undefined,
            }}
          />,
        );
      },
    ];
    for (const renderOne of renders) {
      renderOne();
      const dialogs = document.querySelectorAll('[role="dialog"]');
      expect(dialogs.length).toBeGreaterThan(0);
      for (const dialog of Array.from(dialogs)) {
        const text = dialog.textContent ?? '';
        // В отрисованном узле не остаётся длинных англоязычных подписей.
        expect(text).not.toMatch(
          /\b(Entire document|Print scope|Restore Defaults|Analysis defaults|Smooth Curves|Display defaults)\b/,
        );
      }
      document.body.innerHTML = '';
    }
  });

  it('формат даты на русском — ДД.ММ.ГГГГ', () => {
    setLocale('ru');
    expect(formatDate(new Date(2026, 10, 24))).toBe('24.11.2026');
  });

  it('подписи-заголовки окон берутся из каталога (совпадение с t)', () => {
    render(<AboutDialog onClose={() => undefined} />);
    expect(screen.getByText(t('about.copyright'))).toBeInTheDocument();
  });
});
