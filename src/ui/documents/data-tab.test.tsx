/**
 * Тесты вкладок документа (группы задач 5.1–5.7).
 *
 * Компоненты получают документ через props; тестовый харнесс держит его в
 * состоянии React, чтобы многошаговые сценарии видели изменения, которые
 * компонент вносит через `onDocChange`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analyzePaper } from '@/core/analysis';
import { readFilm, readPaper } from '@/core/format';
import { createFilmDocument } from '@/core/model';
import type { CurveDocument, FilmDocument, PaperDocument } from '@/core/model';
import { setLocale } from '@/i18n';
import {
  openDocumentFile,
  saveDocumentFile,
  setFileBackend,
  writeDocument,
} from '@/ui/file-service';
import type { FileBackend } from '@/ui/file-service';
import { DataTab } from './DataTab';
import { FamilyTab } from './FamilyTab';

const APP_DIR = join(process.cwd(), 'app');

interface TabProps {
  doc: CurveDocument;
  onDocChange: (doc: CurveDocument) => void;
}

function Harness({
  component: Tab,
  doc,
  sink,
}: {
  component: ComponentType<TabProps>;
  doc: CurveDocument;
  sink: { latest: CurveDocument };
}) {
  const [current, setCurrent] = useState(doc);
  return (
    <Tab
      doc={current}
      onDocChange={(next) => {
        sink.latest = next;
        setCurrent(next);
      }}
    />
  );
}

/** Рендерит вкладку; `current()` возвращает последний документ после изменений. */
function renderTab(component: ComponentType<TabProps>, doc: CurveDocument) {
  const sink = { latest: doc };
  render(<Harness component={component} doc={doc} sink={sink} />);
  return { current: () => sink.latest };
}

function renderData(doc: CurveDocument) {
  return renderTab(DataTab, doc);
}

function filmFixture(): FilmDocument {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, '_400_TMax_ID11_23_75.pfc'))));
}

function paperFixture(): PaperDocument {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, 'Agfa_MCC.ppc'))));
}

/** In-memory бэкенд: последний сохранённый файл читается обратно. */
function memoryBackend(files: Map<string, Uint8Array>): FileBackend {
  return {
    openFile: async () => {
      const entry = [...files.entries()][0];
      return entry ? { path: entry[0], data: entry[1] } : null;
    },
    saveFile: async ({ defaultName, data }) => {
      files.set(defaultName, data);
      return defaultName;
    },
  };
}

beforeEach(() => setLocale('ru'));

afterEach(() => {
  setFileBackend(null);
  setLocale('ru');
});

