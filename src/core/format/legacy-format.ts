import {
  AnalysisMethod,
  DEFAULTS,
  LIMITS,
  appendCurve,
  createFilmDocument,
  createPaperDocument,
} from '@/core/model';
import type {
  Curve,
  CurvePoint,
  FilmDocument,
  PaperDocument,
  StepTablet,
} from '@/core/model';
import { decodeCp1251 } from './cp1251';

/**
 * Импорт устаревших форматов: Macintosh PlotterPlus и DOS Plotter.
 *
 * Алгоритм восстановлен из `Plotter.exe` (функция чтения старого формата):
 * приложение ищет в файле 8-байтовую сигнатуру `FILMPLOT` (плёнка) или
 * `PAPRPLOT` (бумага), после чего сканирует поток байт в поисках серии из
 * 21 (`LIMITS.stepCount`) подряд идущих значений `float32` (little-endian),
 * каждое из которых лежит в допустимом диапазоне плотностей: `d >= 0.01`,
 * `d != 3.5` и `d != 0`. Найденная серия трактуется как кривая (номер ступени
 * 0..20 + плотность).
 *
 * Формат не содержит заголовка со ступенчатым клином, поэтому после импорта
 * приложение предлагает импортировать клин (реализуется на уровне UI).
 */

/** Магия файла плёнки старого формата. */
export const LEGACY_FILM_MAGIC = 'FILMPLOT';
/** Магия файла бумаги старого формата. */
export const LEGACY_PAPER_MAGIC = 'PAPRPLOT';

/** Минимальная допустимая плотность при сканировании (константа 0.01). */
export const LEGACY_MIN_DENSITY = 0.01;
/** Максимальная допустимая плотность при сканировании (константа 3.5). */
export const LEGACY_MAX_DENSITY = 3.5;

/** Результат импорта устаревшего формата. */
export interface LegacyImportResult {
  /** Определённый вид документа (`film` для `FILMPLOT`, `paper` для `PAPRPLOT`). */
  kind: 'film' | 'paper';
  /** Распознанные кривые (каждая — массив точек с последовательными ступенями). */
  curves: CurvePoint[][];
  /**
   * Признак того, что сведения о ступенчатом клине отсутствуют и его следует
   * предложить импортировать.
   */
  needsStepTablet: boolean;
}

/** Ищет сигнатуру устаревшего формата в первых байтах данных. */
export function detectLegacyKind(data: Uint8Array): 'film' | 'paper' | null {
  const text = decodeBytes(data);
  const filmAt = text.indexOf(LEGACY_FILM_MAGIC);
  const paperAt = text.indexOf(LEGACY_PAPER_MAGIC);
  if (filmAt < 0 && paperAt < 0) return null;
  // Если обе сигнатуры найдены — берём ту, что встречается раньше.
  if (filmAt >= 0 && (paperAt < 0 || filmAt < paperAt)) return 'film';
  return 'paper';
}

/** Является ли файл устаревшим форматом Plotter. */
export function isLegacyFormat(data: Uint8Array): boolean {
  return detectLegacyKind(data) !== null;
}

function decodeBytes(data: Uint8Array): string {
  return decodeCp1251(data);
}

/**
 * Проверяет, что значение `float32` допустимо как плотность.
 * Из дизассемблера: значение принимается, если оно `>= 0.01` и `<= 3.5`
 * (нулевые и слишком большие значения прерывают серию).
 */
function isPlausibleDensity(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return value >= LEGACY_MIN_DENSITY && value <= LEGACY_MAX_DENSITY;
}

function readF32(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getFloat32(offset, true);
}

/**
 * Импортирует файл устаревшего формата. Возвращает `null`, если сигнатура не
 * найдена или не распознана ни одна кривая.
 */
export function readLegacy(data: Uint8Array): LegacyImportResult | null {
  const kind = detectLegacyKind(data);
  if (!kind) return null;
  const magic = kind === 'film' ? LEGACY_FILM_MAGIC : LEGACY_PAPER_MAGIC;
  const magicAt = decodeBytes(data).indexOf(magic);
  if (magicAt < 0) return null;

  const stepCount = LIMITS.stepCount;
  const curves: CurvePoint[][] = [];
  let pos = magicAt + magic.length;
  // Сканируем поток байт (аналогично исходному приложению): ищем серию из
  // stepCount подряд идущих правдоподобных значений float32.
  while (pos + stepCount * 4 <= data.length) {
    let count = 0;
    let p = pos;
    while (count < stepCount && p + 4 <= data.length) {
      if (isPlausibleDensity(readF32(data, p))) {
        count++;
        p += 4;
      } else {
        break;
      }
    }
    if (count === stepCount) {
      const points: CurvePoint[] = [];
      for (let i = 0; i < stepCount; i++) {
        points.push({ step: i, density: readF32(data, pos + i * 4) });
      }
      curves.push(points);
      pos = p;
    } else {
      pos++;
    }
  }

  if (curves.length === 0) return null;
  return { kind, curves, needsStepTablet: true };
}

/** Параметры анализа нового документа из устаревшего файла (значения по умолчанию). */
function legacyAnalysisParams() {
  return {
    method: AnalysisMethod.ApproximateCI,
    es: DEFAULTS.paperEs,
    flareDensity: DEFAULTS.flareDensity,
    expAdj: 0,
    zoneSpread: DEFAULTS.zoneSpread,
    personalSpeedPoint: DEFAULTS.personalSpeedPoint,
    usePersonalSpeedPoint: false,
    idminPercent: DEFAULTS.idminPercent,
  };
}

/**
 * Строит документ плёнки или бумаги из результата импорта устаревшего формата.
 *
 * Spec (step-tablet / «Old format step tablet handling»): файл старого формата
 * не содержит сведений о клине, поэтому клин подставляется извне (импорт или
 * сохранённый по умолчанию). Кривые нумеруются по порядку распознавания.
 *
 * Заголовок берётся из фабрики нового документа (файл старого формата заголовка
 * не несёт); семейство оставлено пустым для заполнения пользователем.
 *
 * @param result  результат `readLegacy`
 * @param tablet  ступенчатый клин, назначаемый документу
 */
export function documentFromLegacy(
  result: LegacyImportResult,
  tablet: StepTablet,
): FilmDocument | PaperDocument {
  const curves: Curve[] = result.curves.map((points, index) => ({
    label: String(index + 1),
    note: '',
    points: points.map((p) => ({ ...p })),
    reserved: [],
    dontConnectInChart: false,
  }));
  const tabletClone: StepTablet = { densities: [...tablet.densities] };
  const analysisParams = legacyAnalysisParams();

  let doc: FilmDocument | PaperDocument;
  if (result.kind === 'film') {
    const base = createFilmDocument();
    doc = {
      ...base,
      family: { ...base.family, date: '', name: '' },
      stepTablet: tabletClone,
      curves: [],
      analysisParams,
    };
  } else {
    const base = createPaperDocument();
    doc = {
      ...base,
      family: { ...base.family, date: '', name: '' },
      stepTablet: tabletClone,
      curves: [],
      analysisParams,
    };
  }
  for (const curve of curves) doc = appendCurve(doc, curve);
  return doc;
}

/**
 * Нужно ли предложить импорт клина при открытии устаревшего файла.
 *
 * Spec (step-tablet / «Old format step tablet handling»).
 */
export function legacyNeedsStepTabletImport(result: LegacyImportResult): boolean {
  return result.needsStepTablet;
}
