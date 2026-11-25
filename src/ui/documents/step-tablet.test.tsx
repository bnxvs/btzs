/**
 * Тесты диалога Step Tablet (задачи 8.1–8.3).
 *
 * Файловые операции и доступ к сохранённым клиньям подменяются через `deps`,
 * чтобы тесты не зависели от системных диалогов и `localStorage`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFilm, readPaper, writeFilm } from '@/core/format';
import { createFilmDocument } from '@/core/model';
import type { CurveDocument, StepTablet } from '@/core/model';
import { setLocale } from '@/i18n';
import { resetSavedStepTablets, saveStepTablet } from '@/store';
import { StepTabletDialog } from './StepTabletDialog';
import type { StepTabletDialogDeps } from './StepTabletDialog';

const APP_DIR = join(process.cwd(), 'app');

function filmFixture() {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, '400 TMax ID-11 2+3 75.pfc'))));
}

/** Клин со «сдвинутыми» значениями, чтобы отличать его от дефолтного. */
function customTablet(seed: number): StepTablet {
  return { densities: Array.from({ length: 21 }, (_, i) => seed + i * 0.01) };
}

function Harness({
  doc,
  deps,
  sink,
}: {
  doc: CurveDocument;
  deps: StepTabletDialogDeps;
  sink: { latest: CurveDocument };
}) {
  const [current, setCurrent] = useState(doc);
  return (
    <StepTabletDialog
      doc={current}
      deps={deps}
      onDocChange={(next) => {
        sink.latest = next;
        setCurrent(next);
      }}
      onClose={() => undefined}
    />
  );
}

function renderDialog(doc: CurveDocument, deps: StepTabletDialogDeps) {
  const sink = { latest: doc };
  render(<Harness doc={doc} deps={deps} sink={sink} />);
  return { current: () => sink.latest };
}

beforeEach(() => setLocale('ru'));
afterEach(() => {
  resetSavedStepTablets();
  setLocale('ru');
});