describe('5.1 Вкладка Data плёнки', () => {
  it('новый документ: столбцы «Ступень» и «Клин», кнопка новой кривой доступна', () => {
    renderData(createFilmDocument());
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
    expect(screen.getByText('Ступень')).toBeInTheDocument();
    expect(screen.getByText('Клин')).toBeInTheDocument();
    expect(screen.getByTestId('add-curve')).toBeEnabled();
    // Единственный столбец данных — активный клин; поля IDmax % нет (только бумага).
    expect(screen.queryByTestId('curve-header-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('idmin-percent')).not.toBeInTheDocument();
  });

  it('сценарий добавления кривой: диалог → время → кривая появляется', async () => {
    const user = userEvent.setup();
    const { current } = renderData(createFilmDocument());

    await user.click(screen.getByTestId('add-curve'));
    expect(screen.getByTestId('curve-details-dialog')).toBeInTheDocument();

    await user.type(screen.getByTestId('curve-label'), '5:30');
    await user.type(screen.getByTestId('curve-note'), 'контроль');
    await user.click(screen.getByTestId('dialog-ok'));

    expect(screen.getByTestId('curve-header-0')).toHaveTextContent('5:30');
    const doc = current();
    expect(doc.curves).toHaveLength(1);
    expect(doc.curves[0].label).toBe('5:30');
    expect(doc.curves[0].note).toBe('контроль');
    expect(doc.curves[0].reserved).toHaveLength(20); // маркер 104
  });

  it('некорректное время проявления: предупреждение, но кривая сохраняется', async () => {
    const user = userEvent.setup();
    const { current } = renderData(createFilmDocument());
    await user.click(screen.getByTestId('add-curve'));
    await user.type(screen.getByTestId('curve-label'), 'N5.5');
    expect(screen.getByTestId('curve-invalid-warning')).toBeInTheDocument();
    await user.click(screen.getByTestId('dialog-ok'));
    expect(screen.queryByTestId('curve-invalid-warning')).not.toBeInTheDocument();
    expect(current().curves[0].label).toBe('N5.5');
  });

  it('ввод плотности и переход по Enter к следующей ступени', async () => {
    const user = userEvent.setup();
    const { current } = renderData(createFilmDocument());
    await user.click(screen.getByTestId('add-curve'));
    await user.type(screen.getByTestId('curve-label'), '7');
    await user.click(screen.getByTestId('dialog-ok'));

    const first = screen.getByTestId('cell-c0-0');
    await user.click(first);
    await user.keyboard('1.25{Enter}');
    expect(document.activeElement).toBe(screen.getByTestId('cell-c0-1'));
    expect(current().curves[0].points.find((p) => p.step === 0)?.density).toBeCloseTo(1.25, 10);
  });

  it('чекбокс «Не соединять на графике» сохраняется у кривой', async () => {
    const user = userEvent.setup();
    const { current } = renderData(createFilmDocument());
    await user.click(screen.getByTestId('add-curve'));
    await user.type(screen.getByTestId('curve-label'), '9');
    await user.click(screen.getByTestId('curve-dont-connect'));
    await user.click(screen.getByTestId('dialog-ok'));
    expect(current().curves[0].dontConnectInChart).toBe(true);
  });

  it('плотности клина редактируются во втором столбце', () => {
    const { current } = renderData(createFilmDocument());
    const cell = screen.getByTestId('cell-tablet-3');
    // Значение отличается от дефолта клина (0.15/ступень → 0.45 на 4-й ступени);
    // запятая — русский десятичный разделитель.
    fireEvent.change(cell, { target: { value: '0,79' } });
    expect(cell).toHaveValue('0,79');
    expect(current().stepTablet.densities[3]).toBeCloseTo(0.79, 10);
  });

  it('во втором столбце показан активный клин документа (задача 8.1)', () => {
    const base = filmFixture();
    const doc: FilmDocument = {
      ...base,
      stepTablet: { densities: base.stepTablet.densities.map((_, i) => 1 + i * 0.05) },
    };
    renderData(doc);
    // Значения второго столбца берутся из клина документа, а не из дефолта.
    expect(screen.getByTestId('cell-tablet-0')).toHaveValue('1,00');
    expect(screen.getByTestId('cell-tablet-4')).toHaveValue('1,20');
  });

  it('F2 + Ctrl+Enter заполняет столбец вниз', async () => {
    const user = userEvent.setup();
    const { current } = renderData(createFilmDocument());
    await user.click(screen.getByTestId('add-curve'));
    await user.type(screen.getByTestId('curve-label'), '10');
    await user.click(screen.getByTestId('dialog-ok'));

    const anchor = screen.getByTestId('cell-c0-4');
    await user.click(anchor);
    await user.keyboard('0.9');
    fireEvent.keyDown(anchor, { key: 'F2' });
    fireEvent.keyDown(anchor, { key: 'Enter', ctrlKey: true });

    const points = current().curves[0].points;
    for (let step = 4; step < 21; step++) {
      expect(points.find((p) => p.step === step)?.density).toBeCloseTo(0.9, 10);
    }
    // Ступени выше якоря не тронуты.
    expect(points.find((p) => p.step === 0)).toBeUndefined();
  });

  it('старшие ступени: поля пусты, заполнение — при выборе другого столбца', async () => {
    const user = userEvent.setup();
    const withCurve: FilmDocument = {
      ...createFilmDocument(),
      curves: [
        {
          label: '8',
          note: '',
          points: [
            { step: 5, density: 2 },
            { step: 6, density: 1.8 },
          ],
          reserved: Array.from({ length: 20 }, () => 0),
          dontConnectInChart: false,
        },
      ],
    };
    const { current } = renderData(withCurve);

    // Пока пользователь работает в столбце кривой — верхние поля пусты…
    expect(screen.getByTestId('cell-c0-0')).toHaveValue('');
    await user.click(screen.getByTestId('cell-c0-5'));
    expect(screen.getByTestId('cell-c0-0')).toHaveValue('');

    // …выбор другого столбца материализует автозаполнение в документе.
    await user.click(screen.getByTestId('cell-tablet-0'));
    expect(screen.getByTestId('cell-c0-0')).toHaveValue('2,00');
    expect(current().curves[0].points).toHaveLength(7);
    // Исходный объект не мутирован.
    expect(withCurve.curves[0].points).toHaveLength(2);
  });
});

describe('5.2 Вкладка Family плёнки', () => {
  it('отображает параметры семейства', () => {
    render(<FamilyTab doc={filmFixture()} onDocChange={() => undefined} />);
    expect(screen.getByTestId('family-tab')).toBeInTheDocument();
    expect(screen.getByTestId('family-value-Название')).toHaveTextContent('400 TMax');
    expect(screen.getByTestId('family-value-ISO плёнки')).toHaveTextContent('400');
    expect(screen.getByTestId('family-value-Проявитель')).toHaveTextContent('ID-11');
  });

  it('отображает главный график семейства характеристических кривых', () => {
    const doc = filmFixture();
    render(<FamilyTab doc={doc} onDocChange={() => undefined} />);
    expect(screen.getByTestId('family-graph')).toBeInTheDocument();
    const chart = screen.getByTestId('family-chart');
    expect(chart).toBeInTheDocument();
    for (let i = 0; i < doc.curves.length; i++) {
      expect(screen.getByTestId(`family-series-${i}`)).toBeInTheDocument();
    }
  });

  it('для пустого семейства показывает сообщение об отсутствии кривых', () => {
    const doc = { ...filmFixture(), curves: [] };
    render(<FamilyTab doc={doc} onDocChange={() => undefined} />);
    expect(screen.getByTestId('family-chart-empty')).toBeInTheDocument();
  });

  it('редактирование через диалог обновляет документ', async () => {
    const user = userEvent.setup();
    const { current } = renderTab(FamilyTab, filmFixture());

    await user.click(screen.getByTestId('family-edit'));
    expect(screen.getByTestId('family-details-dialog')).toBeInTheDocument();

    const name = screen.getByTestId('family-name');
    await user.clear(name);
    await user.type(name, 'TMax 400');
    fireEvent.change(screen.getByTestId('family-film-iso'), { target: { value: '320' } });
    await user.click(screen.getByTestId('dialog-ok'));

    const saved = current() as FilmDocument;
    expect(saved.family.name).toBe('TMax 400');
    expect(saved.family.filmIso).toBe(320);
    expect(screen.queryByTestId('family-details-dialog')).not.toBeInTheDocument();
  });

  it('переключение температуры F→C пересчитывает значение', async () => {
    const user = userEvent.setup();
    const base = filmFixture();
    const doc: FilmDocument = { ...base, family: { ...base.family, temperature: 68 } };
    const { current } = renderTab(FamilyTab, doc);

    await user.click(screen.getByTestId('family-edit'));
    await user.selectOptions(screen.getByTestId('family-temperature-unit'), 'C');
    await user.click(screen.getByTestId('dialog-ok'));

    const saved = current() as FilmDocument;
    expect(saved.family.temperatureUnit).toBe('C');
    expect(saved.family.temperature).toBe(20); // (68−32)·5/9
  });
});

describe('5.3 Импорт кривых: проверка допустимости', () => {
  it('импорт кривой бумаги в семейство плёнки отклоняется с сообщением', async () => {
    const user = userEvent.setup();
    setFileBackend(memoryBackend(new Map([['Agfa_MCC.ppc', writeDocument(paperFixture())]])));

    const { current } = renderData(createFilmDocument());
    await user.click(screen.getByTestId('import-curves'));
    const message = await screen.findByTestId('data-message');
    expect(message).toHaveAttribute('role', 'alert');
    expect(message).toHaveTextContent('Импорт кривой бумаги в семейство плёнки невозможен');
    expect(current().curves).toHaveLength(0);
  });

  it('успешный импорт кривых плёнки подтверждается сообщением', async () => {
    const user = userEvent.setup();
    const source = filmFixture();
    setFileBackend(memoryBackend(new Map([['src.pfc', writeDocument(source)]])));

    const { current } = renderData(createFilmDocument());
    await user.click(screen.getByTestId('import-curves'));
    const message = await screen.findByTestId('data-message');
    expect(message).toHaveAttribute('role', 'status');
    expect(message).toHaveTextContent(`Импортировано кривых: ${source.curves.length}`);
    expect(current().curves).toHaveLength(source.curves.length);
  });
});

describe('5.4/5.5 Вкладки Data и Family бумаги', () => {
  it('Data бумаги: параметр IDmax % и метки кривых (ID/Name)', () => {
    const { current } = renderData(paperFixture());
    expect(screen.getByTestId('idmin-percent')).toBeInTheDocument();
    expect(screen.getByTestId('curve-header-0')).toHaveTextContent('none');
    expect(screen.getByTestId('curve-header-1')).toHaveTextContent('-1');

    fireEvent.change(screen.getByTestId('idmin-percent'), { target: { value: '80' } });
    const params = (current() as PaperDocument).analysisParams;
    expect(params.idminPercent).toBe(80);
  });

  it('изменение IDmax % пересчитывает анализ бумаги (ES и оценка)', () => {
    const doc = paperFixture();
    const curve = doc.curves[2];
    const at90 = analyzePaper([curve], doc.stepTablet, {
      ...doc.analysisParams,
      idminPercent: 90,
    })[0];
    const at60 = analyzePaper([curve], doc.stepTablet, {
      ...doc.analysisParams,
      idminPercent: 60,
    })[0];
    expect(at90.isoRange).toBeDefined();
    expect(at60.isoRange).toBeDefined();
    // Уменьшение IDmax % снижает используемый предел плотности → ES меньше.
    expect(at60.es!).toBeLessThan(at90.es!);
  });

  it('диалог деталей кривой бумаги запрашивает «ID или имя» вместо времени', async () => {
    const user = userEvent.setup();
    renderData(paperFixture());
    await user.click(screen.getByTestId('curve-header-2'));
    fireEvent.doubleClick(screen.getByTestId('curve-header-2'));
    expect(screen.getByTestId('curve-details-dialog')).toBeInTheDocument();
    expect(screen.getByText('ID или имя')).toBeInTheDocument();
    expect(screen.queryByText('Время проявления')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('dialog-cancel'));
    expect(screen.queryByTestId('curve-details-dialog')).not.toBeInTheDocument();
  });

  it('Family бумаги отображает параметры печати', () => {
    render(<FamilyTab doc={paperFixture()} onDocChange={() => undefined} />);
    expect(screen.getByTestId('family-value-Название')).toHaveTextContent('Agfa MCC');
    expect(screen.getByTestId('family-value-Способ печати')).toHaveTextContent('Контактная');
    expect(screen.getByTestId('family-value-Тонер')).toBeInTheDocument();
  });

  it('диалог параметров бумаги содержит специфичные поля', async () => {
    const user = userEvent.setup();
    render(<FamilyTab doc={paperFixture()} onDocChange={() => undefined} />);
    await user.click(screen.getByTestId('family-edit'));
    expect(screen.getByTestId('family-print-method')).toBeInTheDocument();
    expect(screen.getByTestId('family-developing-time')).toBeInTheDocument();
    expect(screen.getByTestId('family-toner')).toBeInTheDocument();
    expect(screen.getByTestId('family-drying')).toBeInTheDocument();
    expect(screen.queryByTestId('family-film-iso')).not.toBeInTheDocument();
    expect(screen.queryByTestId('family-volume')).not.toBeInTheDocument();
  });
});

describe('5.6 Управление кривыми', () => {
  it('удаление выбранной кривой с подтверждением', async () => {
    const user = userEvent.setup();
    const { current } = renderData(filmFixture());
    expect(current().curves).toHaveLength(5);

    await user.click(screen.getByTestId('curve-header-2'));
    await user.click(screen.getByTestId('delete-curve'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Удалить кривую «8»?')).toBeInTheDocument();

    await user.click(screen.getByTestId('confirm-ok'));
    expect(current().curves.map((c) => c.label)).toEqual(['4', '5:40', '11', '16']);
  });

  it('без выбранной кривой удаляется первая', async () => {
    const user = userEvent.setup();
    const { current } = renderData(filmFixture());
    await user.click(screen.getByTestId('delete-curve'));
    await user.click(screen.getByTestId('confirm-ok'));
    expect(current().curves.map((c) => c.label)).toEqual(['5:40', '8', '11', '16']);
  });

  it('окно упорядочивания меняет порядок кривых', async () => {
    const user = userEvent.setup();
    const { current } = renderData(filmFixture());
    await user.click(screen.getByTestId('arrange-curves'));
    expect(screen.getByTestId('arrange-dialog')).toBeInTheDocument();

    // Выбираем первую кривую и опускаем вниз.
    await user.click(screen.getByTestId('arrange-item-0'));
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByTestId('arrange-down'));
    }
    await user.click(screen.getByTestId('dialog-ok'));

    expect(current().curves.map((c) => c.label)).toEqual(['5:40', '8', '11', '16', '4']);
  });

  it('отмена упорядочивания не меняет документ', async () => {
    const user = userEvent.setup();
    const { current } = renderData(filmFixture());
    const before = current().curves.map((c) => c.label);
    await user.click(screen.getByTestId('arrange-curves'));
    await user.click(screen.getByTestId('arrange-item-0'));
    await user.click(screen.getByTestId('arrange-down'));
    await user.click(screen.getByTestId('dialog-cancel'));
    expect(current().curves.map((c) => c.label)).toEqual(before);
  });
});

describe('5.7 Сохранение и открытие .pfc/.ppc (интеграционный)', () => {
  it('сохранить → открыть без потерь (плёнка)', async () => {
    const files = new Map<string, Uint8Array>();
    setFileBackend(memoryBackend(files));

    const original = filmFixture();
    const path = await saveDocumentFile(original);
    expect(path).toBeTruthy();
    expect(files.has(path!)).toBe(true);

    const opened = await openDocumentFile();
    expect(opened).not.toBeNull();
    expect(opened!.doc.kind).toBe('film');
    expect(opened!.doc).toEqual(original);
  });

  it('сохранить → открыть без потерь (бумага)', async () => {
    const files = new Map<string, Uint8Array>();
    setFileBackend(memoryBackend(files));

    const original = paperFixture();
    const path = await saveDocumentFile(original);
    expect(path).toBeTruthy();

    const opened = await openDocumentFile();
    expect(opened!.doc.kind).toBe('paper');
    expect(opened!.doc).toEqual(original);
  });

  it('новой документ проходит цикл сохранения с рабочим заголовком', async () => {
    const files = new Map<string, Uint8Array>();
    setFileBackend(memoryBackend(files));

    const created = createFilmDocument();
    const withCurve: FilmDocument = {
      ...created,
      curves: [
        {
          label: '5:30',
          // Строки файла — CP1251: кириллица переживает цикл сохранения.
          note: 'проба «контроль»',
          points: Array.from({ length: 21 }, (_, step) => ({ step, density: 2 - step * 0.1 })),
          reserved: Array.from({ length: 20 }, () => 0),
          dontConnectInChart: false,
        },
      ],
    };
    const path = await saveDocumentFile(withCurve);
    const opened = await openDocumentFile();
    expect(path).toBeTruthy();
    expect(opened!.doc).toEqual(withCurve);
  });
});
