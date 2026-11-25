import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  en,
  formatDate,
  formatNumber,
  formatTemperature,
  getLocale,
  initLocale,
  isLocale,
  parseNumber,
  resolveLocale,
  ru,
  setLocale,
  subscribeLocale,
  t,
} from '@/i18n';
import type { MessageKey } from '@/i18n';

afterEach(() => {
  setLocale(DEFAULT_LOCALE);
  try {
    globalThis.localStorage?.removeItem(LOCALE_STORAGE_KEY);
  } catch {
    /* noop */
  }
});

describe('каталоги переводов (задача 11.1)', () => {
  it('русский каталог не пуст', () => {
    expect(Object.keys(ru).length).toBeGreaterThan(0);
  });

  it('каталоги содержат одинаковый набор ключей', () => {
    const ruKeys = Object.keys(ru).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(ruKeys);
  });

  it('ни одна строка каталога не пуста и не совпадает с ключом', () => {
    for (const key of Object.keys(ru) as MessageKey[]) {
      expect(ru[key]).not.toBe('');
      expect(en[key]).not.toBe('');
      expect(ru[key]).not.toBe(key);
      expect(en[key]).not.toBe(key);
    }
  });

  it('t возвращает перевод активного языка', () => {
    setLocale('ru');
    expect(t('tab.data')).toBe(ru['tab.data']);
    setLocale('en');
    expect(t('tab.data')).toBe(en['tab.data']);
  });

  it('t подставляет позиционные параметры', () => {
    setLocale('ru');
    expect(t('curves.deleteConfirm', '5:40')).toBe('Удалить кривую «5:40»?');
  });

  it('t для неизвестного ключа возвращает ключ (без падения)', () => {
    expect(t('no.such.key' as MessageKey)).toBe('no.such.key');
  });
});

describe('выбор и персистентность языка (задача 11.3)', () => {
  it('resolveLocale: сохранённый выбор имеет приоритет', () => {
    expect(resolveLocale('en', 'ru-RU')).toBe('en');
    expect(resolveLocale('ru', 'de-DE')).toBe('ru');
  });

  it('resolveLocale: язык системы, если для него есть каталог', () => {
    expect(resolveLocale(null, 'ru-RU')).toBe('ru');
    expect(resolveLocale(null, 'en-GB')).toBe('en');
    expect(resolveLocale(undefined, 'RU_ru')).toBe('ru');
  });

  it('resolveLocale: неподдерживаемый язык системы → язык по умолчанию', () => {
    expect(resolveLocale(null, 'de-DE')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('xx', 'fr-FR')).toBe(DEFAULT_LOCALE);
  });

  it('setLocale сохраняет выбор в хранилище', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    // Выбор восстанавливается при повторной инициализации без сохранённого
    // аргумента (хранилище среды или in-memory фолбэк).
    expect(initLocale(null, ['ru-RU'])).toBe('en');
  });

  it('initLocale восстанавливает сохранённый выбор', () => {
    setLocale('en');
    expect(initLocale('ru', ['en-US'])).toBe('ru');
    expect(initLocale(null, ['en-US'])).toBe('en');
  });

  it('переключение языка уведомляет подписчиков, отписка работает', () => {
    let calls = 0;
    const unsubscribe = subscribeLocale(() => {
      calls++;
    });
    setLocale('en');
    expect(calls).toBe(1);
    setLocale('en'); // повторное присвоение того же языка — без уведомления
    expect(calls).toBe(1);
    unsubscribe();
    setLocale('ru');
    expect(calls).toBe(1);
  });

  it('isLocale распознаёт только поддерживаемые языки', () => {
    expect(isLocale('ru')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });
});

describe('полнота русской локализации (задача 11.2)', () => {
  // Полный перечень окон/диалогов из spec: localization / «Полнота перевода».
  const REQUIRED_DIALOG_TITLES: MessageKey[] = [
    'options.title',
    'curveDetails.title',
    'family.title',
    'stepTablet.title',
    'print.title',
    'curves.importTitle',
    'curves.arrangeTitle',
    'matcher.approx.title',
    'matcher.title',
    'about.title',
    'help.title',
    'matcher.reference.title',
    'print.previewTitle',
  ];

  it('все названия окон и диалогов имеют русский перевод', () => {
    for (const key of REQUIRED_DIALOG_TITLES) {
      expect(ru[key], `нет ключа ${key}`).toBeTruthy();
      // Русская локализация: в строке есть кириллица. Имена собственные
      // (Plotter, Matcher) допустимы как заимствованные термины.
      expect(/[А-Яа-яЁё]/.test(ru[key]), `«${ru[key]}» не переведено`).toBe(true);
    }
  });

  it('главные меню и вкладки переведены на русский', () => {
    const keys: MessageKey[] = [
      'menu.file',
      'menu.edit',
      'menu.view',
      'menu.match',
      'menu.help',
      'tab.family',
      'tab.data',
      'tab.analyze',
      'tab.charts',
      'tab.info',
      'tab.film',
      'tab.paper',
      'tab.compare',
    ];
    for (const key of keys) {
      expect(/[А-Яа-яЁё]/.test(ru[key]), `«${key}» = «${ru[key]}»`).toBe(true);
    }
  });

  it('в исходниках интерфейса нет жёстко заданных англоязычных подписей', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const collect = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return collect(full);
        return full.endsWith('.tsx') ? [full] : [];
      });
    const files = collect(join(process.cwd(), 'src', 'ui'));
    // Литеральный текст в JSX (`>Some English text<`), не проходящий через
    // `t(...)`; исключаем `=>`-стрелки и дженерики TS.
    const literal = /(?:^|[^=])>[A-Za-z][A-Za-z ]{3,}</;
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      source.split('\n').forEach((line, index) => {
        if (literal.test(line) && !line.includes('data-testid') && !line.includes('aria-')) {
          offenders.push(`${file}:${index + 1} ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('региональное форматирование (задача 11.4)', () => {
  it('русская локаль: числа с запятой', () => {
    setLocale('ru');
    expect(formatNumber(1.5)).toBe('1,5');
    expect(formatNumber(0.123456, 2)).toBe('0,12');
    expect(parseNumber('2,75')).toBeCloseTo(2.75, 10);
    expect(parseNumber(' 2,75 ')).toBeCloseTo(2.75, 10);
  });

  it('английская локаль: числа с точкой', () => {
    setLocale('en');
    expect(formatNumber(1.5)).toBe('1.5');
    expect(parseNumber('2.75')).toBeCloseTo(2.75, 10);
  });

  it('parseNumber: некорректный ввод → NaN', () => {
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('')).toBeNaN();
  });

  it('русская локаль: дата ДД.ММ.ГГГГ', () => {
    setLocale('ru');
    expect(formatDate(new Date(2026, 10, 24))).toBe('24.11.2026');
  });

  it('английская локаль: дата в формате США', () => {
    setLocale('en');
    expect(formatDate(new Date(2026, 10, 24))).toBe('11/24/2026');
  });

  it('подписи температуры корректны на обоих языках', () => {
    setLocale('ru');
    expect(formatTemperature(75, 'F')).toBe('75 °F');
    expect(formatTemperature(24, 'C')).toBe('24 °C');
    setLocale('en');
    expect(formatTemperature(75, 'F')).toBe('75 °F');
    expect(t('unit.fahrenheit')).toBe('Fahrenheit');
    setLocale('ru');
    expect(t('unit.fahrenheit')).toBe('Фаренгейт');
  });
});
