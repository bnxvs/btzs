import { useMemo, useSyncExternalStore, useState } from 'react';
import { formatNumber, t } from '@/i18n';
import type { MessageKey } from '@/i18n';
import { AnalysisMethod, DEFAULTS, PAPER_SPEED_DENSITY } from '@/core/model';
import type { AnalysisParams, FilmDocument, PaperDocument } from '@/core/model';
import {
  APP_LOG_E_OFFSET,
  analyzeFilm,
  analyzePaper,
  buildFamilyPlot,
  buildSamples,
  extendForLowGradient,
  filmGraphZones,
  negativeDensityZones,
  paperGraphZones,
  printZoneBounds,
  subjectZones,
} from '@/core/analysis';
import { getViewSettings, subscribeViewSettings } from '@/store';
import { NumberField } from '@/ui/components/NumberField';
import { FamilyChart } from '@/ui/charts/FamilyChart';
import type { ChartMarker, CurveLabel, DashedSeries } from '@/ui/charts/FamilyChart';

/**
 * Вкладка Analyze документа плёнки/бумаги (spec: curve-analysis).
 *
 * Плёнка: выбор кривой и метода точки скорости, параметры Paper ES, Flare
 * Density и Exp. Adj., метки EFS/G-bar/SBR по каждой кривой, флажок «Display
 * Information», зоны сюжета и зоны плотности негатива; кривые с низким
 * градиентом помечаются как продлённые пунктиром.
 *
 * Бумага: параметр «IDmax %» с пометкой о несоответствии стандарту при
 * отклонении от 90, метки IDmin/IDmax/DR/ES/ISO-диапазона/класса, построение
 * относительной светочувствительности (плотность 0,6) и зоны печати с
 * границами и медианной плотностью по наведению.
 */

/** Отличается ли значение «IDmax %» от стандартного (90). */
function isNonStandardIdmax(percent: number): boolean {
  return Math.abs(percent - DEFAULTS.idminPercent) > 1e-9;
}

export interface AnalyzeTabProps {
  /** Документ плёнки или бумаги. */
  doc: FilmDocument | PaperDocument;
  /** Обновление документа (изменение параметров анализа). */
  onDocChange: (doc: FilmDocument | PaperDocument) => void;
}

export function AnalyzeTab({ doc, onDocChange }: AnalyzeTabProps) {
  const [displayInfo, setDisplayInfo] = useState<boolean>(DEFAULTS.displayInformation);

  const setParam = <K extends keyof AnalysisParams>(key: K, value: AnalysisParams[K]) => {
    onDocChange({ ...doc, analysisParams: { ...doc.analysisParams, [key]: value } });
  };

  return (
    <div className="analyze-tab" data-testid="analyze-tab">
      <label className="analyze-display-info">
        <input
          type="checkbox"
          data-testid="display-information"
          checked={displayInfo}
          onChange={(e) => setDisplayInfo(e.target.checked)}
        />
        <span>{t('analyze.displayInformation')}</span>
      </label>

      {doc.kind === 'film' ? (
        <FilmAnalysisView doc={doc} displayInfo={displayInfo} onParam={setParam} />
      ) : (
        <PaperAnalysisView doc={doc} onParam={setParam} />
      )}
    </div>
  );
}

