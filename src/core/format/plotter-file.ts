import { FILE_MAGIC, AnalysisMethod, DEFAULTS, TemperatureUnit } from '@/core/model';
import type {
  AnalysisParams,
  Curve,
  CurvePoint,
  FilmDocument,
  PaperDocument,
  StepTablet,
} from '@/core/model';
import { ByteReader, ByteWriter, magicAt } from './bytes';

/**
 * Результаты реверса формата `.pfc`/`.ppc` (см. `docs/btzs-format.md`).
 *
 * Все значения little-endian; строки — `u32 длина` + байты CP1251 (Windows-1251).
 * Поле u32 по смещению 0x08 («маркер») задаёт layout:
 *   - 100 (старый, DOS/Efke-совместимый): строки начинаются с 0x34;
 *   - 103 (бумага) и 104 (плёнка): строки начинаются с 0x48.
 * Число строк в заголовке — 10 для всех наблюдаемых образцов.
 * Размер зарезервированного блока кривой: 20 для плёнки (100/104), 4 для бумаги (103).
 */
export const HEADER_STRING_COUNT = 10;

/** Смещение начала строк в зависимости от маркера. */
export function stringsOffsetForMarker(marker: number): number {
  return marker === 100 ? 0x30 : 0x48;
}

/**
 * Правило размера `reserved` (20 для маркера 104, 4 для 100/103) централизовано
 * в `core/model`; реэкспорт сохраняет совместимость API формата.
 */
export { reservedSizeForMarker } from '@/core/model';
import { reservedSizeForMarker } from '@/core/model';

interface ParsedFile {
  marker: number;
  settings: number[];
  strings: string[];
  formatVersion: number;
  iso: number;
  temperature: number;
  flag: number;
  stepTablet: StepTablet;
  curves: Curve[];
}

function readAnalysisParams(es: number): AnalysisParams {
  return {
    method: AnalysisMethod.ApproximateCI,
    es,
    flareDensity: DEFAULTS.flareDensity,
    expAdj: 0,
    zoneSpread: DEFAULTS.zoneSpread,
    personalSpeedPoint: DEFAULTS.personalSpeedPoint,
    usePersonalSpeedPoint: false,
    idminPercent: DEFAULTS.idminPercent,
  };
}

function readCurve(reader: ByteReader, reservedSize: number): Curve {
  const label = reader.string();
  const note = reader.string();
  const reserved = reader.bytes_(reservedSize);
  const pointCount = reader.u32();
  const points: CurvePoint[] = [];
  for (let i = 0; i < pointCount; i++) {
    const step = reader.u8();
    const density = reader.f64();
    points.push({ step, density });
  }
  return { label, note, points, reserved, dontConnectInChart: false };
}

function parseCommon(data: Uint8Array): ParsedFile {
  const magic = magicAt(data, 0);
  if (magic !== FILE_MAGIC.film && magic !== FILE_MAGIC.paper) {
    throw new Error(`Неверная сигнатура файла: «${magic}»`);
  }
  const reader = new ByteReader(data);
  reader.u32(); // первые 4 байта магии
  reader.u32(); // вторые 4 байта магии
  const marker = reader.u32();
  const stringsOffset = stringsOffsetForMarker(marker);
  // Блок настроек: от 0x0c до начала строк, сохраняется «как есть».
  const settings = reader.bytes_(stringsOffset - 0x0c);
  const strings: string[] = [];
  for (let i = 0; i < HEADER_STRING_COUNT; i++) {
    strings.push(reader.string());
  }
  const formatVersion = reader.f32();
  const iso = reader.u32();
  const temperature = reader.f64();
  const flag = reader.u32();
  const stepCount = reader.u32();
  const densities: number[] = [];
  for (let i = 0; i < stepCount; i++) {
    reader.u8();
    densities.push(reader.f64());
  }
  const curveCount = reader.u32();
  const reservedSize = reservedSizeForMarker(marker);
  const curves: Curve[] = [];
  for (let i = 0; i < curveCount; i++) {
    curves.push(readCurve(reader, reservedSize));
  }
  if (reader.remaining !== 0) {
    throw new Error(`Разбор не совпал с длиной файла: осталось ${reader.remaining} байт`);
  }
  return {
    marker,
    settings,
    strings,
    formatVersion,
    iso,
    temperature,
    flag,
    stepTablet: { densities },
    curves,
  };
}