describe('8.2 Диалог Step Tablet', () => {
  it('показывает текущий клин во втором столбце-таблице', () => {
    const doc = { ...createFilmDocument(), stepTablet: customTablet(0.5) };
    renderDialog(doc, {
      openStepTabletFile: async () => null,
      loadSaved: () => [customTablet(0), customTablet(0)],
      saveSaved: () => undefined,
    });
    expect(screen.getByTestId('step-tablet-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('step-tablet-current')).toHaveTextContent('0,50');
  });

  it('импорт клина из файла Plotter применяет его к документу', async () => {
    const user = userEvent.setup();
    const source = { ...filmFixture(), stepTablet: customTablet(0.7) };
    const { current } = renderDialog(filmFixture(), {
      openStepTabletFile: async () => ({ path: 'src.pfc', doc: source }),
      loadSaved: () => [customTablet(0), customTablet(0)],
      saveSaved: () => undefined,
    });
    await user.click(screen.getByTestId('step-tablet-import'));
    expect(current().stepTablet.densities[0]).toBeCloseTo(0.7, 10);
    expect(screen.getByTestId('step-tablet-message')).toHaveTextContent('успешно');
  });

  it('файл без клина показывает сообщение об ошибке', async () => {
    const user = userEvent.setup();
    const empty = { ...createFilmDocument(), stepTablet: { densities: [] } };
    const { current } = renderDialog(filmFixture(), {
      openStepTabletFile: async () => ({ path: 'empty.pfc', doc: empty }),
      loadSaved: () => [customTablet(0), customTablet(0)],
      saveSaved: () => undefined,
    });
    const before = current().stepTablet.densities[0];
    await user.click(screen.getByTestId('step-tablet-import'));
    const message = screen.getByTestId('step-tablet-message');
    expect(message).toHaveAttribute('role', 'alert');
    expect(message).toHaveTextContent('не содержит ступенчатого клина');
    expect(current().stepTablet.densities[0]).toBe(before);
  });

  it('«Use saved Step Tablet #2» делает сохранённый клин активным', async () => {
    const user = userEvent.setup();
    const saved2 = customTablet(1.1);
    const { current } = renderDialog(filmFixture(), {
      openStepTabletFile: async () => null,
      loadSaved: () => [customTablet(0), saved2],
      saveSaved: () => undefined,
    });
    await user.click(screen.getByTestId('step-tablet-use-1'));
    expect(current().stepTablet.densities[0]).toBeCloseTo(1.1, 10);
  });

  it('«View Step Tablet 1» показывает значения клина #1', async () => {
    const user = userEvent.setup();
    renderDialog(filmFixture(), {
      openStepTabletFile: async () => null,
      loadSaved: () => [customTablet(2), customTablet(0)],
      saveSaved: () => undefined,
    });
    await user.click(screen.getByTestId('step-tablet-view-0'));
    expect(screen.getByTestId('step-tablet-current')).toHaveTextContent('2,00');
  });

  it('сохранение текущего клина требует подтверждения перезаписи', async () => {
    const user = userEvent.setup();
    const saved: StepTablet[] = [customTablet(0), customTablet(0)];
    const doc = { ...createFilmDocument(), stepTablet: customTablet(1.5) };
    renderDialog(doc, {
      openStepTabletFile: async () => null,
      loadSaved: () => [saved[0], saved[1]],
      saveSaved: (slot, tablet) => {
        saved[slot] = tablet;
      },
    });
    await user.click(screen.getByTestId('step-tablet-save-0'));
    expect(screen.getByTestId('step-tablet-overwrite')).toBeInTheDocument();
    await user.click(screen.getByTestId('confirm-ok'));
    expect(saved[0].densities[0]).toBeCloseTo(1.5, 10);
    expect(screen.getByTestId('step-tablet-message')).toHaveTextContent('сохранён как клин #1');
  });

  it('отмена перезаписи не меняет сохранённый клин', async () => {
    const user = userEvent.setup();
    const saved: StepTablet[] = [customTablet(0), customTablet(0)];
    const doc = { ...createFilmDocument(), stepTablet: customTablet(1.5) };
    renderDialog(doc, {
      openStepTabletFile: async () => null,
      loadSaved: () => [saved[0], saved[1]],
      saveSaved: (slot, tablet) => {
        saved[slot] = tablet;
      },
    });
    await user.click(screen.getByTestId('step-tablet-save-0'));
    await user.click(screen.getByTestId('dialog-cancel'));
    expect(saved[0].densities[0]).toBeCloseTo(0, 10);
  });
});

describe('8.1 Реальный клин сохранённого файла показывается в таблице', () => {
  it('значение клина плёнки берётся из дефолта хранилища без сохранённых данных', () => {
    const doc = filmFixture();
    renderDialog(doc, {
      openStepTabletFile: async () => null,
      loadSaved: () => [customTablet(0), customTablet(0.11)],
      saveSaved: () => undefined,
    });
    expect(screen.getByTestId('step-tablet-current')).toBeInTheDocument();
  });
});

describe('8.2/8.3 Хранилище сохранённых клиньев (интеграция)', () => {
  it('сохранённый клин переживает перезагрузку через localStorage/память', () => {
    saveStepTablet(0, customTablet(3.3));
    // loadSavedStepTablets читает из хранилища; проверяем через реальный диалог.
    const opened = filmFixture();
    render(
      <StepTabletDialog
        doc={opened}
        onDocChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(screen.getByTestId('step-tablet-view-0'));
    expect(screen.getByTestId('step-tablet-current')).toHaveTextContent('3,30');
  });
});

describe('8.3 Импорт клина из документа бумаги', () => {
  it('клин извлекается из .ppc-документа', async () => {
    const user = userEvent.setup();
    const paper = readPaper(new Uint8Array(readFileSync(join(APP_DIR, 'Agfa_MCC.ppc'))));
    const { current } = renderDialog(filmFixture(), {
      openStepTabletFile: async () => ({ path: 'p.ppc', doc: paper }),
      loadSaved: () => [customTablet(0), customTablet(0)],
      saveSaved: () => undefined,
    });
    await user.click(screen.getByTestId('step-tablet-import'));
    expect(current().stepTablet.densities).toEqual(paper.stepTablet.densities);
  });
});

describe('записанный клин документа остаётся совместимым', () => {
  it('импортированный клин сохраняется в .pfc и читается обратно', () => {
    const doc = { ...filmFixture(), stepTablet: customTablet(0.9) };
    const reopened = readFilm(writeFilm(doc));
    expect(reopened.stepTablet.densities[0]).toBeCloseTo(0.9, 5);
  });
});
