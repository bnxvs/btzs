import { describe, expect, it } from 'vitest';
import {
  AnalysisMethod,
  DEFAULTS,
  TemperatureUnit,
  emptyStepTablet,
  isDocumentKind,
} from '@/core/model';
import type {
  AnalysisParams,
  Curve,
  FilmDocument,
  PaperDocument,
  SavedMatch,
} from '@/core/model';

const baseParams: AnalysisParams = {
  method: AnalysisMethod.ApproximateCI,
  es: DEFAULTS.paperEs,
  flareDensity: DEFAULTS.flareDensity,
  expAdj: 0,
  zoneSpread: DEFAULTS.zoneSpread,
  personalSpeedPoint: DEFAULTS.personalSpeedPoint,
  usePersonalSpeedPoint: false,
  idminPercent: DEFAULTS.idminPercent,
};

const curve: Curve = {
  label: '5:30 mins',
  note: '',
  points: [
    { step: 0, density: 1.2 },
    { step: 1, density: 1.05 },
  ],
  reserved: [0, 0, 0, 0],
  dontConnectInChart: false,
};

const film: FilmDocument = {
  kind: 'film',
  rawHeader: { settings: [], marker: 104, formatVersion: 1.875, iso: 100, flag: 1 },
  family: {
    date: '10/25/01',
    name: 'Agfa APX 100',
    filmIso: 100,
    developer: 'D-76',
    dilution: 'constant, tubes',
    temperature: 70,
    temperatureUnit: TemperatureUnit.Fahrenheit,
    volume: '2 oz/sheet',
    agitation: '',
    notes: 'New test series',
  },
  stepTablet: emptyStepTablet(),
  curves: [curve],
  analysisParams: baseParams,
};

const paper: PaperDocument = {
  kind: 'paper',
  rawHeader: { settings: [], marker: 103, formatVersion: 2.53125, iso: 100, flag: 1 },
  family: {
    date: '07-06-2001',
    name: 'Agfa MCC',
    printMethod: 'contact',
    developer: 'Ilf. Universal',
    dilution: 'none',
    temperature: 68,
    temperatureUnit: TemperatureUnit.Fahrenheit,
    developingTime: '2:00',
    toner: 'none',
    drying: 'air',
    notes: '',
  },
  stepTablet: emptyStepTablet(),
  curves: [curve],
  analysisParams: baseParams,
};

describe('доменные типы', () => {
  it('сериализуются и восстанавливаются через JSON без потерь', () => {
    for (const doc of [film, paper]) {
      const round = JSON.parse(JSON.stringify(doc));
      expect(round).toEqual(doc);
    }
  });

  it('различает виды документов через isDocumentKind', () => {
    expect(isDocumentKind(film, 'film')).toBe(true);
    expect(isDocumentKind(film, 'paper')).toBe(false);
    expect(isDocumentKind(paper, 'paper')).toBe(true);
  });

  it('содержит сохранённые для сравнения сопоставления', () => {
    const match: SavedMatch = {
      name: 'match1',
      filmLabel: '5:30 mins',
      paperLabel: 'grade 2',
      points: [{ step: 0, density: 1 }],
    };
    expect(JSON.parse(JSON.stringify(match))).toEqual(match);
  });
});
