import { formatNumber, t } from '@/i18n';
import { FilmChart, PaperChart } from '@/core/model';
import type { FilmDocument, PaperDocument } from '@/core/model';
import {
  analyzeFilm,
  analyzePaper,
  filmChartMetric,
  filmChartSeries,
  isDevTimeChart,
  paperChartSeries,
} from '@/core/analysis';
import type { ChartPoint, PaperChartPoint } from '@/core/analysis';
import {
  DEFAULT_PLOT,
  PLOT_VIEW,
  connectSegments,
  seriesScale,
  toPixelX,
  toPixelY,
} from './chart-scale';
import type { DataScale } from './chart-scale';
import { chartLabel } from './chart-label';

/**
 * Отрисовка аналитических графиков вкладки Charts (spec: charts).
 *
 * Вынесено из вкладки, чтобы те же графики рисовались в предпросмотре печати
 * (spec: printing-and-export / «Print and print preview»). Чистая часть —
 * `buildChartSpec`; представление — `ChartCanvas`.
 */

/** Описание графика для отрисовки. */
export interface ChartSpec {
  key: string;
  label: string;
  xTitle: string;
  yTitle: string;
  /** Дополнительная левая ось (для «Paper Grade Chart»). */
  yLeftTitle?: string;
  points: ChartPoint[];
  scale: DataScale;
  /** График группы Dev. Time (доступен Track). */
  devTime: boolean;
  /** N-график (активно поле Zone Spread). */
  nChart: boolean;
  /** Показывать номера классов на левой оси. */
  gradeAxis: boolean;
}

/** Строит описание графика (точки, оси, доступность) по документу. */
export function buildChartSpec(doc: FilmDocument | PaperDocument, chart: string): ChartSpec {
  if (doc.kind === 'film') return filmSpec(doc, chart as FilmChart);
  return paperSpec(doc, chart as PaperChart);
}

function filmSpec(doc: FilmDocument, chart: FilmChart): ChartSpec {
  const analysis = analyzeFilm(doc.curves, doc.stepTablet, doc.analysisParams, doc.family.filmIso);
  const points = filmChartSeries(chart, analysis);
  const xTitle = isDevTimeChart(chart) ? t('charts.axis.devTime') : t('charts.axis.efs');
  const metric = filmChartMetric(chart);
  const yTitle =
    metric === 'sbr'
      ? t('charts.axis.sbr')
      : metric === 'g'
        ? t('charts.axis.g')
        : t('charts.axis.n');
  return {
    key: chart,
    label: chartLabel(chart),
    xTitle,
    yTitle,
    points,
    scale: seriesScale(
      points.map((p) => p.x),
      points.map((p) => p.y),
    ),
    devTime: isDevTimeChart(chart),
    nChart: metric === 'n',
    gradeAxis: false,
  };
}

function paperSpec(doc: PaperDocument, chart: PaperChart): ChartSpec {
  const analysis = analyzePaper(doc.curves, doc.stepTablet, doc.analysisParams);
  const points = paperChartSeries(chart, analysis);
  const gradeChart = chart === PaperChart.PaperGrade;
  return {
    key: chart,
    label: chartLabel(chart),
    xTitle: t('charts.axis.curve'),
    yTitle: gradeChart ? t('charts.axis.es') : t('charts.axis.isoRange'),
    yLeftTitle: gradeChart ? t('charts.axis.grade') : undefined,
    points,
    scale: seriesScale(
      points.map((p) => p.x),
      points.map((p) => p.y),
    ),
    devTime: false,
    nChart: false,
    gradeAxis: gradeChart,
  };
}

