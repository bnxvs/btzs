/**
 * Низкоуровневые примитивы чтения/записи бинарных данных BTZS.
 * Все многобайтовые значения — little-endian, строки — CP1251
 * (Windows-1251), см. `./cp1251`.
 */

import { decodeCp1251, encodeCp1251 } from './cp1251';

/** Курсор чтения поверх массива байт. */
export class ByteReader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private offset = 0;

  constructor(data: ArrayBuffer | Uint8Array) {
    this.bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
  }

  get position(): number {
    return this.offset;
  }

  get length(): number {
    return this.bytes.byteLength;
  }

  get remaining(): number {
    return this.bytes.byteLength - this.offset;
  }

  /** Проверяет, что доступно ещё `n` байт. */
  private ensure(n: number): void {
    if (this.offset + n > this.bytes.byteLength) {
      throw new RangeError(
        `Чтение за границей данных: нужно ${n} байт по смещению ${this.offset}, доступно ${this.remaining}`,
      );
    }
  }

  u8(): number {
    this.ensure(1);
    return this.bytes[this.offset++];
  }

  u16(): number {
    this.ensure(2);
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }

  u32(): number {
    this.ensure(4);
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  f32(): number {
    this.ensure(4);
    const v = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  }

  f64(): number {
    this.ensure(8);
    const v = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return v;
  }

  /** Читает `n` байт. */
  bytes_(n: number): number[] {
    this.ensure(n);
    const out = Array.from(this.bytes.subarray(this.offset, this.offset + n));
    this.offset += n;
    return out;
  }

  /** Читает `u32`-длину и следующие за ней байты как строку CP1251. */
  string(): string {
    const len = this.u32();
    this.ensure(len);
    const text = decodeCp1251(this.bytes.subarray(this.offset, this.offset + len));
    this.offset += len;
    return text;
  }

  /** Читает `u8`-длину и следующие за ней байты как строку CP1251 (pascal). */
  pascalString(): string {
    const len = this.u8();
    this.ensure(len);
    const text = decodeCp1251(this.bytes.subarray(this.offset, this.offset + len));
    this.offset += len;
    return text;
  }
}

/** Буфер записи бинарных данных BTZS. */
export class ByteWriter {
  private chunks: number[] = [];

  u8(value: number): void {
    this.chunks.push(value & 0xff);
  }

  u16(value: number): void {
    this.chunks.push(value & 0xff, (value >>> 8) & 0xff);
  }

  u32(value: number): void {
    this.chunks.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
  }

  f32(value: number): void {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, value, true);
    this.chunks.push(...new Uint8Array(buf));
  }

  f64(value: number): void {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, true);
    this.chunks.push(...new Uint8Array(buf));
  }

  bytes(values: ArrayLike<number>): void {
    for (let i = 0; i < values.length; i++) {
      this.chunks.push(values[i] & 0xff);
    }
  }

  /** Записывает `u32`-длину и строку в CP1251. */
  string(value: string): void {
    this.u32(value.length);
    this.chunks.push(...encodeCp1251(value));
  }

  /** Записывает `u8`-длину и строку в CP1251 (pascal). */
  pascalString(value: string): void {
    if (value.length > 0xff) {
      throw new RangeError(`Строка длиной ${value.length} не помещается в pascal-строку`);
    }
    this.u8(value.length);
    this.chunks.push(...encodeCp1251(value));
  }

  /** Возвращает готовый массив байт. */
  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

/** Декодирует 8 байт как сигнатуру ASCII. */
export function magicAt(bytes: Uint8Array, offset = 0): string {
  let s = '';
  for (let i = 0; i < 8 && offset + i < bytes.byteLength; i++) {
    s += String.fromCharCode(bytes[offset + i]);
  }
  return s;
}
