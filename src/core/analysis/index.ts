/**
 * `core/analysis` — чистое расчётное ядро (без UI): точки скорости, EFS, G-bar,
 * SBR, ES, зоны, N-числа, анализ бумаги (IDmin/IDmax, DR, ISO Range, класс носка).
 *
 * Детерминированные функции над данными документа. Реализация — группа 4.
 */
export const ANALYSIS_MODULE = 'core/analysis';

export * from './constants';
export * from './curve';
export * from './film';
export * from './paper';
export * from './flare';
export * from './zones';
export * from './display';
export * from './family';
export * from './charts';
export * from './matcher';
export * from './registry';