/** SVG-отрисовка графика. */
export function ChartCanvas({
  spec,
  onMove,
  testId = 'chart-svg',
  className = 'chart-svg',
}: {
  spec: ChartSpec;
  onMove?: (event: React.MouseEvent<SVGSVGElement>) => void;
  testId?: string;
  className?: string;
}) {
  const { scale, points } = spec;
  const box = DEFAULT_PLOT;
  const segments = connectSegments(points);
  let segmentIndex = 0;

  return (
    <svg
      className={className}
      data-testid={testId}
      role="img"
      aria-label={spec.label}
      viewBox={`0 0 ${PLOT_VIEW.width} ${PLOT_VIEW.height}`}
      onMouseMove={onMove}
    >
      <rect
        className="chart-plot"
        x={box.padding}
        y={box.padding}
        width={box.width}
        height={box.height}
      />
      {axisTicks(scale, 'x').map((tick) => (
        <g key={`x${tick.value}`}>
          <line
            className="chart-grid"
            x1={toPixelX(tick.value, scale)}
            y1={box.padding}
            x2={toPixelX(tick.value, scale)}
            y2={box.padding + box.height}
          />
          <text
            className="chart-tick"
            x={toPixelX(tick.value, scale)}
            y={box.padding + box.height + 18}
            textAnchor="middle"
          >
            {formatNumber(tick.label, 2)}
          </text>
        </g>
      ))}
      {axisTicks(scale, 'y').map((tick) => (
        <g key={`y${tick.value}`}>
          <line
            className="chart-grid"
            x1={box.padding}
            y1={toPixelY(tick.value, scale)}
            x2={box.padding + box.width}
            y2={toPixelY(tick.value, scale)}
          />
          <text
            className="chart-tick"
            x={box.padding - 8}
            y={toPixelY(tick.value, scale) + 4}
            textAnchor="end"
          >
            {formatNumber(tick.label, 2)}
          </text>
        </g>
      ))}
      <text
        className="chart-axis-title"
        x={box.padding + box.width / 2}
        y={PLOT_VIEW.height - 8}
        textAnchor="middle"
      >
        {spec.xTitle}
      </text>
      <text
        className="chart-axis-title"
        x={16}
        y={box.padding + box.height / 2}
        textAnchor="middle"
        transform={`rotate(-90 16 ${box.padding + box.height / 2})`}
      >
        {spec.yTitle}
      </text>
      {spec.gradeAxis && <GradeAxis points={points as PaperChartPoint[]} scale={scale} />}

      {segments.map((segment) => {
        const key = `seg-${segmentIndex++}`;
        const polyline = segment
          .map((p) => `${toPixelX(p.x, scale)},${toPixelY(p.y, scale)}`)
          .join(' ');
        return (
          <polyline
            key={key}
            className="chart-line"
            data-testid={key}
            points={polyline}
            fill="none"
          />
        );
      })}
      {points.map((point, i) => (
        <g key={`p${i}`} data-testid={`chart-point-${i}`}>
          <circle
            className={point.dontConnect ? 'chart-dot disconnected' : 'chart-dot'}
            cx={toPixelX(point.x, scale)}
            cy={toPixelY(point.y, scale)}
            r={3.5}
          />
          <text
            className="chart-point-label"
            x={toPixelX(point.x, scale) + 6}
            y={toPixelY(point.y, scale) - 6}
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Левая ось номеров классов «Paper Grade Chart» (ES — справа). */
function GradeAxis({ points, scale }: { points: readonly PaperChartPoint[]; scale: DataScale }) {
  const bands = new Map<number, { sum: number; count: number }>();
  for (const p of points) {
    if (p.grade === undefined) continue;
    const entry = bands.get(p.grade) ?? { sum: 0, count: 0 };
    entry.sum += p.es;
    entry.count += 1;
    bands.set(p.grade, entry);
  }
  return (
    <>
      {[...bands.entries()].map(([grade, { sum, count }]) => {
        const es = sum / count;
        const py = toPixelY(es, scale);
        return (
          <text
            key={`grade${grade}`}
            className="chart-tick chart-grade"
            data-testid={`grade-${grade}`}
            x={DEFAULT_PLOT.width + DEFAULT_PLOT.padding + 8}
            y={py + 4}
          >
            {grade}
          </text>
        );
      })}
    </>
  );
}

/** Пять равномерных делений оси в диапазоне данных. */
function axisTicks(scale: DataScale, axis: 'x' | 'y'): { value: number; label: number }[] {
  const min = axis === 'x' ? scale.xMin : scale.yMin;
  const max = axis === 'x' ? scale.xMax : scale.yMax;
  const ticks: { value: number; label: number }[] = [];
  const count = 4;
  for (let i = 0; i <= count; i++) {
    const value = min + ((max - min) * i) / count;
    ticks.push({ value, label: value });
  }
  return ticks;
}
