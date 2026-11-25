import type { Curve, CurvePoint, FilmDocument, PaperDocument } from './types';

/** Документ, содержащий обычные кривые (плёнка или бумага). */
export type CurveDocument = FilmDocument | PaperDocument;

/**
 * Операции над кривыми и вспомогательные вычисления по точкам.
 *
 * Здесь только чистая логика (без UI): автозаполнение ступеней, разбор
 * времени проявления, добавление/удаление/упорядочивание/импорт кривых.
 * Сохранённые координаты при любых операциях не изменяются «задним числом» —
 * новые значения появляются только от явного ввода пользователя.
 */

/**
 * Размер зарезервированного блока кривой по маркеру формата:
 * 20 — современная плёнка (104), 4 — старая плёнка (100) и бумага (103).
 * Правило проверено на всех образцах; централизовано здесь, чтобы формат
 * (`core/format`) и операции над кривыми не расходились.
 */
export function reservedSizeForMarker(marker: number): number {
  return marker === 104 ? 20 : 4;
}

/** Стандартное число ступеней ступенчатого клина нового документа. */
export const STEP_COUNT = 21;

/**
 * Ступенчатый клин по умолчанию для нового документа: равномерный клин
 * 0.15 плотности на ступень (0..3.0 на 21 ступени) — типовой для BTZS.
 */
export function defaultStepTabletDensities(count = STEP_COUNT): number[] {
  return Array.from({ length: count }, (_, i) => Math.round(i * 0.15 * 100) / 100);
}

/**
 * Плотности по ступеням с учётом автозаполнения старших ступеней.
 *
 * Правило (spec: film-documents / «Автозаполнение верхних ступеней»): если
 * первая введённая ступень не первая, то все ступени старше (с меньшим
 * индексом) считаются равными первому введённому значению — даже если сами
 * поля остаются пустыми.
 *
 * @param points     введённые точки кривой
 * @param stepCount  число ступеней клина
 * @returns массив длины `stepCount`: density — введённое или
 *          автозаполненное значение, `undefined` — ступень не введена
 */
export function filledDensities(
  points: readonly CurvePoint[],
  stepCount: number,
): (number | undefined)[] {
  const out: (number | undefined)[] = Array.from({ length: stepCount }, () => undefined);
  for (const p of points) {
    if (p.step >= 0 && p.step < stepCount) out[p.step] = p.density;
  }
  if (points.length > 0) {
    const firstStep = Math.min(...points.map((p) => p.step));
    const firstValue = points.find((p) => p.step === firstStep)?.density;
    if (firstValue !== undefined) {
      for (let step = 0; step < firstStep; step++) {
        if (out[step] === undefined) out[step] = firstValue;
      }
    }
  }
  return out;
}

/**
 * Интерпретирует метку кривой как время проявления.
 *
 * Принимаются форматы «минуты:секунды» (`5:30` → 5.5) и десятичный
 * (`5.5`). Ведущая буква, пустая строка и некорректные значения дают
 * `null` — кривая помечается как некорректная и не отображается на
 * графиках «Dev» (spec: film-documents / «Некорректный формат времени»).
 *
 * @returns время проявления в минутах или `null`
 */
export function parseDevTime(text: string): number | null {
  const value = text.trim();
  if (value === '') return null;
  const clock = /^(\d+):(\d{1,2})$/.exec(value);
  if (clock) {
    const minutes = Number(clock[1]);
    const seconds = Number(clock[2]);
    if (seconds >= 60) return null;
    return minutes + seconds / 60;
  }
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const decimal = Number(value);
  return Number.isFinite(decimal) ? decimal : null;
}

/** Форматирует время проявления (минуты) в исходное представление «м:сс». */
export function formatDevTime(minutes: number): string {
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  if (seconds === 0) return String(whole);
  if (seconds === 60) return `${whole + 1}:00`;
  return `${whole}:${String(seconds).padStart(2, '0')}`;
}

/** Метка кривой является корректным временем проявления. */
export function isValidDevTime(curve: Curve): boolean {
  return parseDevTime(curve.label) !== null;
}

/**
 * Добавляет кривую в документ.
 *
 * Размер `reserved` новой кривой нормализуется под маркер документа (см.
 * `reservedSizeForMarker`), поэтому документ всегда готов к записи без
 * дополнительной подготовки.
 */
export function appendCurve(doc: CurveDocument, curve: Curve): CurveDocument {
  const size = reservedSizeForMarker(doc.rawHeader.marker);
  const normalized: Curve =
    curve.reserved.length === size
      ? curve
      : { ...curve, reserved: Array.from({ length: size }, () => 0) };
  return { ...doc, curves: [...doc.curves, normalized] };
}

/**
 * Удаляет кривую по индексу.
 *
 * Spec (film-documents / «Удаление кривой»): если кривая не выбрана,
 * подразумевается первая (`selectedIndex === undefined` → индекс 0).
 */
export function removeCurve(
  doc: CurveDocument,
  selectedIndex?: number,
): { doc: CurveDocument; removed: Curve | undefined } {
  const index = selectedIndex ?? 0;
  if (index < 0 || index >= doc.curves.length) return { doc, removed: undefined };
  const removed = doc.curves[index];
  const curves = doc.curves.filter((_, i) => i !== index);
  return { doc: { ...doc, curves }, removed };
}

/**
 * Перемещает кривую вверх (delta = -1) или вниз (delta = +1)
 * (spec: film-documents / «Изменение порядка кривых»).
 */
export function moveCurve(
  doc: CurveDocument,
  index: number,
  delta: -1 | 1,
): CurveDocument {
  const target = index + delta;
  if (index < 0 || index >= doc.curves.length) return doc;
  if (target < 0 || target >= doc.curves.length) return doc;
  const curves = [...doc.curves];
  const [moved] = curves.splice(index, 1);
  curves.splice(target, 0, moved);
  return { ...doc, curves };
}

/** Результат импорта кривых. */
export type ImportCurvesResult =
  | { ok: true; doc: CurveDocument; imported: number }
  | { ok: false; error: 'wrong-kind' | 'no-curves' | 'read-failed'; detail?: string };

/**
 * Импортирует кривые из другого документа в текущий.
 *
 * Spec (film-documents / «Импорт кривых»): импорт кривой бумаги в семейство
 * плёнки (и наоборот) отклоняется с сообщением об ошибке; выбранные кривые
 * добавляются в документ.
 *
 * @param doc            документ-приёмник
 * @param source         документ-источник
 * @param sourceIndices  индексы импортируемых кривых источника (по умолчанию — все)
 */
export function importCurves(
  doc: CurveDocument,
  source: CurveDocument,
  sourceIndices?: readonly number[],
): ImportCurvesResult {
  if (doc.kind !== source.kind) return { ok: false, error: 'wrong-kind' };
  const indices = sourceIndices ?? source.curves.map((_, i) => i);
  const picked = indices
    .filter((i) => i >= 0 && i < source.curves.length)
    .map((i) => source.curves[i]);
  if (picked.length === 0) return { ok: false, error: 'no-curves' };
  // Импортированные кривые нормализуются под маркер документа-приёмника
  // (маркеры 100/104 у плёнки дают разный размер reserved).
  const size = reservedSizeForMarker(doc.rawHeader.marker);
  const imported = picked.map((c) => ({
    ...c,
    points: c.points.map((p) => ({ ...p })),
    reserved:
      c.reserved.length === size
        ? [...c.reserved]
        : Array.from({ length: size }, () => 0),
  }));
  return {
    ok: true,
    doc: { ...doc, curves: [...doc.curves, ...imported] },
    imported: imported.length,
  };
}
