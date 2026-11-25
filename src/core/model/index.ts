/**
 * `core/model` — типы домена Plotter (Film, Paper, Matcher, Curve, StepTablet,
 * AnalysisParams и т. д.), общие для парсера форматов, расчётного ядра и UI.
 */

/** Имя пакета (используется в проверках структуры). */
export const MODEL_MODULE = 'core/model';

export * from './constants';
export * from './types';
export * from './curve-ops';
export * from './step-tablet';
export * from './factory';
