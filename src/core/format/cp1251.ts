/**
 * Кодировка строк документов Plotter — CP1251 (Windows-1251).
 *
 * Исходное приложение — 32-битная MFC-программа (VC7, ANSI-сборка), поэтому
 * строки (`CString`/`char*`) записываются в файл в системной ANSI-кодировке.
 * На русской версии Windows это CP1251, и именно ею читаются/пишутся строки
 * документов `.pfc`/`.ppc`/`.pmf`.
 *
 * Свойства:
 *  - ASCII (0x00..0x7F) кодируется тождественно латинице, поэтому все образцы
 *    (чистый ASCII) сохраняют побайтовую совместимость с Windows-версией;
 *  - каждый байт 0x80..0xFF, кроме неопределённого 0x98, декодируется в
 *    кириллицу/знаки препинания CP1251 и кодируется обратно тем же байтом;
 *  - неопределённый байт 0x98 (в CP1251 не занят) сохраняется как `U+0098`
 *    и пишется обратно тем же байтом, так что `encode(decode(bytes))` для
 *    любого набора байт даёт исходные байты (круговая совместимость без потерь);
 *  - символы, отсутствующие в CP1251, записываются младшим байтом кода
 *    (как и в исходной ANSI-программе) — данные не теряются побайтово, но
 *    строковое представление таких символов после сохранения не восстановится.
 */

/**
 * Байты 0x80..0xFF CP1251 как коды Unicode; индекс = байт − 0x80.
 * `null` — неопределённый байт 0x98.
 */
const CP1251_HIGH: ReadonlyArray<number | null> = [
  0x0402, 0x0403, 0x201a, 0x0453, 0x201e, 0x2026, 0x2020, 0x2021,
  0x20ac, 0x2030, 0x0409, 0x2039, 0x040a, 0x040c, 0x040b, 0x040f,
  0x0452, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  null, 0x2122, 0x0459, 0x203a, 0x045a, 0x045c, 0x045b, 0x045f,
  0x00a0, 0x040e, 0x045e, 0x0408, 0x00a4, 0x0490, 0x00a6, 0x00a7,
  0x0401, 0x00a9, 0x0404, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x0407,
  0x00b0, 0x00b1, 0x0406, 0x0456, 0x0491, 0x00b5, 0x00b6, 0x00b7,
  0x0451, 0x2116, 0x0454, 0x00bb, 0x0458, 0x0405, 0x0455, 0x0457,
  // 0xC0..0xFF — заглавные и строчные буквы русского алфавита А..я.
  ...Array.from({ length: 64 }, (_, i) => 0x0410 + i),
];

/** Обратная таблица: код Unicode → байт CP1251. */
const CP1251_REVERSE: ReadonlyMap<number, number> = new Map(
  CP1251_HIGH.flatMap((code, index) => (code === null ? [] : [[code, index + 0x80] as const])),
);

/** Декодирует один байт CP1251 (неопределённый 0x98 → `U+0098`). */
export function decodeCp1251Byte(byte: number): string {
  const b = byte & 0xff;
  if (b < 0x80) return String.fromCharCode(b);
  return String.fromCharCode(CP1251_HIGH[b - 0x80] ?? b);
}

/**
 * Кодирует один код символа в байт CP1251; символы, которых нет в таблице,
 * записываются младшим байтом кода.
 */
export function encodeCp1251Char(code: number): number {
  if (code < 0x80) return code;
  return CP1251_REVERSE.get(code) ?? code & 0xff;
}

/** Декодирует байты CP1251 в строку. */
export function decodeCp1251(bytes: ArrayLike<number>): string {
  let text = '';
  for (let i = 0; i < bytes.length; i++) {
    text += decodeCp1251Byte(bytes[i]);
  }
  return text;
}

/** Кодирует строку в байты CP1251 (по одному байту на символ). */
export function encodeCp1251(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    bytes.push(encodeCp1251Char(text.charCodeAt(i)));
  }
  return bytes;
}
