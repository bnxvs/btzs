import { DEFAULTS } from '@/core/model';

/**
 * `store/print` — настройки печати текущего сеанса.
 *
 * Spec (printing-and-export / «Область действия настроек печати»): изменения в
 * диалоге «Print Curves» или в опциях действуют до их следующего изменения или
 * до выхода из программы, а при новом запуске восстанавливаются значения по
 * умолчанию. Поэтому хранилище — сугубо сеансовое (в памяти процесса): оно не
 * пишется ни в `localStorage`, ни в файл.
 */

/** Область печати. */
export type PrintScope = 'entire-document' | 'current-page';

/** Настройки печати. */
export interface PrintSettings {
  /** Область печати (по умолчанию — весь документ). */
  scope: PrintScope;
  /** Сглаживать кривые при печати. */
  smoothCurves: boolean;
  /** Печатать цветные кривые. */
  colorCurves: boolean;
  /** Показывать сведения (построения) при печати. */
  displayInformation: boolean;
  /** Печатать все графики на одной странице. */
  allChartsSamePage: boolean;
  /** Толщина линий сетки при отображении. */
  gridLineWidth: number;
  /** Толщина линий сетки при печати. */
  printGridLineWidth: number;
}

/** Настройки печати по умолчанию (совпадают со значениями Options). */
export function defaultPrintSettings(): PrintSettings {
  return {
    scope: 'entire-document',
    smoothCurves: DEFAULTS.smoothCurves,
    colorCurves: DEFAULTS.colorCurves,
    displayInformation: DEFAULTS.displayInformation,
    allChartsSamePage: DEFAULTS.printAllChartsOnSamePage,
    gridLineWidth: DEFAULTS.gridLineWidth,
    printGridLineWidth: DEFAULTS.printGridLineWidth,
  };
}

let current: PrintSettings = defaultPrintSettings();

/** Текущие настройки печати сеанса. */
export function getPrintSettings(): PrintSettings {
  return current;
}

/** Заменяет настройки печати (частичное обновление). */
export function setPrintSettings(patch: Partial<PrintSettings>): PrintSettings {
  current = { ...current, ...patch };
  return current;
}

/** Восстанавливает настройки печати по умолчанию (выход из программы). */
export function resetPrintSettings(): void {
  current = defaultPrintSettings();
}
