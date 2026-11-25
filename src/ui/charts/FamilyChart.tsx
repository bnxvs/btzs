import { formatNumber } from '@/i18n';
import type { FamilyPlot, PlotPoint } from '@/core/analysis';
import { DEFAULT_PLOT, PLOT_VIEW, seriesScale, toPixelX, toPixelY } from './chart-scale';
import type { DataScale } from './chart-scale';

/**
 * График семейства характеристических кривых (spec: charts / «Family curve
 * graph»).
 *
 * Общий для вкладки Family, вкладки Analyze (с наложением зон), вкладок
 * Film/Paper документа Matcher и предпросмотра печати. Рисует оси, сетку,
 * кривые (при включённых «цветных кривых» — разными цветами) и, при передаче
 * `plot.zones`, зоны сюжета/плотности негатива (плёнка) либо зоны печати
 * (бумага) с пунктирными проекциями на правую ось.
 */

/** Цвета кривых (в режиме «Цветные кривые»). */
const CURVE_COLORS = [
  '#0068ff',
  '#e8590c',
  '#2f9e44',
  '#c2255c',
  '#7048e8',
  '#0c8599',
  '#f08c00',
  '#86868b',
];

/** Цвет выделенной (выбранной) кривой — она подсвечивается красным. */
export const HIGHLIGHT_COLOR = '#e03131';

/** Толщина линии выделенной кривой (толще обычной). */
export const HIGHLIGHT_STROKE_WIDTH = 3;

/** Вертикальная штриховая линия построения. */
export interface VerticalGuide {
  x: number;
  label?: string;
}

/** Горизонтальная штриховая линия построения. */
export interface HorizontalGuide {
  y: number;
  label?: string;
}

/** Пунктирная (продлённая) серия. */
export interface DashedSeries {
  key: string;
  points: PlotPoint[];
}

/** Отдельный маркер. */
export interface ChartMarker {
  key: string;
  x: number;
  y: number;
  label?: string;
}

/** Подпись у конца кривой. */
export interface CurveLabel {
  key: string;
  x: number;
  y: number;
  text: string;
}

export interface FamilyChartProps {
  /** Данные графика. */
  plot: FamilyPlot;
  /** Подпись оси x. */
  xTitle: string;
  /** Подпись оси y. */
  yTitle: string;
  /** Показывать сетку. */
  showGrid?: boolean;
  /** Рисовать кривые цветом. */
  colorCurves?: boolean;
  /** Идентификатор для тестов. */
  testId?: string;
  /** Метка доступности графика. */
  ariaLabel: string;
  /** Вертикальные линии построения. */
  verticalGuides?: VerticalGuide[];
  /** Горизонтальные линии построения. */
  horizontalGuides?: HorizontalGuide[];
  /** Пунктирные серии (продлённые кривые). */
  dashed?: DashedSeries[];
  /** Отдельные маркеры. */
  markers?: ChartMarker[];
  /** Подписи у концов кривых. */
  curveLabels?: CurveLabel[];
  /**
   * Индекс выбранной кривой — подсвечивается красным цветом (spec:
   * curve-analysis / «Selected curve highlight»). Если не задан, ни одна кривая
   * не выделяется.
   */
  highlightIndex?: number;
}

