/**
 * Тесты документа Matcher (задачи 7.1–7.9).
 *
 * Компонент контролируемый; харнесс держит документ в состоянии React.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFilm, readMatcher, readPaper, writeMatcher } from '@/core/format';
import { ReferenceCurveType, createMatcherDocument } from '@/core/model';
import type { MatcherDocument } from '@/core/model';
import { setLocale } from '@/i18n';
import { createMatcherViaDialogs } from './create-matcher';
import type { MatcherCreateDeps } from './create-matcher';
import { MatcherTab } from './MatcherTab';

const APP_DIR = join(process.cwd(), 'app');

function filmFixture() {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, '400 TMax ID-11 2+3 75.pfc'))));
}
function paperFixture() {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, 'Agfa_MCC.ppc'))));
}
function matcherFixture(): MatcherDocument {
  return createMatcherDocument(filmFixture(), paperFixture(), 'film.pfc', 'paper.ppc');
}

function Harness({
  doc,
  sink,
}: {
  doc: MatcherDocument;
  sink: { latest: MatcherDocument };
}) {
  const [current, setCurrent] = useState(doc);
  return (
    <MatcherTab
      doc={current}
      onDocChange={(next) => {
        sink.latest = next;
        setCurrent(next);
      }}
    />
  );
}

function renderMatcher(doc: MatcherDocument) {
  const sink = { latest: doc };
  render(<Harness doc={doc} sink={sink} />);
  return { current: () => sink.latest };
}

beforeEach(() => setLocale('ru'));
afterEach(() => setLocale('ru'));

describe('создание документа Matcher (задача 7.1)', () => {
  function deps(film: unknown, paper: unknown): MatcherCreateDeps {
    return {
      openFilm: async () => film as never,
      openPaper: async () => paper as never,
    };
  }

  it('последовательный выбор плёнки и бумаги создаёт документ', async () => {
    const result = await createMatcherViaDialogs(
      deps({ path: 'f.pfc', doc: filmFixture() }, { path: 'p.ppc', doc: paperFixture() }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc.kind).toBe('matcher');
      expect(result.doc.filmRef.path).toBe('f.pfc');
      expect(result.doc.paperRef.path).toBe('p.ppc');
    }
  });

  it('отмена выбора плёнки отменяет создание', async () => {
    const result = await createMatcherViaDialogs(deps(null, null));
    expect(result).toEqual({ ok: false, reason: 'cancelled' });
  });

  it('отмена выбора бумаги отменяет создание', async () => {
    const result = await createMatcherViaDialogs(
      deps({ path: 'f.pfc', doc: filmFixture() }, null),
    );
    expect(result).toEqual({ ok: false, reason: 'cancelled' });
  });

  it('файл не того вида отклоняется', async () => {
    const result = await createMatcherViaDialogs(
      deps({ path: 'p.ppc', doc: paperFixture() }, { path: 'p.ppc', doc: paperFixture() }),
    );
    expect(result).toEqual({ ok: false, reason: 'wrong-film' });
  });
});

describe('вкладки Info/Film/Paper/Compare (задача 7.2)', () => {
  it('содержит четыре вкладки и стартует на Info', () => {
    renderMatcher(matcherFixture());
    expect(screen.getByTestId('matcher-tab-info')).toHaveAttribute('aria-selected', 'true');
    for (const key of ['info', 'film', 'paper', 'compare']) {
      expect(screen.getByTestId(`matcher-tab-${key}`)).toBeInTheDocument();
    }
  });

  it('вкладка Info показывает сведения о семействах плёнки и бумаги', () => {
    renderMatcher(matcherFixture());
    expect(screen.getByTestId('matcher-info')).toBeInTheDocument();
    expect(screen.getByTestId('matcher-reference-name')).toBeInTheDocument();
  });

  it('вкладка Film показывает анализ и объединённую таблицу зон', () => {
    renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-film'));
    expect(screen.getByTestId('matcher-film-analysis')).toBeInTheDocument();
    expect(screen.getByTestId('film-zones')).toBeInTheDocument();
  });

  it('вкладка Film показывает график семейства', () => {
    renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-film'));
    expect(screen.getByTestId('matcher-film-graph')).toBeInTheDocument();
    expect(screen.getByTestId('matcher-film-chart')).toBeInTheDocument();
  });

  it('вкладка Paper показывает анализ, зоны печати и эталонные зоны', () => {
    renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-paper'));
    expect(screen.getByTestId('matcher-paper-analysis')).toBeInTheDocument();
    expect(screen.getByTestId('paper-print-zones')).toBeInTheDocument();
    expect(screen.getByTestId('paper-reference-zones')).toBeInTheDocument();
  });

  it('вкладка Paper показывает график семейства', () => {
    renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-paper'));
    expect(screen.getByTestId('matcher-paper-graph')).toBeInTheDocument();
    expect(screen.getByTestId('matcher-paper-chart')).toBeInTheDocument();
  });

  it('не выводит отладочные счётчики кривых', () => {
    renderMatcher(matcherFixture());
    expect(screen.queryByTestId('matcher-film-count')).not.toBeInTheDocument();
    expect(screen.queryByTestId('matcher-paper-count')).not.toBeInTheDocument();
  });

  it('вкладка Compare сообщает об отсутствии сопоставлений', () => {
    renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-compare'));
    expect(screen.getByTestId('compare-empty')).toBeInTheDocument();
  });
});

describe('переопределение параметров анализа (задача 7.3)', () => {
  it('изменение ES помечает параметры как переопределённые и показывает пометку на Info', () => {
    const { current } = renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-film'));
    fireEvent.change(screen.getByTestId('matcher-es'), { target: { value: '1,5' } });
    expect(current().analysisParams.es).toBeCloseTo(1.5, 9);
    expect(current().analysisOverridden).toBe(true);
    fireEvent.click(screen.getByTestId('matcher-tab-info'));
    expect(screen.getByTestId('matcher-override-note')).toBeInTheDocument();
  });

  it('«Restore File Defaults» возвращает значения исходного файла', () => {
    const { current } = renderMatcher(
      { ...matcherFixture(), analysisParams: { ...matcherFixture().analysisParams, es: 2.9 }, analysisOverridden: true },
    );
    fireEvent.click(screen.getByTestId('matcher-tab-film'));
    fireEvent.click(screen.getByTestId('restore-defaults'));
    expect(current().analysisOverridden).toBe(false);
    expect(current().analysisParams.es).toBeCloseTo(1.0, 9);
  });
});

describe('«Lock Film DR=ES» (задача 7.5)', () => {
  it('флажок доступен на вкладке Paper и переключает документ', () => {
    const { current } = renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-paper'));
    const toggle = screen.getByTestId('lock-dr-es');
    fireEvent.click(toggle);
    expect(current().lockFilmDrToEs).toBe(true);
  });
});

describe('приближённые кривые (задача 7.6)', () => {
  it('диалог создаёт кривую по SBR в диапазоне и закрывается', () => {
    const { current } = renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-film'));
    fireEvent.click(screen.getByTestId('manage-approx'));
    expect(screen.getByTestId('approx-curves-dialog')).toBeInTheDocument();
    // Диапазон SBR семейства 400 TMax ID-11 2+3 75 ≈ [3.76; 6.90]; берём 5,5.
    fireEvent.change(screen.getByTestId('approx-value'), { target: { value: '5,5' } });
    fireEvent.click(screen.getByTestId('dialog-ok'));
    expect(screen.queryByTestId('approx-curves-dialog')).not.toBeInTheDocument();
    expect(current().approximatedCurves.length).toBe(1);
    expect(current().approximatedCurves[0].label).toMatch(/^SBR ~ /);
  });

  it('значение вне диапазона показывает ошибку и не создаёт кривую', () => {
    const { current } = renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-film'));
    fireEvent.click(screen.getByTestId('manage-approx'));
    fireEvent.change(screen.getByTestId('approx-value'), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('dialog-ok'));
    expect(screen.getByTestId('approx-error')).toBeInTheDocument();
    expect(current().approximatedCurves).toHaveLength(0);
  });

  it('удаление приближённой кривой', () => {
    const base = matcherFixture();
    const doc: MatcherDocument = {
      ...base,
      approximatedCurves: [
        { by: 'sbr', value: 7, label: 'SBR ~ 7.00', points: [{ step: 0, density: 1 }], reserved: [] },
      ],
    };
    const { current } = renderMatcher(doc);
    fireEvent.click(screen.getByTestId('matcher-tab-film'));
    fireEvent.click(screen.getByTestId('manage-approx'));
    fireEvent.click(screen.getByTestId('approx-remove'));
    expect(current().approximatedCurves).toHaveLength(0);
  });
});

describe('эталонные кривые (задача 7.7)', () => {
  it('переключение на flared и обратно к стандартной', () => {
    const { current } = renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-paper'));
    fireEvent.click(screen.getByTestId('use-flared-reference'));
    expect(current().referenceCurveType).toBe(ReferenceCurveType.Flared);
    fireEvent.click(screen.getByTestId('use-default-reference'));
    expect(current().referenceCurveType).toBe(ReferenceCurveType.Default);
  });

  it('«Use Loaded Curve» недоступна без загруженной кривой', () => {
    renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-paper'));
    expect(screen.getByTestId('use-loaded-reference')).toBeDisabled();
  });
});

describe('сравнение сопоставлений (задача 7.8)', () => {
  it('сохраняет текущее сопоставление из вкладки Paper', () => {
    const { current } = renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-paper'));
    fireEvent.click(screen.getByTestId('save-match'));
    expect(current().savedMatches).toHaveLength(1);
    fireEvent.click(screen.getByTestId('matcher-tab-compare'));
    expect(screen.getByTestId('compare-row-0')).toBeInTheDocument();
  });

  it('вкладка Compare показывает график сравнения при сохранённых сопоставлениях', () => {
    renderMatcher(matcherFixture());
    fireEvent.click(screen.getByTestId('matcher-tab-paper'));
    fireEvent.click(screen.getByTestId('save-match'));
    fireEvent.click(screen.getByTestId('matcher-tab-compare'));
    expect(screen.getByTestId('matcher-compare-graph')).toBeInTheDocument();
    expect(screen.getByTestId('matcher-compare-chart')).toBeInTheDocument();
  });

  it('удаляет сопоставление со вкладки Compare', () => {
    const base = matcherFixture();
    const doc: MatcherDocument = {
      ...base,
      savedMatches: [
        { name: 'm', filmLabel: 'f', paperLabel: 'p', points: [{ step: 2, density: 1 }] },
      ],
    };
    const { current } = renderMatcher(doc);
    fireEvent.click(screen.getByTestId('matcher-tab-compare'));
    fireEvent.click(screen.getByTestId('compare-remove-0'));
    expect(current().savedMatches).toHaveLength(0);
  });

  it('сообщает о достижении предела в 15 сравнений', () => {
    const base = matcherFixture();
    const doc: MatcherDocument = {
      ...base,
      savedMatches: Array.from({ length: 15 }, (_, i) => ({
        name: `m${i}`,
        filmLabel: 'f',
        paperLabel: 'p',
        points: [{ step: 2, density: 1 }],
      })),
    };
    renderMatcher(doc);
    fireEvent.click(screen.getByTestId('matcher-tab-compare'));
    fireEvent.click(screen.getByTestId('compare-save-current'));
    expect(screen.getByTestId('matcher-message')).toHaveTextContent('15');
  });
});

describe('сохранение/открытие .pmf (задача 7.9)', () => {
  it('создать → сохранить → открыть восстанавливает состояние', () => {
    const source = {
      ...matcherFixture(),
      selectedFilmCurve: 1,
      selectedPaperCurve: 0,
      referenceCurveType: ReferenceCurveType.Loaded,
      analysisOverridden: true,
      lockFilmDrToEs: true,
      loadedReferenceCurve: {
        label: 'ref',
        note: '',
        points: [{ step: 2, density: 0.1 }],
        reserved: [],
        dontConnectInChart: false,
      },
      savedMatches: [
        { name: 'm', filmLabel: 'f', paperLabel: 'p', points: [{ step: 2, density: 0.2 }] },
      ],
    };
    const reopened = readMatcher(writeMatcher(source));
    expect(reopened.selectedFilmCurve).toBe(1);
    expect(reopened.referenceCurveType).toBe(ReferenceCurveType.Loaded);
    expect(reopened.analysisOverridden).toBe(true);
    expect(reopened.lockFilmDrToEs).toBe(true);
    expect(reopened.loadedReferenceCurve?.label).toBe('ref');
    expect(reopened.savedMatches).toHaveLength(1);
  });

  it('побайтово перезаписывает образец без расширенного состояния', () => {
    const original = new Uint8Array(readFileSync(join(APP_DIR, 'D100-RefCrv.pmf')));
    const doc = readMatcher(original);
    expect(Array.from(writeMatcher(doc))).toEqual(Array.from(original));
  });
});
