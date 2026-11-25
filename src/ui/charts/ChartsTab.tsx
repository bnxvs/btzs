import { useMemo, useState } from 'react';
import { formatNumber, t } from '@/i18n';
import { FILM_CHARTS, PAPER_CHARTS, FilmChart, PaperChart } from '@/core/model';
import type { FilmDocument, PaperDocument, AnalysisParams } from '@/core/model';
import { isDevTimeChart, trackDevTime } from '@/core/analysis';
import type { FilmChartPoint } from '@/core/analysis';
import { PLOT_VIEW, fromPixelX, fromPixelY } from './chart-scale';
import { buildChartSpec, ChartCanvas } from './chart-render';
import type { ChartSpec } from './chart-render';
import { chartLabel } from './chart-label';
import { NumberField } from '@/ui/components/NumberField';

/**
 * Вкладка Charts документа плёнки/бумаги (spec: charts).
 *
 * Слева — график, справа — панель информации со списком графиков и панелью
 * параметров анализа (Paper ES, Flare Density, Exp. Adj., Zone Spread).
 * Изменение параметров немедленно пересчитывает координаты; поле «Zone Spread»
 * активно только для N-графиков. Инструмент «Track» доступен только на
 * графиках группы Dev. Time и выводит время проявления в строку состояния.
 */
export interface ChartsTabProps {
  /** Документ плёнки или бумаги. */
  doc: FilmDocument | PaperDocument;
  /** Обновление документа (изменение параметров анализа). */
  onDocChange: (doc: FilmDocument | PaperDocument) => void;
}

export function ChartsTab({ doc, onDocChange }: ChartsTabProps) {
  const [chart, setChart] = useState<string>(
    doc.kind === 'film' ? FilmChart.DevTimeSbr : PaperChart.IsoRange,
  );
  const [track, setTrack] = useState(false);
  const [trackValue, setTrackValue] = useState<number | null>(null);

  const params = doc.analysisParams;

  const spec = useMemo<ChartSpec>(() => buildChartSpec(doc, chart), [doc, chart]);

  const setParam = <K extends keyof AnalysisParams>(key: K, value: AnalysisParams[K]) => {
    onDocChange({ ...doc, analysisParams: { ...params, [key]: value } });
  };

  const changeChart = (next: string) => {
    setChart(next);
    setTrackValue(null);
    if (!(doc.kind === 'film' && isDevTimeChart(next as FilmChart))) setTrack(false);
  };

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!track || !spec.devTime) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = rect.width > 0 ? PLOT_VIEW.width / rect.width : 1;
    const sy = rect.height > 0 ? PLOT_VIEW.height / rect.height : 1;
    const vx = (event.clientX - rect.left) * sx;
    const vy = (event.clientY - rect.top) * sy;
    const dx = fromPixelX(vx, spec.scale);
    const dy = fromPixelY(vy, spec.scale);
    const value = trackDevTime(spec.points as FilmChartPoint[], dx, dy);
    setTrackValue(value ?? null);
  };

  const listKeys = doc.kind === 'film' ? FILM_CHARTS : PAPER_CHARTS;

  return (
    <div className="charts-tab" data-testid="charts-tab">
      <div className="charts-display">
        <ChartCanvas spec={spec} onMove={handleMove} />
      </div>
      <div className="charts-info" data-testid="charts-info">
        <h2>{t('charts.list')}</h2>
        <ul className="charts-list" data-testid="chart-list">
          {listKeys.map((key) => (
            <li key={key}>
              <button
                type="button"
                className={key === chart ? 'chart-item selected' : 'chart-item'}
                data-testid={`chart-item-${key}`}
                aria-current={key === chart}
                onClick={() => changeChart(key)}
              >
                {chartLabel(key)}
              </button>
            </li>
          ))}
        </ul>

        <h3>{t('charts.parameters')}</h3>
        <div className="charts-params">
          <NumberField
            testId="param-es"
            label={t('charts.paperEs')}
            className="charts-param"
            value={params.es}
            onChange={(v) => setParam('es', v)}
          />
          <NumberField
            testId="param-flare"
            label={t('charts.flareDensity')}
            className="charts-param"
            value={params.flareDensity}
            onChange={(v) => setParam('flareDensity', v)}
          />
          <NumberField
            testId="param-expadj"
            label={t('charts.expAdj')}
            className="charts-param"
            value={params.expAdj}
            onChange={(v) => setParam('expAdj', v)}
          />
          <NumberField
            testId="param-zonespread"
            label={t('charts.zoneSpread')}
            className="charts-param"
            value={params.zoneSpread}
            disabled={!spec.nChart}
            onChange={(v) => setParam('zoneSpread', v)}
          />
        </div>

        <label className="charts-track">
          <input
            type="checkbox"
            data-testid="track-toggle"
            checked={track}
            disabled={!spec.devTime}
            onChange={(e) => {
              setTrack(e.target.checked);
              if (!e.target.checked) setTrackValue(null);
            }}
          />
          <span>{t('charts.track')}</span>
        </label>
        {spec.devTime && <p className="charts-hint">{t('charts.trackHint')}</p>}
      </div>

      <p className="charts-status" data-testid="chart-status" aria-live="polite">
        {trackValue === null ? '' : t('charts.status', formatNumber(trackValue, 2))}
      </p>
    </div>
  );
}
