import { en } from './en';
import { ru } from './ru';
import type { MessageKey } from './ru';

/**
 * `i18n` — каталоги переводов (`ru`, `en`), доступ по ключу и региональное
 * форматирование чисел, дат и единиц измерения.
 *
 * Требования — `localization/spec.md`:
 *  - весь отображаемый текст берётся из активного каталога (`t(key)`);
 *  - выбор языка запоминается между запусками, по умолчанию — язык системы;
 *  - числа — с десятичным разделителем активной локали (в русской — запятая),
 *    даты — в формате, принятом в локали (русская — `ДД.ММ.ГГГГ`).
 */

/** Поддерживаемые языки. */
export const LOCALES = ['ru', 'en'] as const;
/** Язык интерфейса. */
export type Locale = (typeof LOCALES)[number];

/** Язык по умолчанию, если язык системы не поддерживается. */
export const DEFAULT_LOCALE: Locale = 'ru';

const CATALOGS: Record<Locale, Record<MessageKey, string>> = { ru, en };

export type { MessageKey };
export { ru, en };

/** Подписка на смену языка (для перерисовки React-интерфейса). */
type Listener = () => void;
const listeners = new Set<Listener>();

let activeLocale: Locale = DEFAULT_LOCALE;

/** Ключ хранилища настройки языка (localStorage). */
export const LOCALE_STORAGE_KEY = 'plotter.locale';

/**
 * Резервное in-memory хранилище: используется, когда `localStorage` среды
 * недоступен (например, в Node/jsdom-тестах без файловой подсистемы).
 */
const memoryStore = new Map<string, string>();

/** Читает значение из хранилища настроек (с фолбэком в память). */
function storageGet(key: string): string | null {
  try {
    const value = globalThis.localStorage?.getItem(key);
    if (value !== undefined) return value;
  } catch {
    /* хранилище недоступно */
  }
  return memoryStore.get(key) ?? null;
}

/** Пишет значение в хранилище настроек (с фолбэком в память). */
function storageSet(key: string, value: string): void {
  memoryStore.set(key, value);
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* хранилище недоступно — значение остаётся в памяти */
  }
}

/** Возвращает активный язык интерфейса. */
export function getLocale(): Locale {
  return activeLocale;
}

/**
 * Определяет язык по умолчанию: сохранённый выбор → язык системы (если для
 * него есть каталог) → язык по умолчанию.
 *
 * @param stored  сохранённое ранее значение языка (если было)
 * @param system  языковая строка системы, например `ru-RU`
 */
export function resolveLocale(stored: string | null | undefined, system: string): Locale {
  if (stored && isLocale(stored)) return stored;
  const base = system.toLowerCase().split(/[-_]/)[0];
  if (isLocale(base)) return base;
  return DEFAULT_LOCALE;
}

/** Проверяет, что строка является поддерживаемым языком. */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Устанавливает активный язык, сохраняет выбор (если доступно хранилище)
 * и уведомляет подписчиков.
 */
export function setLocale(locale: Locale): void {
  if (activeLocale === locale) return;
  activeLocale = locale;
  storageSet(LOCALE_STORAGE_KEY, locale);
  for (const listener of listeners) listener();
}

/** Подписка на смену языка. Возвращает функцию отписки. */
export function subscribeLocale(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Инициализирует язык: читает сохранённый выбор и язык системы.
 * Вызывается при старте приложения (и в тестах — с явными значениями).
 */
export function initLocale(stored?: string | null, systemLanguages?: readonly string[]): Locale {
  const system = systemLanguages?.[0] ?? detectSystemLanguage();
  const locale = resolveLocale(stored ?? readStoredLocale(), system);
  activeLocale = locale;
  return locale;
}

function readStoredLocale(): string | null {
  return storageGet(LOCALE_STORAGE_KEY);
}

function detectSystemLanguage(): string {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const langs = navigator.languages ?? [navigator.language];
  return langs[0] ?? DEFAULT_LOCALE;
}

/**
 * Переводит ключ сообщения из активного каталога.
 *
 * Подстановка: `%s` последовательно заменяется на значения `params`
 * (плейсхолдеров вида `{name}` в каталоге не используется — исходные строки
 * ресурсов Windows используют позиционные параметры).
 *
 * @returns переведённая строка; если ключ не найден — сам ключ
 */
export function t(key: MessageKey, ...params: readonly (string | number)[]): string {
  const template = CATALOGS[activeLocale][key] ?? CATALOGS[DEFAULT_LOCALE][key] ?? key;
  if (params.length === 0) return template;
  let i = 0;
  return template.replace(/%s/g, () => String(params[i++] ?? ''));
}

/** Локаль `Intl` для активного языка. */
export function intlLocale(): string {
  return activeLocale === 'ru' ? 'ru-RU' : 'en-US';
}

/**
 * Форматирует число по активной локали (русская — десятичная запятая).
 *
 * @param value     число
 * @param fractionDigits число знаков после разделителя (без округления — `formatToParts`)
 */
export function formatNumber(value: number, fractionDigits?: number): string {
  return new Intl.NumberFormat(intlLocale(), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits ?? 10,
  }).format(value);
}

/**
 * Форматирует число с заданным числом значащих цифр (без лишних нулей).
 * Используется для подписей шкалы экспозиции, где важна величина числа,
 * а не фиксированное число знаков после разделителя (например `0,00195`).
 */
export function formatSignificant(value: number, digits = 3): string {
  return new Intl.NumberFormat(intlLocale(), {
    maximumSignificantDigits: digits,
  }).format(value);
}

/**
 * Разбирает число, допуская запятую как десятичный разделитель
 * (русская локаль). Возвращает `NaN`, если строка не является числом.
 */
export function parseNumber(text: string): number {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (normalized === '') return Number.NaN;
  return Number(normalized);
}

/** Форматирует дату в формате активной локали (русская — `ДД.ММ.ГГГГ`). */
export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Подписывает значение температуры единицей измерения.
 * Выбор между Фаренгейтом и Цельсием сохраняется независимо от языка.
 */
export function formatTemperature(value: number, unit: 'F' | 'C'): string {
  const label = unit === 'F' ? '°F' : '°C';
  return `${formatNumber(value, 0)} ${label}`;
}

/**
 * `i18n` — каталоги переводов (`ru`, `en`), доступ по ключу и региональное
 * форматирование чисел, дат и единиц измерения.
 */
export const I18N_MODULE = 'i18n';
