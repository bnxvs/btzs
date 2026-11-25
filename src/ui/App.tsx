import { useEffect, useState } from 'react';
import { getLocale, setLocale, subscribeLocale } from '@/i18n';
import type { Locale } from '@/i18n';
import { PRODUCT } from '@/core/model';
import { Shell } from './shell/Shell';

/**
 * Корневой компонент приложения.
 *
 * Устанавливает заголовок окна (название и версия продукта) и перерисовывает
 * интерфейс при смене языка, а основное содержимое — оболочка приложения
 * (`Shell`): команды, панель команд, вкладки документов и строка состояния.
 */
export function App() {
  const [, forceRender] = useState(0);

  useEffect(() => subscribeLocale(() => forceRender((n) => n + 1)), []);
  useEffect(() => {
    document.title = PRODUCT.title;
  }, []);

  return <Shell />;
}

/** Смена языка по коду (для настроек/тестов). */
export function changeLocale(locale: Locale): void {
  setLocale(locale);
}

/** Текущий язык интерфейса. */
export function currentLocale(): Locale {
  return getLocale();
}
