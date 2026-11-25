import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFilm, readPaper, writeFilm, writePaper } from './plotter-file';

const APP_DIR = join(process.cwd(), 'app');

function samples(ext: '.pfc' | '.ppc'): string[] {
  return readdirSync(APP_DIR).filter((f) => f.includes(ext));
}

function readBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(APP_DIR, name)));
}

describe('кодек .pfc/.ppc', () => {
  const filmFiles = samples('.pfc');
  const paperFiles = samples('.ppc');

  it('находит образцы плёнки и бумаги', () => {
    expect(filmFiles.length).toBeGreaterThan(0);
    expect(paperFiles.length).toBeGreaterThan(0);
  });

  it.each(filmFiles)('читает плёнку %s', (name) => {
    const doc = readFilm(readBytes(name));
    expect(doc.kind).toBe('film');
    expect(doc.curves.length).toBeGreaterThan(0);
    expect(doc.family.name.length).toBeGreaterThan(0);
  });

  it.each(paperFiles)('читает бумагу %s', (name) => {
    const doc = readPaper(readBytes(name));
    expect(doc.kind).toBe('paper');
    expect(doc.curves.length).toBeGreaterThan(0);
  });

  it.each(filmFiles)('round-trip без потерь: %s', (name) => {
    const original = readBytes(name);
    const doc = readFilm(original);
    const written = writeFilm(doc);
    expect(Array.from(written)).toEqual(Array.from(original));
  });

  it.each(paperFiles)('round-trip без потерь: %s', (name) => {
    const original = readBytes(name);
    const doc = readPaper(original);
    const written = writePaper(doc);
    expect(Array.from(written)).toEqual(Array.from(original));
  });

  it('отвергает файл с неверной сигнатурой', () => {
    const junk = new Uint8Array(200);
    expect(() => readFilm(junk)).toThrow(/плёнки/i);
    expect(() => readPaper(junk)).toThrow(/бумаги/i);
  });
});
