import { describe, expect, it } from 'vitest';
import {
  decodeCp1251,
  decodeCp1251Byte,
  encodeCp1251,
  encodeCp1251Char,
} from './cp1251';

describe('cp1251', () => {
  it('ASCII кодируется тождественно латинице', () => {
    const text = 'ID-11 5:30 #4 !~';
    expect(encodeCp1251(text)).toEqual([...text].map((c) => c.charCodeAt(0)));
    expect(decodeCp1251(encodeCp1251(text))).toBe(text);
  });

  it('русский текст переживает круговую запись', () => {
    const text = 'Проявитель: ID-11, проба «контроль»';
    const bytes = encodeCp1251(text);
    expect(bytes).toHaveLength(text.length);
    expect(decodeCp1251(bytes)).toBe(text);
  });

  it('кириллица кодируется в однобайтовый диапазон 0xC0..0xFF', () => {
    expect(encodeCp1251('А')).toEqual([0xc0]);
    expect(encodeCp1251('я')).toEqual([0xff]);
    expect(encodeCp1251('Ё')).toEqual([0xa8]);
    expect(encodeCp1251('ё')).toEqual([0xb8]);
  });

  it('любой байт 0x00..0xFF декодируется и кодируется обратно тем же байтом', () => {
    const all = Array.from({ length: 256 }, (_, b) => b);
    const bytes = encodeCp1251(decodeCp1251(all));
    expect(bytes).toEqual(all);
  });

  it('неопределённый байт 0x98 сохраняется без потерь', () => {
    expect(decodeCp1251Byte(0x98)).toBe('\u0098');
    expect(encodeCp1251Char(0x0098)).toBe(0x98);
  });

  it('символ вне CP1251 пишется младшим байтом кода', () => {
    // 'é' (U+00E9) в CP1251 отсутствует → записывается как 0xE9, который в
    // CP1251 — 'й'. Побайтовых потерь нет, но строковая форма меняется.
    expect(encodeCp1251Char(0x00e9)).toBe(0xe9);
    expect(decodeCp1251([0xe9])).toBe('й');
  });
});
