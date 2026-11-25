import { useMemo, useSyncExternalStore, useState } from 'react';
import { formatNumber, t } from '@/i18n';
import type { CurveDocument, FilmDocument, PaperDocument } from '@/core/model';
import { buildFamilyPlot } from '@/core/analysis';
import { getViewSettings, setViewSettings, subscribeViewSettings } from '@/store';
import { FamilyChart } from '@/ui/charts/FamilyChart';
import { FamilyDetailsDialog } from './FamilyDetailsDialog';

/**
 * Вкладка Family: главный график семейства характеристических кривых и
 * параметры семейства с их редактированием через диалог Family Details.
 *
 * Spec (charts / «Family curve graph»): вкладка показывает семейство кривых
 * (плотность от относительного logE) с сеткой, сглаживанием и цветными кривыми
 * по сеансовым параметрам View. Spec (film-documents / «Film curve family
 * details»; paper-documents / «Paper document data entry and family details»):
 * поля плёнки — Date, Name, Film ISO, Developer, Dilution, Temperature, Volume,
 * Agitation, Notes; бумаги — Name, способ печати, проявитель, разведение,
 * температура, время проявления, тонер, сушка, примечания.
 */
export interface FamilyTabProps {
  doc: CurveDocument;
  onDocChange: (doc: CurveDocument) => void;
}

function filmRows(family: FilmDocument['family']): Array<[string, string]> {
  return [
    [t('family.date'), family.date],
    [t('family.name'), family.name],
    [t('family.filmIso'), String(family.filmIso)],
    [t('family.developer'), family.developer],
    [t('family.dilution'), family.dilution],
    [t('family.temperature'), `${formatNumber(family.temperature, 0)} ${family.temperatureUnit === 'F' ? '°F' : '°C'}`],
    [t('family.volume'), family.volume],
    [t('family.agitation'), family.agitation],
    [t('family.notes'), family.notes],
  ];
}

function paperRows(family: PaperDocument['family']): Array<[string, string]> {
  return [
    [t('family.date'), family.date],
    [t('family.name'), family.name],
    [
      t('familyPaper.printMethod'),
      family.printMethod === 'projection'
        ? t('familyPaper.projection')
        : t('familyPaper.contact'),
    ],
    [t('family.developer'), family.developer],
    [t('family.dilution'), family.dilution],
    [t('family.temperature'), `${formatNumber(family.temperature, 0)} ${family.temperatureUnit === 'F' ? '°F' : '°C'}`],
    [t('familyPaper.developingTime'), family.developingTime],
    [t('familyPaper.toner'), family.toner],
    [t('familyPaper.drying'), family.drying],
    [t('family.notes'), family.notes],
  ];
}

export function FamilyTab({ doc, onDocChange }: FamilyTabProps) {
  const [editing, setEditing] = useState(false);
  const view = useSyncExternalStore(subscribeViewSettings, getViewSettings, getViewSettings);
  const rows = doc.kind === 'film' ? filmRows(doc.family) : paperRows(doc.family);

  const plot = useMemo(
    () => buildFamilyPlot(doc.curves, doc.stepTablet, doc.analysisParams, { smooth: view.smoothCurves }),
    [doc.curves, doc.stepTablet, doc.analysisParams, view.smoothCurves],
  );

  return (
    <div className="family-tab" data-testid="family-tab">
      <h2>{t('family.title')}</h2>
      <div className="family-graph" data-testid="family-graph">
        <FamilyChart
          plot={plot}
          xTitle={t(view.xScale === 'lux' ? 'familyChart.axis.lux' : 'familyChart.axis.logE')}
          yTitle={t('familyChart.axis.density')}
          xScale={view.xScale}
          onXScaleChange={(scale) => setViewSettings({ xScale: scale })}
          showGrid={view.displayGrid}
          colorCurves={view.colorCurves}
          ariaLabel={t('familyChart.title')}
          testId="family-chart"
        />
        {!plot.hasData && (
          <p className="family-chart-empty" data-testid="family-chart-empty">
            {t('familyChart.empty')}
          </p>
        )}
      </div>
      <dl className="family-fields">
        {rows.map(([label, value]) => (
          <div className="family-row" key={label}>
            <dt>{label}</dt>
            <dd data-testid={`family-value-${label}`}>{value || '—'}</dd>
          </div>
        ))}
      </dl>
      <button type="button" data-testid="family-edit" onClick={() => setEditing(true)}>
        {t('family.edit')}
      </button>
      {editing && (
        <FamilyDetailsDialog
          kind={doc.kind}
          family={doc.family}
          onCancel={() => setEditing(false)}
          onSave={(family) => {
            if (doc.kind === 'film') {
              onDocChange({ ...doc, family: family as FilmDocument['family'] });
            } else {
              onDocChange({ ...doc, family: family as PaperDocument['family'] });
            }
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
