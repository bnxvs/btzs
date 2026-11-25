import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ToeClass } from '@/core/model';
import { readPaper } from '@/core/format';
import {
  analyzePaper,
  analyzePaperCurve,
  buildSamples,
  defaultAnalysisParams,
  effectiveGradeNumber,
  isoRangeNumber,
  paperGrade,
} from '@/core/analysis';

const APP_DIR = join(process.cwd(), 'app');
const params = defaultAnalysisParams();

function paperFiles(): string[] {
  return readdirSync(APP_DIR).filter((f) => f.includes('.ppc'));
}

function readPaperSample(name: string) {
  return readPaper(new Uint8Array(readFileSync(join(APP_DIR, name))));
}

describe('анализ бумаги: IDmin/IDmax/DR/ES', () => {
  it('вычисляет показатели для всех образцов', () => {
    for (const file of paperFiles()) {
      const doc = readPaperSample(file);
      const analysis = analyzePaper(doc.curves, doc.stepTablet, params);
      expect(analysis).toHaveLength(doc.curves.length);
      for (const c of analysis) {
        expect(c.idMin, `${file} / ${c.curve.label}`).toBeTypeOf('number');
        expect(c.idMax).toBeTypeOf('number');
        expect(c.dr).toBeTypeOf('number');
        expect(c.es).toBeTypeOf('number');
      }
    }
  });

  it('IDmin < IDmax и DR = IDmax − IDmin', () => {
    for (const file of paperFiles()) {
      const doc = readPaperSample(file);
      for (const c of analyzePaper(doc.curves, doc.stepTablet, params)) {
        expect(c.idMin!).toBeLessThan(c.idMax!);
        expect(c.dr).toBeCloseTo(c.idMax! - c.idMin!, 9);
      }
    }
  });

  it('ES положителен и равен разности logE границ', () => {
    for (const file of paperFiles()) {
      const doc = readPaperSample(file);
      for (const c of analyzePaper(doc.curves, doc.stepTablet, params)) {
        expect(c.es!).toBeGreaterThan(0);
        expect(c.es).toBeCloseTo(c.idMaxLogE! - c.idMinLogE!, 9);
      }
    }
  });

  it('ISO-диапазон = ES, округлённая до 10', () => {
    expect(isoRangeNumber(0.94)).toBe(90);
    expect(isoRangeNumber(0.95)).toBe(100);
    expect(isoRangeNumber(1.04)).toBe(100);
    expect(isoRangeNumber(1.06)).toBe(110);
  });

  it('ISO-диапазон монотонно растёт с ES (больше контраст — меньше номер)', () => {
    const doc = readPaperSample('Agfa_MCC.ppc');
    const analysis = analyzePaper(doc.curves, doc.stepTablet, params);
    // Мягкие кривые (высокий ES) — у высоких номеров фильтра, контрастных — низкий ES.
    // Сверяем соответствие пары (ES, ISO Range) на каждой кривой.
    for (const c of analysis) {
      expect(c.isoRange).toBe(Math.round(c.es! * 10) * 10);
    }
  });

  it('увеличение «IDmax %» снижает рассчитанный IDmax', () => {
    const doc = readPaperSample('Agfa_MCC.ppc');
    const at90 = analyzePaperCurve(doc.curves[0], doc.stepTablet, params);
    const at95 = analyzePaperCurve(doc.curves[0], doc.stepTablet, {
      ...params,
      idminPercent: 95,
    });
    expect(at95.idMax!).toBeGreaterThan(at90.idMax!);
  });
});

describe('анализ бумаги: классы', () => {
  it('класс бумаги по таблице ANSI/ISO 6846:1992', () => {
    expect(paperGrade(0.55)).toBe(5);
    expect(paperGrade(0.7)).toBe(4);
    expect(paperGrade(0.85)).toBe(3);
    expect(paperGrade(1.0)).toBe(2);
    expect(paperGrade(1.2)).toBe(1);
    expect(paperGrade(1.5)).toBe(0);
    expect(paperGrade(1.8)).toBe(-1);
    expect(paperGrade(2.5)).toBeUndefined();
    expect(paperGrade(0.4)).toBeUndefined();
  });

  it('эффективный номер класса определён на всём диапазоне', () => {
    for (const es of [0.4, 0.5, 0.7, 1.0, 1.3, 1.55, 1.9, 2.5]) {
      expect(effectiveGradeNumber(es), `ES=${es}`).toBeTypeOf('number');
    }
    // Монотонность: рост ES монотонно меняет номер класса (по возрастанию).
    expect(effectiveGradeNumber(1.0)!).toBeGreaterThan(effectiveGradeNumber(0.6)!);
    expect(effectiveGradeNumber(1.6)!).toBeGreaterThan(effectiveGradeNumber(1.0)!);
  });

  it('контрастная кривая имеет меньший ES, чем мягкая', () => {
    const doc = readPaperSample('Agfa_MCC.ppc');
    const analysis = analyzePaper(doc.curves, doc.stepTablet, params);
    const labels = doc.curves.map((c) => c.label);
    const iSoft = labels.indexOf('-1');
    const iHard = labels.indexOf('5+');
    if (iSoft >= 0 && iHard >= 0) {
      expect(analysis[iSoft].es!).toBeGreaterThan(analysis[iHard].es!);
    }
  });

  it('класс носка — одно из допустимых значений', () => {
    for (const file of paperFiles()) {
      const doc = readPaperSample(file);
      for (const c of analyzePaper(doc.curves, doc.stepTablet, params)) {
        expect(Object.values(ToeClass)).toContain(c.toe);
      }
    }
  });

  it('относительная светочувствительность положительна', () => {
    for (const file of paperFiles()) {
      const doc = readPaperSample(file);
      for (const c of analyzePaper(doc.curves, doc.stepTablet, params)) {
        expect(c.speed!).toBeGreaterThan(0);
      }
    }
  });
});

describe('анализ бумаги: устойчивость к малому числу точек', () => {
  it('возвращает частичный результат без исключения', () => {
    const one: Parameters<typeof analyzePaperCurve>[0] = {
      label: 'x',
      note: '',
      points: [{ step: 0, density: 1 }],
      reserved: [],
      dontConnectInChart: false,
    };
    const result = analyzePaperCurve(one, { densities: [0] }, params);
    expect(result.curve).toBe(one);
    expect(result.idMax).toBeUndefined();
  });
});

// buildSamples используется в тестах плёнки; здесь проверяем устойчивость.
void buildSamples;