/** Анализ плёнки: параметры, метки кривых, зоны. */
function FilmAnalysisView({
  doc,
  displayInfo,
  onParam,
}: {
  doc: FilmDocument;
  displayInfo: boolean;
  onParam: <K extends keyof AnalysisParams>(key: K, value: AnalysisParams[K]) => void;
}) {
  const [selected, setSelected] = useState(0);
  const view = useSyncExternalStore(subscribeViewSettings, getViewSettings, getViewSettings);
  const analysis = analyzeFilm(doc.curves, doc.stepTablet, doc.analysisParams, doc.family.filmIso);
  const selectedCurve = analysis.curves[selected];

  const subject = selectedCurve
    ? subjectZones(
        buildSamples(selectedCurve.curve, doc.stepTablet),
        selectedCurve.speedPointLogE ?? 0,
        selectedCurve.sbrLog ?? 0,
      )
    : [];

  const plot = useMemo(() => {
    const base = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams, {
      smooth: view.smoothCurves,
    });
    if (!selectedCurve) return base;
    return {
      ...base,
      zones: filmGraphZones(
        selectedCurve.curve,
        doc.stepTablet,
        doc.analysisParams,
        selectedCurve.speedPointLogE,
        selectedCurve.sbrLog,
      ),
    };
  }, [doc.curves, doc.stepTablet, doc.analysisParams, selectedCurve, view.smoothCurves]);

  const dashed: DashedSeries[] = [];
  const markers: ChartMarker[] = [];
  const curveLabels: CurveLabel[] = [];
  // Продление пунктиром и пометка о нём — только для выбранной кривой и только
  // когда её градиент слишком мал для выбранного ES (spec: curve-analysis /
  // «Curve extension for low gradient»).
  let extended = false;
  if (selectedCurve) {
    const samples = buildSamples(selectedCurve.curve, doc.stepTablet);
    if (selectedCurve.lowGradient) {
      const target = samples.length > 0 ? samples[samples.length - 1].density + 1 : 1;
      const extension = extendForLowGradient(samples, target);
      if (extension.length > 0) {
        extended = true;
        dashed.push({
          key: 'family-extension',
          points: extension.map((p) => ({ x: p.logE, y: p.density })),
        });
      }
    }
    if (selectedCurve.speedPointLogE !== undefined && displayInfo) {
      markers.push({
        key: 'family-speed-point',
        x: selectedCurve.speedPointLogE,
        y: 0,
        label: t('familyChart.speedPoint'),
      });
    }
    if (selectedCurve.efs !== undefined) {
      curveLabels.push({
        key: 'family-curve-label',
        x: samples.length > 0 ? samples[samples.length - 1].logE : 0,
        y: samples.length > 0 ? samples[samples.length - 1].density : 0,
        text: fmt(selectedCurve.efs),
      });
    }
  }

  return (
    <div className="analyze-film" data-testid="analyze-film">
      <div className="analyze-params">
        <label className="analyze-field">
          <span>{t('analyze.method')}</span>
          <select
            data-testid="analyze-method"
            value={doc.analysisParams.method}
            onChange={(e) => onParam('method', e.target.value as AnalysisParams['method'])}
          >
            <option value={AnalysisMethod.ApproximateCI}>{t('analysis.approximateCi')}</option>
            <option value={AnalysisMethod.OverFbF}>{t('analysis.overFbF')}</option>
          </select>
        </label>
        <NumberField
          testId="analyze-es"
          label={t('analysis.es')}
          className="analyze-field"
          value={doc.analysisParams.es}
          onChange={(v) => onParam('es', v)}
        />
        <NumberField
          testId="analyze-flare"
          label={t('charts.flareDensity')}
          className="analyze-field"
          value={doc.analysisParams.flareDensity}
          onChange={(v) => onParam('flareDensity', v)}
        />
        <NumberField
          testId="analyze-expadj"
          label={t('charts.expAdj')}
          className="analyze-field"
          value={doc.analysisParams.expAdj}
          onChange={(v) => onParam('expAdj', v)}
        />
      </div>

      {displayInfo && (
        <p className="analyze-info" data-testid="analyze-constructions">
          {`${t('analyze.speedPoint')}: ${fmt(referenceSpeedPoint(analysis))}`}
        </p>
      )}

      {analysis.curves.length === 0 ? (
        <p data-testid="analyze-empty">{t('analyze.noCurves')}</p>
      ) : (
        <>
          <CurvePicker
            doc={doc}
            selected={selected}
            onSelect={setSelected}
            kind="film"
          />
          <div className="analyze-graph" data-testid="analyze-film-graph">
            <FamilyChart
              plot={plot}
              xTitle={t('familyChart.axis.logE')}
              yTitle={t('familyChart.axis.density')}
              showGrid={view.displayGrid}
              colorCurves={view.colorCurves}
              ariaLabel={t('familyChart.title')}
              testId="analyze-film-chart"
              dashed={dashed}
              markers={markers}
              curveLabels={curveLabels}
              highlightIndex={selected}
            />
          </div>
          <table className="analyze-table" data-testid="film-analysis-table">
            <thead>
              <tr>
                <th>{t('data.curve')}</th>
                <th>{t('analyze.efs')}</th>
                <th>{t('analyze.gBar')}</th>
                <th>{t('analyze.sbr')}</th>
                <th>{t('analyze.speedPoint')}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.curves.map((curve, i) => (
                <tr key={i} data-testid={`film-analysis-row-${i}`}>
                  <td>{curve.curve.label || `${t('data.curve')} ${i + 1}`}</td>
                  <td>{fmt(curve.efs)}</td>
                  <td>{fmt(curve.gBar)}</td>
                  <td>{fmt(curve.sbrStops)}</td>
                  <td>{fmt(curve.speedPoint)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {extended && (
            <p className="analyze-warning" data-testid="low-gradient-note">
              {t('analyze.lowGradient')}
            </p>
          )}

          <AbbrLegend items={FILM_LEGEND} />

          <ZoneTable
            title={t('matcher.zones.subject')}
            rows={subject.map((z) => ({ zone: z.zone, density: z.density }))}
            testId="analyze-subject-zones"
          />
          <ZoneTable
            title={t('matcher.zones.negative')}
            rows={negativeDensityZones(subject)}
            testId="analyze-negative-zones"
          />
        </>
      )}
    </div>
  );
}

/** Анализ бумаги: параметры, метки кривых, построения, зоны печати. */
function PaperAnalysisView({
  doc,
  onParam,
}: {
  doc: PaperDocument;
  onParam: <K extends keyof AnalysisParams>(key: K, value: AnalysisParams[K]) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [hoverZone, setHoverZone] = useState<number | null>(null);
  const view = useSyncExternalStore(subscribeViewSettings, getViewSettings, getViewSettings);
  const analysis = analyzePaper(doc.curves, doc.stepTablet, doc.analysisParams);
  const selectedCurve = analysis[selected];
  const printZones =
    selectedCurve && selectedCurve.idMinLogE !== undefined && selectedCurve.idMaxLogE !== undefined
      ? printZoneBounds(
          buildSamples(selectedCurve.curve, doc.stepTablet),
          selectedCurve.idMinLogE,
          selectedCurve.idMaxLogE,
        )
      : [];

  const plot = useMemo(() => {
    const base = buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams, {
      smooth: view.smoothCurves,
    });
    if (!selectedCurve) return base;
    return {
      ...base,
      zones: paperGraphZones(
        selectedCurve.curve,
        doc.stepTablet,
        doc.analysisParams,
        selectedCurve.idMinLogE,
        selectedCurve.idMaxLogE,
      ),
    };
  }, [doc.curves, doc.stepTablet, doc.analysisParams, selectedCurve, view.smoothCurves]);

  const horizontalGuides = selectedCurve
    ? [
        ...(selectedCurve.idMin !== undefined
          ? [{ y: selectedCurve.idMin, label: t('analyze.idMin') }]
          : []),
        ...(selectedCurve.idMax !== undefined
          ? [{ y: selectedCurve.idMax, label: t('analyze.idMax') }]
          : []),
        { y: PAPER_SPEED_DENSITY, label: t('familyChart.speedLine') },
      ]
    : [];

  return (
    <div className="analyze-paper" data-testid="analyze-paper">
      <div className="analyze-params">
        <NumberField
          testId="analyze-idmin-percent"
          label={t('analysis.idminPercent')}
          className="analyze-field"
          value={doc.analysisParams.idminPercent}
          onChange={(v) => onParam('idminPercent', v)}
        />
      </div>

      {isNonStandardIdmax(doc.analysisParams.idminPercent) && (
        <p className="analyze-warning" role="status" data-testid="analyze-nonstandard">
          {t('analyze.nonStandard')}
        </p>
      )}

      {analysis.length === 0 ? (
        <p data-testid="analyze-empty">{t('analyze.noCurves')}</p>
      ) : (
        <>
          <CurvePicker doc={doc} selected={selected} onSelect={setSelected} kind="paper" />
          <div className="analyze-graph" data-testid="analyze-paper-graph">
            <FamilyChart
              plot={plot}
              xTitle={t('familyChart.axis.logE')}
              yTitle={t('familyChart.axis.density')}
              showGrid={view.displayGrid}
              colorCurves={view.colorCurves}
              ariaLabel={t('familyChart.title')}
              testId="analyze-paper-chart"
              horizontalGuides={horizontalGuides}
              highlightIndex={selected}
            />
          </div>
          <table className="analyze-table" data-testid="paper-analysis-table">
            <thead>
              <tr>
                <th>{t('data.curve')}</th>
                <th>{t('analyze.idMin')}</th>
                <th>{t('analyze.idMax')}</th>
                <th>{t('analyze.dr')}</th>
                <th>{t('analysis.es')}</th>
                <th>{t('analyze.isoRange')}</th>
                <th>{t('analyze.grade')}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.map((curve, i) => (
                <tr key={i} data-testid={`paper-analysis-row-${i}`}>
                  <td>{curve.curve.label || `${t('data.curve')} ${i + 1}`}</td>
                  <td>{fmt(curve.idMin)}</td>
                  <td>{fmt(curve.idMax)}</td>
                  <td>{fmt(curve.dr)}</td>
                  <td>{fmt(curve.es)}</td>
                  <td>{curve.isoRange ?? '—'}</td>
                  <td>{curve.grade ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <AbbrLegend items={PAPER_LEGEND} />

          {selectedCurve && (
            <p className="analyze-info" data-testid="paper-relative-speed">
              {`${t('analyze.relativeSpeed')} (D=${formatNumber(PAPER_SPEED_DENSITY, 1)}): ${fmt(
                selectedCurve.speed,
              )}`}
            </p>
          )}

          <ZoneTable
            title={t('matcher.zones.print')}
            rows={printZones.map((z) => ({
              zone: z.zone,
              density: z.median,
              low: z.low,
              high: z.high,
              median: z.median,
            }))}
            hovered={hoverZone}
            onHover={setHoverZone}
            testId="analyze-print-zones"
          />
          {hoverZone !== null && (
            <p className="analyze-info" data-testid="print-zone-popup">
              {(() => {
                const zone = printZones.find((z) => z.zone === hoverZone);
                if (!zone) return '';
                return `${t('matcher.zones.zone')} ${zone.zone}: ${t('matcher.zones.low')} ${fmt(
                  zone.low,
                )}, ${t('matcher.zones.high')} ${fmt(zone.high)}, ${t('matcher.zones.median')} ${fmt(
                  zone.median,
                )}`;
              })()}
            </p>
          )}
          <p className="analyze-hint">{t('analyze.zoneHoverHint')}</p>
        </>
      )}
    </div>
  );
}

/** Список кривых с выбором. */
function CurvePicker({
  doc,
  selected,
  onSelect,
  kind,
}: {
  doc: FilmDocument | PaperDocument;
  selected: number;
  onSelect: (index: number) => void;
  kind: 'film' | 'paper';
}) {
  return (
    <ul
      className="analyze-curves"
      role="listbox"
      aria-label={t('analyze.selectedCurve')}
      data-testid={`analyze-curves-${kind}`}
    >
      {doc.curves.map((curve, i) => (
        <li key={i}>
          <button
            type="button"
            role="option"
            aria-selected={selected === i}
            className={selected === i ? 'curve-item selected' : 'curve-item'}
            data-testid={`analyze-curve-${i}`}
            onClick={() => onSelect(i)}
          >
            {curve.label || `${t('data.curve')} ${i + 1}`}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Таблица зон с опциональными границами и наведением. */
function ZoneTable({
  title,
  rows,
  testId,
  hovered,
  onHover,
}: {
  title: string;
  rows: { zone: number; density: number; low?: number; high?: number; median?: number }[];
  testId: string;
  hovered?: number | null;
  onHover?: (zone: number | null) => void;
}) {
  if (rows.length === 0) return null;
  const withBounds = rows[0].median !== undefined;
  return (
    <div className="analyze-zones" data-testid={testId}>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>{t('matcher.zones.zone')}</th>
            <th>{t('matcher.zones.density')}</th>
            {withBounds && <th>{t('matcher.zones.median')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((zone) => (
            <tr
              key={zone.zone}
              className={hovered === zone.zone ? 'zone-row hovered' : 'zone-row'}
              data-testid={`${testId}-row-${zone.zone}`}
              onMouseEnter={onHover ? () => onHover(zone.zone) : undefined}
              onMouseLeave={onHover ? () => onHover(null) : undefined}
            >
              <td>{zone.zone}</td>
              <td>{fmt(zone.density)}</td>
              {withBounds && <td>{fmt(zone.median)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Формат числа с двумя знаками (или «—»). */
function fmt(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '—' : formatNumber(value, 2);
}

/** Термины легенды для плёнки (термин + пояснение). */
const FILM_LEGEND: { term: MessageKey; desc: MessageKey }[] = [
  { term: 'analyze.efs', desc: 'analyze.legend.efs' },
  { term: 'analyze.gBar', desc: 'analyze.legend.gBar' },
  { term: 'analyze.sbr', desc: 'analyze.legend.sbr' },
  { term: 'analysis.es', desc: 'analyze.legend.es' },
  { term: 'analyze.dr', desc: 'analyze.legend.dr' },
  { term: 'analyze.speedPoint', desc: 'analyze.legend.speedPoint' },
];

/** Термины легенды для бумаги (термин + пояснение). */
const PAPER_LEGEND: { term: MessageKey; desc: MessageKey }[] = [
  { term: 'analyze.idMin', desc: 'analyze.legend.idMin' },
  { term: 'analyze.idMax', desc: 'analyze.legend.idMax' },
  { term: 'analyze.dr', desc: 'analyze.legend.dr' },
  { term: 'analysis.es', desc: 'analyze.legend.es' },
  { term: 'analyze.isoRange', desc: 'analyze.legend.isoRange' },
  { term: 'analyze.grade', desc: 'analyze.legend.grade' },
  { term: 'analyze.relativeSpeed', desc: 'analyze.legend.relativeSpeed' },
];

/**
 * Легенда, поясняющая сокращения в таблицах анализа (EFS, G-bar, SBR и др.).
 * Термины и их расшифровки берутся из каталога переводов, поэтому легенда
 * локализована на языке интерфейса.
 */
function AbbrLegend({ items }: { items: { term: MessageKey; desc: MessageKey }[] }) {
  return (
    <dl className="analyze-legend" data-testid="analyze-legend">
      {items.map((item) => (
        <div className="analyze-legend-item" key={item.term}>
          <dt>{t(item.term)}</dt>
          <dd>{t(item.desc)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Опорная точка скорости семейства, приведённая к шкале приложения. */
function referenceSpeedPoint(analysis: ReturnType<typeof analyzeFilm>): number | undefined {
  if (analysis.referenceSpeedPoint === undefined) return undefined;
  // Смещение шкалы приложения (см. `film.ts`): относительный logE → шкала.
  return analysis.referenceSpeedPoint + APP_LOG_E_OFFSET;
}
