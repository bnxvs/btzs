import { FILE_MAGIC, ReferenceCurveType } from '@/core/model';
import type {
  Curve,
  CurvePoint,
  FileReference,
  MatcherApproximatedCurve,
  MatcherDocument,
  SavedMatch,
} from '@/core/model';
import { ByteReader, ByteWriter, magicAt } from './bytes';

/**
 * Кодек документа Matcher `.pmf`.
 *
 * Формат (little-endian, строки-ссылки — pascal: u8 длина + CP1251),
 * восстановлен по образцу `app/D100-RefCrv.pmf` (442 байта) с побайтовым
 * круговым совпадением:
 *
 * ```
 * char[8] magic          // «BTZSPAP» + 1 байт версии (0x92)
 * u32     version        // 5
 * u32     constValue     // 1
 * f64[10] referenceGrays // эталонные серые
 * ref     filmRef        // u32 code + pascal path + u32 mtime
 * ref     paperRef       // u32 code + pascal path + u32 mtime
 * u8[48]  middle         // непонятый блок (сохраняется как есть)
 * u32     approxCount
 * повтор approxCount раз:
 *   u32   code           // 1 = SBR, иное — по метке
 *   u32   labelLen + label
 *   u32   a              // наблюдалось 0
 *   u32   b              // наблюдалось 0
 *   u32   c              // наблюдалось 1
 *   f64   value          // запрошенное SBR / средняя G
 *   u32   d              // наблюдалось 0
 *   u32   pointCount
 *   pointCount × (u8 step + f64 density)
 * u32     trailing       // наблюдалось 0
 * ```
 *
 * Поля, семантика которых реверсом не подтверждена (`code` ссылки, блок 48
 * байт, три u32 записи кривой), сохраняются «как есть» — благодаря этому
 * образец проходит побайтовый round-trip.
 *
 * Дополнительное состояние приложения (выбранные кривые, тип эталонной кривой,
 * переопределённые параметры анализа, сохранённые для сравнения сопоставления)
 * исходный формат в доступном образце не хранит открыто. Чтобы это состояние
 * переживало сохранение/открытие, после замыкающего `u32` пишется
 * необязательный «хвост» с собственной сигнатурой (`BTZSMEX` + версия). Если
 * состояние полностью по умолчанию, хвост не пишется — тогда файл побайтово
 * совпадает с исходным. Читатель распознаёт хвост по сигнатуре и без него не
 * падает.
 */
const REFERENCE_GRAY_COUNT = 10;
const MIDDLE_SIZE = 48;
/** Код приближённой кривой по SBR (по средней G — иной). */
const APPROX_CODE_SBR = 1;
const APPROX_CODE_G = 2;

/** Сигнатура необязательного хвоста приложения. */
const TRAILER_MAGIC = 'BTZSMEX';
/** Версия хвоста. */
const TRAILER_VERSION = 1;

/** Флаги расширенного состояния. */
const TRAILER_FLAG_OVERRIDDEN = 1;
const TRAILER_FLAG_LOCK_DR = 2;

function readFileReference(reader: ByteReader): FileReference {
  const code = reader.u32();
  const path = reader.pascalString();
  const modifiedAt = reader.u32();
  return { code, path, name: baseName(path), modifiedAt };
}

