/**
 * `core/format` — чтение и запись бинарных форматов BTZS (`.pfc`, `.ppc`, `.pmf`)
 * и импорт устаревших форматов.
 *
 * Единственное место, знающее о байтовой структуре файлов. Реализация — группа 3.
 */
export const FORMAT_MODULE = 'core/format';

export * from './bytes';
export * from './plotter-file';
export * from './matcher-file';
export * from './document-types';
export * from './legacy-format';