/** Читает документ плёнки `.pfc` из массива байт. */
export function readFilm(data: Uint8Array): FilmDocument {
  if (magicAt(data, 0) !== FILE_MAGIC.film) {
    throw new Error('Файл не является документом плёнки (.pfc)');
  }
  const p = parseCommon(data);
  const [date, name, developer, dilution, notes, , , , volume, agitation] = p.strings;
  return {
    kind: 'film',
    rawHeader: {
      settings: p.settings,
      marker: p.marker,
      formatVersion: p.formatVersion,
      iso: p.iso,
      flag: p.flag,
    },
    family: {
      date,
      name,
      filmIso: p.iso,
      developer,
      dilution,
      temperature: p.temperature,
      temperatureUnit: TemperatureUnit.Fahrenheit,
      volume,
      agitation,
      notes,
    },
    stepTablet: p.stepTablet,
    curves: p.curves,
    analysisParams: readAnalysisParams(DEFAULTS.paperEs),
  };
}

/** Читает документ бумаги `.ppc` из массива байт. */
export function readPaper(data: Uint8Array): PaperDocument {
  if (magicAt(data, 0) !== FILE_MAGIC.paper) {
    throw new Error('Файл не является документом бумаги (.ppc)');
  }
  const p = parseCommon(data);
  const [date, name, developer, dilution, notes, printMethod, developingTime, drying, toner] =
    p.strings;
  return {
    kind: 'paper',
    rawHeader: {
      settings: p.settings,
      marker: p.marker,
      formatVersion: p.formatVersion,
      iso: p.iso,
      flag: p.flag,
    },
    family: {
      date,
      name,
      printMethod,
      developer,
      dilution,
      temperature: p.temperature,
      temperatureUnit: TemperatureUnit.Fahrenheit,
      developingTime,
      toner,
      drying,
      notes,
    },
    stepTablet: p.stepTablet,
    curves: p.curves,
    analysisParams: readAnalysisParams(1.0),
  };
}

function writeCommon(writer: ByteWriter, magic: string, p: ParsedFile): void {
  for (let i = 0; i < 8; i++) {
    writer.u8(magic.charCodeAt(i));
  }
  writer.u32(p.marker);
  const stringsOffset = stringsOffsetForMarker(p.marker);
  const expectedSettings = stringsOffset - 0x0c;
  if (p.settings.length !== expectedSettings) {
    throw new Error(
      `Размер блока настроек = ${p.settings.length}, ожидалось ${expectedSettings} для маркера ${p.marker}`,
    );
  }
  writer.bytes(p.settings);
  for (const s of p.strings) {
    writer.string(s);
  }
  writer.f32(p.formatVersion);
  writer.u32(p.iso);
  writer.f64(p.temperature);
  writer.u32(p.flag);
  writer.u32(p.stepTablet.densities.length);
  p.stepTablet.densities.forEach((density, step) => {
    writer.u8(step);
    writer.f64(density);
  });
  writer.u32(p.curves.length);
  const reservedSize = reservedSizeForMarker(p.marker);
  for (const curve of p.curves) {
    if (curve.reserved.length !== reservedSize) {
      throw new Error(
        `Размер reserved кривой «${curve.label}» = ${curve.reserved.length}, ожидалось ${reservedSize}`,
      );
    }
    writer.string(curve.label);
    writer.string(curve.note);
    writer.bytes(curve.reserved);
    writer.u32(curve.points.length);
    for (const point of curve.points) {
      writer.u8(point.step);
      writer.f64(point.density);
    }
  }
}

function toParsedCommon(
  doc: FilmDocument | PaperDocument,
  strings: string[],
): ParsedFile {
  return {
    marker: doc.rawHeader.marker,
    settings: doc.rawHeader.settings,
    strings,
    formatVersion: doc.rawHeader.formatVersion,
    iso: doc.kind === 'film' ? doc.family.filmIso : doc.rawHeader.iso,
    temperature: doc.family.temperature,
    flag: doc.rawHeader.flag,
    stepTablet: doc.stepTablet,
    curves: doc.curves,
  };
}

/** Записывает документ плёнки `.pfc` в массив байт. */
export function writeFilm(doc: FilmDocument): Uint8Array {
  const f = doc.family;
  const strings = [
    f.date,
    f.name,
    f.developer,
    f.dilution,
    f.notes,
    '',
    '',
    '',
    f.volume,
    f.agitation,
  ];
  const writer = new ByteWriter();
  writeCommon(writer, FILE_MAGIC.film, toParsedCommon(doc, strings));
  return writer.toUint8Array();
}

/** Записывает документ бумаги `.ppc` в массив байт. */
export function writePaper(doc: PaperDocument): Uint8Array {
  const f = doc.family;
  const strings = [
    f.date,
    f.name,
    f.developer,
    f.dilution,
    f.notes,
    f.printMethod,
    f.developingTime,
    f.drying,
    f.toner,
    '',
  ];
  const writer = new ByteWriter();
  writeCommon(writer, FILE_MAGIC.paper, toParsedCommon(doc, strings));
  return writer.toUint8Array();
}
