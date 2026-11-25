import { render } from '@testing-library/react';
import { readFilm, readMatcher, readPaper, writeFilm, writeMatcher, writePaper } from '@/core/format';
import type { PlotterDocument } from '@/core/model';
import { getShellState, openDocument } from '@/store';
import { Shell } from './Shell';

/**
 * Интеграционный стенд (группа 13): отрисовывает оболочку с открытым
 * документом и предоставляет доступ к актуальному состоянию документа и к
 * круговому сохранению/открытию вне системных диалогов.
 */

/** Отрисовывает Shell с открытым документом и отдаёт запись и её актуальную версию. */
export function renderDocumentWorkflow(doc: PlotterDocument, path: string) {
  const entry = openDocument(doc, path);
  render(<Shell />);
  const latest = (): PlotterDocument =>
    getShellState().documents.find((item) => item.id === entry.id)?.doc ?? doc;
  return { entry, latest };
}

/** Сохраняет документ в байты и читает обратно (без файловой системы). */
export function roundTripFile<T extends PlotterDocument>(doc: T): T {
  const bytes = writeAny(doc);
  return readAny(doc, bytes) as T;
}

function writeAny(doc: PlotterDocument): Uint8Array {
  switch (doc.kind) {
    case 'film':
      return writeFilm(doc);
    case 'paper':
      return writePaper(doc);
    case 'matcher':
      return writeMatcher(doc);
  }
}

function readAny(doc: PlotterDocument, bytes: Uint8Array): PlotterDocument {
  switch (doc.kind) {
    case 'film':
      return readFilm(bytes);
    case 'paper':
      return readPaper(bytes);
    case 'matcher':
      return readMatcher(bytes);
  }
}