function baseName(path: string): string {
  const idx = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function writeFileReference(writer: ByteWriter, ref: FileReference): void {
  writer.u32(ref.code);
  writer.pascalString(ref.path);
  writer.u32(ref.modifiedAt ?? 0);
}

function pointToCurvePoint(step: number, density: number): CurvePoint {
  return { step, density };
}

function approxByFrom(code: number, label: string): 'sbr' | 'g' {
  if (/^SBR/i.test(label)) return 'sbr';
  if (/G/i.test(label) && /Ave/i.test(label)) return 'g';
  return code === APPROX_CODE_SBR ? 'sbr' : 'g';
}

function referenceTypeFromCode(code: number): ReferenceCurveType {
  switch (code) {
    case 1:
      return ReferenceCurveType.Flared;
    case 2:
      return ReferenceCurveType.Loaded;
    default:
      return ReferenceCurveType.Default;
  }
}

function referenceTypeToCode(type: ReferenceCurveType): number {
  switch (type) {
    case ReferenceCurveType.Flared:
      return 1;
    case ReferenceCurveType.Loaded:
      return 2;
    default:
      return 0;
  }
}

/** Читает документ Matcher `.pmf` из массива байт. */
export function readMatcher(data: Uint8Array): MatcherDocument {
  // Магия `.pmf` — «BTZSPAP» (7 байт) + байт версии 0x92; магия бумаги —
  // «BTZSPAPR», поэтому дополнительно требуем, чтобы 8-й байт не был «R».
  const magic = magicAt(data, 0);
  if (magic.slice(0, 7) !== FILE_MAGIC.matcher || magic.charCodeAt(7) === 0x52) {
    throw new Error('Файл не является документом Matcher (.pmf)');
  }
  const reader = new ByteReader(data);
  reader.bytes_(7); // «BTZSPAP»
  const magicVersion = reader.u8(); // байт версии в магии
  const version = reader.u32();
  const constValue = reader.u32();
  const referenceCurveGrays: number[] = [];
  for (let i = 0; i < REFERENCE_GRAY_COUNT; i++) {
    referenceCurveGrays.push(reader.f64());
  }
  const filmRef = readFileReference(reader);
  const paperRef = readFileReference(reader);
  const middle = reader.bytes_(MIDDLE_SIZE);
  const approxCount = reader.u32();
  const approximatedCurves: MatcherApproximatedCurve[] = [];
  for (let i = 0; i < approxCount; i++) {
    const code = reader.u32();
    const label = reader.string();
    const a = reader.u32();
    const b = reader.u32();
    const c = reader.u32();
    const value = reader.f64();
    const d = reader.u32();
    const pointCount = reader.u32();
    const points: CurvePoint[] = [];
    for (let p = 0; p < pointCount; p++) {
      const step = reader.u8();
      points.push(pointToCurvePoint(step, reader.f64()));
    }
    approximatedCurves.push({
      by: approxByFrom(code, label),
      value,
      label,
      points,
      reserved: [code, a, b, c, d],
    });
  }
  const trailing = reader.u32();
  // Необязательный хвост приложения (см. комментарий к модулю).
  const trailer =
    reader.remaining > 0 && magicAt(data, reader.position).slice(0, 7) === TRAILER_MAGIC
      ? readTrailer(reader)
      : undefined;
  if (reader.remaining !== 0) {
    throw new Error(`Разбор .pmf не совпал с длиной файла: осталось ${reader.remaining} байт`);
  }
  return {
    kind: 'matcher',
    rawHeader: { magicVersion, version, constValue, middle, trailing },
    filmRef,
    paperRef,
    selectedFilmCurve: trailer?.selectedFilmCurve ?? 0,
    selectedPaperCurve: trailer?.selectedPaperCurve ?? 0,
    referenceCurveType: trailer?.referenceCurveType ?? ReferenceCurveType.Default,
    referenceCurveGrays,
    loadedReferenceCurve: trailer?.loadedReferenceCurve,
    approximatedCurves,
    savedMatches: trailer?.savedMatches ?? [],
    analysisParams: trailer?.analysisParams ?? {
      method: 'approximate-ci',
      es: 1.0,
      flareDensity: 0,
      expAdj: 0,
      zoneSpread: 4,
      personalSpeedPoint: 2.4,
      usePersonalSpeedPoint: false,
      idminPercent: 90,
    },
    analysisOverridden: trailer?.analysisOverridden ?? false,
    lockFilmDrToEs: trailer?.lockFilmDrToEs ?? false,
  };
}

/** Разбирает расширенный хвост приложения. */
function readTrailer(reader: ByteReader): {
  referenceCurveType: ReferenceCurveType;
  selectedFilmCurve: number;
  selectedPaperCurve: number;
  analysisOverridden: boolean;
  lockFilmDrToEs: boolean;
  analysisParams: MatcherDocument['analysisParams'];
  loadedReferenceCurve?: Curve;
  savedMatches: SavedMatch[];
} {
  reader.bytes_(7); // сигнатура «BTZSMEX»
  reader.u8(); // версия 1
  reader.u32();
  const referenceCurveType = referenceTypeFromCode(reader.u32());
  const flags = reader.u32();
  const selectedFilmCurve = reader.u32();
  const selectedPaperCurve = reader.u32();
  const analysisParams: MatcherDocument['analysisParams'] = {
    method: readU32PairAsMethod(reader),
    es: reader.f64(),
    flareDensity: reader.f64(),
    expAdj: reader.f64(),
    zoneSpread: reader.u32(),
    personalSpeedPoint: reader.f64(),
    usePersonalSpeedPoint: reader.u32() !== 0,
    idminPercent: reader.f64(),
  };
  const hasLoaded = reader.u32() !== 0;
  const loadedReferenceCurve = hasLoaded ? readExtendedCurve(reader) : undefined;
  const matchCount = reader.u32();
  const savedMatches: SavedMatch[] = [];
  for (let i = 0; i < matchCount; i++) {
    const name = reader.string();
    const filmLabel = reader.string();
    const paperLabel = reader.string();
    const source = reader.u32() === 1 ? 'external' : 'current';
    const clipped = reader.u32() !== 0;
    const pointCount = reader.u32();
    const points: CurvePoint[] = [];
    for (let p = 0; p < pointCount; p++) {
      points.push(pointToCurvePoint(reader.u8(), reader.f64()));
    }
    savedMatches.push({ name, filmLabel, paperLabel, points, source, clipped });
  }
  return {
    referenceCurveType,
    selectedFilmCurve,
    selectedPaperCurve,
    analysisOverridden: (flags & TRAILER_FLAG_OVERRIDDEN) !== 0,
    lockFilmDrToEs: (flags & TRAILER_FLAG_LOCK_DR) !== 0,
    analysisParams,
    loadedReferenceCurve,
    savedMatches,
  };
}

/** Записывает расширенный хвост приложения. */
function writeTrailer(writer: ByteWriter, doc: MatcherDocument): void {
  for (let i = 0; i < 7; i++) writer.u8(TRAILER_MAGIC.charCodeAt(i));
  writer.u8(TRAILER_VERSION);
  writer.u32(TRAILER_VERSION);
  writer.u32(referenceTypeToCode(doc.referenceCurveType));
  const flags =
    (doc.analysisOverridden ? TRAILER_FLAG_OVERRIDDEN : 0) |
    (doc.lockFilmDrToEs ? TRAILER_FLAG_LOCK_DR : 0);
  writer.u32(flags);
  writer.u32(doc.selectedFilmCurve);
  writer.u32(doc.selectedPaperCurve);
  writeMethodAsU32Pair(writer, doc.analysisParams.method);
  writer.f64(doc.analysisParams.es);
  writer.f64(doc.analysisParams.flareDensity);
  writer.f64(doc.analysisParams.expAdj);
  writer.u32(doc.analysisParams.zoneSpread);
  writer.f64(doc.analysisParams.personalSpeedPoint);
  writer.u32(doc.analysisParams.usePersonalSpeedPoint ? 1 : 0);
  writer.f64(doc.analysisParams.idminPercent);
  if (doc.loadedReferenceCurve) {
    writer.u32(1);
    writeExtendedCurve(writer, doc.loadedReferenceCurve);
  } else {
    writer.u32(0);
  }
  writer.u32(doc.savedMatches.length);
  for (const match of doc.savedMatches) {
    writer.string(match.name);
    writer.string(match.filmLabel);
    writer.string(match.paperLabel);
    writer.u32(match.source === 'external' ? 1 : 0);
    writer.u32(match.clipped ? 1 : 0);
    writer.u32(match.points.length);
    for (const point of match.points) {
      writer.u8(point.step);
      writer.f64(point.density);
    }
  }
}

/** Метод анализа как пара u32 (совместимо с макетами `.pfc`). */
function readU32PairAsMethod(reader: ByteReader): 'approximate-ci' | 'over-fbf' {
  const code = reader.u32();
  reader.u32(); // второй элемент пары
  return code === 1 ? 'over-fbf' : 'approximate-ci';
}

function writeMethodAsU32Pair(writer: ByteWriter, method: string): void {
  writer.u32(method === 'over-fbf' ? 1 : 0);
  writer.u32(0);
}

/** Читает кривую расширенного хвоста (метка, точки). */
function readExtendedCurve(reader: ByteReader): Curve {
  const label = reader.string();
  const pointCount = reader.u32();
  const points: CurvePoint[] = [];
  for (let p = 0; p < pointCount; p++) {
    points.push(pointToCurvePoint(reader.u8(), reader.f64()));
  }
  return { label, note: '', points, reserved: [], dontConnectInChart: false };
}

function writeExtendedCurve(writer: ByteWriter, curve: Curve): void {
  writer.string(curve.label);
  writer.u32(curve.points.length);
  for (const point of curve.points) {
    writer.u8(point.step);
    writer.f64(point.density);
  }
}

/** Есть ли у документа состояние, требующее хвоста приложения. */
function needsTrailer(doc: MatcherDocument): boolean {
  return (
    doc.selectedFilmCurve !== 0 ||
    doc.selectedPaperCurve !== 0 ||
    doc.referenceCurveType !== ReferenceCurveType.Default ||
    doc.loadedReferenceCurve !== undefined ||
    doc.approximatedCurves.some((c) => c.outOfRange) ||
    doc.savedMatches.length > 0 ||
    doc.analysisOverridden ||
    doc.lockFilmDrToEs
  );
}

/** Записывает документ Matcher `.pmf` в массив байт. */
export function writeMatcher(doc: MatcherDocument): Uint8Array {
  const writer = new ByteWriter();
  for (let i = 0; i < 7; i++) {
    writer.u8(FILE_MAGIC.matcher.charCodeAt(i));
  }
  writer.u8(doc.rawHeader.magicVersion); // байт версии внутри магии (0x92)
  writer.u32(doc.rawHeader.version);
  writer.u32(doc.rawHeader.constValue);
  for (let i = 0; i < REFERENCE_GRAY_COUNT; i++) {
    writer.f64(doc.referenceCurveGrays[i] ?? 0);
  }
  writeFileReference(writer, doc.filmRef);
  writeFileReference(writer, doc.paperRef);
  writer.bytes(doc.rawHeader.middle);
  writer.u32(doc.approximatedCurves.length);
  for (const curve of doc.approximatedCurves) {
    writer.u32(curve.reserved[0] ?? (curve.by === 'sbr' ? APPROX_CODE_SBR : APPROX_CODE_G));
    writer.string(curve.label);
    writer.u32(curve.reserved[1] ?? 0);
    writer.u32(curve.reserved[2] ?? 0);
    writer.u32(curve.reserved[3] ?? 0);
    writer.f64(curve.value);
    writer.u32(curve.reserved[4] ?? 0);
    writer.u32(curve.points.length);
    for (const point of curve.points) {
      writer.u8(point.step);
      writer.f64(point.density);
    }
  }
  writer.u32(doc.rawHeader.trailing);
  if (needsTrailer(doc)) writeTrailer(writer, doc);
  return writer.toUint8Array();
}
