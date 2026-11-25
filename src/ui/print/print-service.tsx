import type { FilmDocument, PaperDocument } from '@/core/model';
import type { PrintSettings } from '@/store';
import { buildPrintJob } from './print-layout';
import type { PrintJob } from './print-layout';
import { mountPrintRoot } from './print-root';

/**
 * Печать (spec: printing-and-export).
 *
 * Системный диалог печати вынесен за интерфейс `PrintBackend` — так же, как
 * файловые диалоги вынесены за `FileBackend` (`ui/file-service`). Это позволяет:
 *  - в настольном приложении (Tauri) вызывать системный диалог печати macOS;
 *  - в браузере (dev) применять `window.print()`;
 *  - в тестах подменять бэк и проверять раскладку без реального принтера.
 *
 * Перед вызовом диалога монтируется отдельный печатный корень (`print-root`):
 * `window.print()` печатает текущий DOM окна, поэтому печатается он, а оболочка
 * приложения на время печати скрывается правилами `@media print`.
 */
export type { PrintJob, PrintJobPage } from './print-layout';
export { buildPrintJob } from './print-layout';

/** Абстракция системного диалога печати. */
export interface PrintBackend {
  /** Печатает задание; `false` — пользователь отменил. */
  print(job: PrintJob): Promise<boolean>;
}

/** Текущий бэк печати. */
let backend: PrintBackend | null = null;

/** Устанавливает бэк печати (тесты подменяют). */
export function setPrintBackend(next: PrintBackend | null): void {
  backend = next;
}

/**
 * Браузерный бэк печати: открывает системный диалог через `window.print()`.
 * В настольной сборке используется то же окно рендеринга, поэтому поведение
 * совпадает (macOS рисует системный диалог печати поверх окна приложения).
 */
const domPrintBackend: PrintBackend = {
  async print() {
    if (typeof window === 'undefined' || typeof window.print !== 'function') return false;
    window.print();
    return true;
  },
};

/** Возвращает активный бэк печати (системный диалог). */
export function getPrintBackend(): PrintBackend {
  return backend ?? domPrintBackend;
}

/**
 * Печатает документ через активный бэк; возвращает `false` при отмене/ошибке.
 *
 * Пока открыт системный диалог, в документе присутствует печатный корень с
 * содержимым задания; после закрытия он удаляется.
 */
export async function printDocument(
  doc: FilmDocument | PaperDocument,
  settings: PrintSettings,
): Promise<boolean> {
  const job = buildPrintJob(doc, settings);
  let unmount: (() => void) | null = null;
  if (typeof document !== 'undefined') {
    unmount = mountPrintRoot(doc, job, settings);
  }
  try {
    return await getPrintBackend().print(job);
  } catch {
    return false;
  } finally {
    unmount?.();
  }
}