/** Строит диапазон осей по всем рисуемым элементам. */
export function chartScale(props: {
  plot: FamilyPlot;
  verticalGuides?: VerticalGuide[];
  horizontalGuides?: HorizontalGuide[];
  dashed?: DashedSeries[];
  markers?: ChartMarker[];
  curveLabels?: CurveLabel[];
}): DataScale {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const series of props.plot.series) {
    for (const p of series.points) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  for (const zone of props.plot.zones.zones) {
    xs.push(zone.x0, zone.x1);
    ys.push(zone.low, zone.high, zone.median);
  }
  for (const line of props.dashed ?? []) {
    for (const p of line.points) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  for (const g of props.verticalGuides ?? []) xs.push(g.x);
  for (const g of props.horizontalGuides ?? []) ys.push(g.y);
  for (const m of props.markers ?? []) {
    xs.push(m.x);
    ys.push(m.y);
  }
  // Кривые идут по оси плотности, поэтому базовая линия — ноль.
  ys.push(0);
  return seriesScale(xs, ys);
}

export function FamilyChart(props: FamilyChartProps) {
  const { plot, colorCurves = true, showGrid = true } = props;
  const scale = chartScale(props);
  const box = DEFAULT_PLOT;
  const rightEdge = box.padding + box.width;
  const bottomEdge = box.padding + box.height;

  return (
    <svg
      className="chart-svg family-chart"
      data-testid={props.testId ?? 'family-chart'}
      role="img"
      aria-label={props.ariaLabel}
      viewBox={`0 0 ${PLOT_VIEW.width} ${PLOT_VIEW.height}`}
    >
      <rect
        className="chart-plot"
        x={box.padding}
        y={box.padding}
        width={box.width}
        height={box.height}
      />

      {showGrid &&
        axisTicks(scale, 'x').map((tick) => (
          <line
            key={`gx${tick}`}
            className="chart-grid"
            x1={toPixelX(tick, scale)}
            y1={box.padding}
            x2={toPixelX(tick, scale)}
            y2={bottomEdge}
          />
        ))}
      {showGrid &&
        axisTicks(scale, 'y').map((tick) => (
          <line
            key={`gy${tick}`}
            className="chart-grid"
            x1={box.padding}
            y1={toPixelY(tick, scale)}
            x2={rightEdge}
            y2={toPixelY(tick, scale)}
          />
        ))}

      {plot.zones.zones.map((zone, i) => {
        // Правый масштаб зон плотности негатива — равномерные деления
        // (зона 2 внизу, зона 8 вверху), как отдельная шкала в оригинале.
        const count = plot.zones.zones.length;
        const slot = box.height / count;
        const slotTop = bottomEdge - slot * (i + 1);
        return (
          <g key={`zone${zone.zone}`}>
            <rect
              className="zone-band"
              data-testid={`zone-band-${zone.zone}`}
              x={toPixelX(zone.x0, scale)}
              y={bottomEdge + 2}
              width={Math.max(0, toPixelX(zone.x1, scale) - toPixelX(zone.x0, scale))}
              height={14}
            />
            <text
              className="zone-label"
              data-testid={`zone-label-${zone.zone}`}
              x={(toPixelX(zone.x0, scale) + toPixelX(zone.x1, scale)) / 2}
              y={bottomEdge + 13}
              textAnchor="middle"
            >
              {zone.zone}
            </text>
            <rect
              className="zone-band"
              data-testid={`zone-density-band-${zone.zone}`}
              x={rightEdge + 2}
              y={slotTop}
              width={14}
              height={slot}
            />
            <text className="zone-label" x={rightEdge + 22} y={slotTop + slot / 2 + 4}>
              {zone.zone}
            </text>
            <polyline
              className="zone-projection"
              points={`${toPixelX(zone.x0, scale)},${bottomEdge} ${toPixelX(
                zone.x0,
                scale,
              )},${toPixelY(zone.median, scale)} ${rightEdge},${slotTop + slot / 2}`}
              fill="none"
            />
          </g>
        );
      })}

      {(props.verticalGuides ?? []).map((g, i) => (
        <line
          key={`vg${i}`}
          className="chart-guide"
          x1={toPixelX(g.x, scale)}
          y1={box.padding}
          x2={toPixelX(g.x, scale)}
          y2={bottomEdge}
        />
      ))}
      {(props.horizontalGuides ?? []).map((g, i) => (
        <line
          key={`hg${i}`}
          className="chart-guide"
          x1={box.padding}
          y1={toPixelY(g.y, scale)}
          x2={rightEdge}
          y2={toPixelY(g.y, scale)}
        />
      ))}

      {(props.dashed ?? []).map((line) => (
        <polyline
          key={line.key}
          className="chart-line chart-line-dashed"
          data-testid={line.key}
          points={line.points
            .map((p) => `${toPixelX(p.x, scale)},${toPixelY(p.y, scale)}`)
            .join(' ')}
          fill="none"
        />
      ))}

      {plot.series.map((series) => {
        const highlighted = props.highlightIndex === series.index;
        const stroke = colorCurves ? CURVE_COLORS[series.index % CURVE_COLORS.length] : '#1d1d1f';
        // Выбранная кривая подсвечивается красным встроенным стилем: правило
        // `.chart-line` в таблице стилей иначе перебивает цвет атрибута.
        const highlightStyle = highlighted
          ? { stroke: HIGHLIGHT_COLOR, strokeWidth: HIGHLIGHT_STROKE_WIDTH }
          : undefined;
        const dotHighlightStyle = highlighted ? { fill: HIGHLIGHT_COLOR } : undefined;
        return (
          <g
            key={`series${series.index}`}
            data-testid={`family-series-${series.index}`}
            data-highlighted={highlighted ? 'true' : undefined}
          >
            {!series.dontConnect && series.points.length > 1 && (
              <polyline
                className="chart-line"
                data-testid={`family-series-line-${series.index}`}
                points={series.points
                  .map((p) => `${toPixelX(p.x, scale)},${toPixelY(p.y, scale)}`)
                  .join(' ')}
                fill="none"
                stroke={stroke}
                style={highlightStyle}
              />
            )}
            {series.markers.map((m, i) => (
              <circle
                key={`m${i}`}
                className="chart-dot"
                cx={toPixelX(m.x, scale)}
                cy={toPixelY(m.y, scale)}
                r={highlighted ? 3.5 : 2.5}
                fill={stroke}
                style={dotHighlightStyle}
              />
            ))}
          </g>
        );
      })}

      {(props.markers ?? []).map((m) => (
        <g key={m.key} data-testid={m.key}>
          <circle
            className="chart-marker"
            cx={toPixelX(m.x, scale)}
            cy={toPixelY(m.y, scale)}
            r={4.5}
          />
          {m.label && (
            <text
              className="chart-point-label"
              x={toPixelX(m.x, scale) + 7}
              y={toPixelY(m.y, scale) - 7}
            >
              {m.label}
            </text>
          )}
        </g>
      ))}

      {(props.curveLabels ?? []).map((l) => (
        <text
          key={l.key}
          className="chart-point-label"
          data-testid={l.key}
          x={toPixelX(l.x, scale) + 7}
          y={toPixelY(l.y, scale) - 7}
        >
          {l.text}
        </text>
      ))}

      {axisTicks(scale, 'x').map((tick) => (
        <text
          key={`tx${tick}`}
          className="chart-tick"
          x={toPixelX(tick, scale)}
          y={bottomEdge + 32}
          textAnchor="middle"
        >
          {formatNumber(tick, 2)}
        </text>
      ))}
      {axisTicks(scale, 'y').map((tick) => (
        <text
          key={`ty${tick}`}
          className="chart-tick"
          x={box.padding - 8}
          y={toPixelY(tick, scale) + 4}
          textAnchor="end"
        >
          {formatNumber(tick, 2)}
        </text>
      ))}

      <text
        className="chart-axis-title"
        x={box.padding + box.width / 2}
        y={PLOT_VIEW.height - 8}
        textAnchor="middle"
      >
        {props.xTitle}
      </text>
      <text
        className="chart-axis-title"
        x={16}
        y={box.padding + box.height / 2}
        textAnchor="middle"
        transform={`rotate(-90 16 ${box.padding + box.height / 2})`}
      >
        {props.yTitle}
      </text>

      {(props.verticalGuides ?? []).map((g, i) =>
        g.label ? (
          <text
            key={`vgl${i}`}
            className="chart-guide-label"
            x={toPixelX(g.x, scale)}
            y={bottomEdge + 32}
            textAnchor="middle"
          >
            {g.label}
          </text>
        ) : null,
      )}
      {(props.horizontalGuides ?? []).map((g, i) =>
        g.label ? (
          <text
            key={`hgl${i}`}
            className="chart-guide-label"
            x={box.padding + 4}
            y={toPixelY(g.y, scale) - 4}
          >
            {g.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Пять равномерных делений оси в диапазоне данных. */
function axisTicks(scale: DataScale, axis: 'x' | 'y'): number[] {
  const min = axis === 'x' ? scale.xMin : scale.yMin;
  const max = axis === 'x' ? scale.xMax : scale.yMax;
  const ticks: number[] = [];
  const count = 4;
  for (let i = 0; i <= count; i++) {
    ticks.push(min + ((max - min) * i) / count);
  }
  return ticks;
}
