import type { FileFilter } from '@/core/format';
import { FILE_EXTENSIONS } from '@/core/model';
import { createMatcherDocument } from '@/core/model';
import type { MatcherDocument } from '@/core/model';
import { t } from '@/i18n';
import { openDocumentFile } from '@/ui/file-service';
import type { FileBackend, OpenedDocument } from '@/ui/file-service';

/**
 * Создание документа Matcher (spec: matcher / «Matcher document creation»).
 *
 * Последовательно запрашиваются файл плёнки и файл бумаги; если любой из
 * диалогов отменён либо выбран файл не того вида — документ не создаётся.
 */

const FILM_FILTER: FileFilter = {
  label: 'Plotter Film Curves',
  patterns: [`*${FILE_EXTENSIONS.film}`],
};
const PAPER_FILTER: FileFilter = {
  label: 'Plotter Paper Curves',
  patterns: [`*${FILE_EXTENSIONS.paper}`],
};

/** Провайдеры выбора файлов (подменяются в тестах). */
export interface MatcherCreateDeps {
  /** Выбор файла плёнки; `null` — отмена. */
  openFilm: () => Promise<OpenedDocument | null>;
  /** Выбор файла бумаги; `null` — отмена. */
  openPaper: () => Promise<OpenedDocument | null>;
}

/** Причина отказа при создании документа Matcher. */
export type MatcherCreateReason = 'cancelled' | 'wrong-film' | 'wrong-paper';

/** Итог создания: документ либо причина отказа. */
export type MatcherCreateResult =
  { ok: true; doc: MatcherDocument } | { ok: false; reason: MatcherCreateReason };

/** Провайдеры по умолчанию — системные диалоги плёнки и бумаги. */
export function defaultMatcherCreateDeps(backend?: FileBackend): MatcherCreateDeps {
  return {
    openFilm: () =>
      openDocumentFile({
        filters: [FILM_FILTER, ...extraFilters()],
        title: t('matcher.selectFilm'),
        backend,
      }),
    openPaper: () =>
      openDocumentFile({
        filters: [PAPER_FILTER, ...extraFilters()],
        title: t('matcher.selectPaper'),
        backend,
      }),
  };
}

function extraFilters(): FileFilter[] {
  return [{ label: 'All Files', patterns: ['*.*'] }];
}

/**
 * Последовательно запрашивает файлы и создаёт документ Matcher.
 *
 * @returns созданный документ либо причину отказа
 */
export async function createMatcherViaDialogs(
  deps: MatcherCreateDeps = defaultMatcherCreateDeps(),
): Promise<MatcherCreateResult> {
  const film = await deps.openFilm();
  if (!film) return { ok: false, reason: 'cancelled' };
  if (film.doc.kind !== 'film') return { ok: false, reason: 'wrong-film' };
  const paper = await deps.openPaper();
  if (!paper) return { ok: false, reason: 'cancelled' };
  if (paper.doc.kind !== 'paper') return { ok: false, reason: 'wrong-paper' };
  return {
    ok: true,
    doc: createMatcherDocument(film.doc, paper.doc, film.path, paper.path),
  };
}
