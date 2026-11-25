import { FILE_EXTENSIONS } from '@/core/model';
import type { DocumentKind } from '@/core/model';

/**
 * Регистрация типов документов Plotter: сопоставление расширений файлов видам
 * документов и фильтры диалога открытия.
 *
 * Наблюдаемые в исходном приложении фильтры открытия:
 *   - воды плёнки и бумаги: «Plotter Files (*.pfc;*.ppc)»
 *   - плёнка: «Plotter Film Curves (*.pfc)»
 *   - бумага: «Plotter Paper Curves (*.ppc)»
 *   - Matcher: «Select a Plotter Matcher File…»
 */

/** Описание типа документа. */
export interface DocumentTypeInfo {
  kind: DocumentKind;
  /** Основное расширение, включая точку (например, «.pfc»). */
  extension: string;
  /** Человекочитаемое название типа (для меню и фильтров). */
  label: string;
}

/** Типы документов по видам. */
export const DOCUMENT_TYPES: readonly DocumentTypeInfo[] = [
  { kind: 'film', extension: FILE_EXTENSIONS.film, label: 'Plotter Film Curves' },
  { kind: 'paper', extension: FILE_EXTENSIONS.paper, label: 'Plotter Paper Curves' },
  { kind: 'matcher', extension: FILE_EXTENSIONS.matcher, label: 'Plotter Matcher Files' },
] as const;

/** Фильтр диалога открытия файлов. */
export interface FileFilter {
  /** Отображаемое название фильтра. */
  label: string;
  /** Шаблоны расширений, например «*.pfc». */
  patterns: string[];
}

/**
 * Фильтры открытия: все файлы Plotter, затем отдельные виды и «все файлы».
 */
export const OPEN_FILE_FILTERS: readonly FileFilter[] = [
  {
    label: 'All Plotter Files',
    patterns: [FILE_EXTENSIONS.film, FILE_EXTENSIONS.paper, FILE_EXTENSIONS.matcher].map(
      (e) => `*${e}`,
    ),
  },
  { label: 'Plotter Film Curves', patterns: [`*${FILE_EXTENSIONS.film}`] },
  { label: 'Plotter Paper Curves', patterns: [`*${FILE_EXTENSIONS.paper}`] },
  { label: 'Plotter Matcher Files', patterns: [`*${FILE_EXTENSIONS.matcher}`] },
  { label: 'All Files', patterns: ['*.*'] },
] as const;

/** Извлекает расширение (в нижнем регистре, с точкой) из пути к файлу. */
export function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.');
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (dot <= slash || dot < 0) return '';
  return path.slice(dot).toLowerCase();
}

/**
 * Определяет вид документа по расширению файла. Возвращает `null`, если
 * расширение неизвестно.
 */
export function documentKindForPath(path: string): DocumentKind | null {
  const ext = extensionOf(path);
  const found = DOCUMENT_TYPES.find((t) => t.extension === ext);
  return found ? found.kind : null;
}

/** Возвращает описание типа документа по виду или `undefined`. */
export function documentTypeOf(kind: DocumentKind): DocumentTypeInfo | undefined {
  return DOCUMENT_TYPES.find((t) => t.kind === kind);
}
