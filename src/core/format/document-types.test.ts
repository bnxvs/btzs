import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TYPES,
  OPEN_FILE_FILTERS,
  documentKindForPath,
  documentTypeOf,
  extensionOf,
} from './document-types';

describe('регистрация типов документов', () => {
  it('сопоставляет расширения видам документов', () => {
    expect(documentKindForPath('film.pfc')).toBe('film');
    expect(documentKindForPath('paper.ppc')).toBe('paper');
    expect(documentKindForPath('match.pmf')).toBe('matcher');
  });

  it('учитывает регистр и пути', () => {
    expect(documentKindForPath('/a/b/Curve.PFC')).toBe('film');
    expect(documentKindForPath('C:\\Data\\Paper.PpC')).toBe('paper');
    expect(documentKindForPath('dir.with.dots/file.pmf')).toBe('matcher');
  });

  it('возвращает null для неизвестных расширений', () => {
    expect(documentKindForPath('notes.txt')).toBeNull();
    expect(documentKindForPath('noextension')).toBeNull();
  });

  it('извлекает расширение', () => {
    expect(extensionOf('a/b/c.PFC')).toBe('.pfc');
    expect(extensionOf('dir.d/file')).toBe('');
  });

  it('содержит описания трёх типов документов', () => {
    expect(DOCUMENT_TYPES.map((t) => t.kind)).toEqual(['film', 'paper', 'matcher']);
    expect(documentTypeOf('matcher')?.extension).toBe('.pmf');
  });

  it('формирует фильтры открытия с отдельными видами и «All Files»', () => {
    const labels = OPEN_FILE_FILTERS.map((f) => f.label);
    expect(labels).toContain('All Plotter Files');
    expect(labels).toContain('Plotter Film Curves');
    expect(labels).toContain('Plotter Paper Curves');
    expect(labels).toContain('All Files');
    const all = OPEN_FILE_FILTERS.find((f) => f.label === 'All Plotter Files');
    expect(all?.patterns).toEqual(['*.pfc', '*.ppc', '*.pmf']);
  });
});
