import { useMemo, useState, useSyncExternalStore } from 'react';
import { formatNumber, t } from '@/i18n';
import { MATCHER_TABS, ReferenceCurveType } from '@/core/model';
import type { MatcherTab as MatcherTabKey, MatcherDocument, SavedMatch } from '@/core/model';
import {
  analyzeMatcherFilm,
  analyzeMatcherPaper,
  buildComparisonPlot,
  buildFamilyPlot,
  checkReferences,
  filmGraphZones,
  loadMatchFromDocument,
  loadReferenceFromDocument,
  normalizeMatches,
  overrideAnalysisParams,
  paperGraphZones,
  removeSavedMatch,
  restoreFileDefaults,
  saveCurrentMatchForComparison,
  standardReferenceGrays,
} from '@/core/analysis';
import { getViewSettings, subscribeViewSettings } from '@/store';
import { FamilyChart } from '@/ui/charts/FamilyChart';
import { openDocumentFile, saveDocumentFile } from '@/ui/file-service';
import { Dialog, DialogButtons } from '@/ui/components/Dialog';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { NumberField } from '@/ui/components/NumberField';
import { ApproximatedCurvesDialog } from './ApproximatedCurvesDialog';

/**
 * Документ Matcher (spec: matcher).
 *
 * Вкладки Info, Film, Paper, Compare. Компонент контролируемый: получает
 * документ через `doc`, изменения возвращает через `onDocChange`.
 *
 * - Info — сведения о семействах плёнки и бумаги (только чтение) и пометка о
 *   переопределении параметров анализа;
 * - Film — выбор кривой плёнки, анализ (EFS/G-bar/SBR), зоны сюжета и зоны
 *   плотности негатива, управление приближёнными кривыми;
 * - Paper — выбор кривой бумаги, анализ (IDmin/IDmax/DR/ES/ISO-диапазон/носок),
 *   зоны плотности негатива, печати и эталонной кривой, «Lock Film DR=ES»,
 *   сохранение сопоставления для сравнения, эталонные кривые;
 * - Compare — сохранённые сопоставления для сравнения (до 15) с выбором и
 *   удалением.
 */
export interface MatcherTabProps {
  /** Документ Matcher. */
  doc: MatcherDocument;
  /** Обновление документа. */
  onDocChange: (doc: MatcherDocument) => void;
  /**
   * Времена изменения доступных исходных файлов (плёнка/бумага), если
   * приложение уже обратилось к файловой системе. Используются для запроса
   * перезагрузки обновлённых параметров анализа (задача 7.4).
   */
  referenceModifyTimes?: { film?: number; paper?: number };
}

type DialogState =
  | { kind: 'approx' }
  | { kind: 'delete-match'; index: number; name: string }
  | null;

export function MatcherTab({ doc, onDocChange, referenceModifyTimes }: MatcherTabProps) {
  const [tab, setTab] = useState<MatcherTabKey>('info');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  // Обновления исходных файлов, обнаруженные при загрузке (задача 7.4).
  const [pendingReload] = useState<{ film?: string; paper?: string } | undefined>(() =>
    initialReferenceNotice(doc, referenceModifyTimes),
  );
  const [showReload, setShowReload] = useState(() => Boolean(pendingReload));

  const update = (patch: Partial<MatcherDocument>) => onDocChange({ ...doc, ...patch });

  const saveMatch = () => {
    const result = saveCurrentMatchForComparison(doc);
    if (result.error === 'limit') {
      setMessage({ text: t('matcher.compare.limit'), isError: true });
      return;
    }
    if (result.error === 'no-match') {
      setMessage({ text: t('matcher.compare.noMatch'), isError: true });
      return;
    }
    onDocChange(result.doc);
    setMessage({ text: t('matcher.compare.loaded') });
  };

  const loadExternalMatch = async () => {
    const opened = await openDocumentFile();
    if (!opened) return;
    if (opened.doc.kind !== 'matcher') {
      setMessage({ text: t('matcher.compare.noMatch'), isError: true });
      return;
    }
    if (doc.savedMatches.length >= 15) {
      setMessage({ text: t('matcher.compare.limit'), isError: true });
      return;
    }
    const match = loadMatchFromDocument(opened.doc);
    if (!match) {
      setMessage({ text: t('matcher.compare.noMatch'), isError: true });
      return;
    }
    onDocChange({ ...doc, savedMatches: [...doc.savedMatches, match] });
    setMessage({ text: t('matcher.compare.loaded') });
  };

  const loadReferenceCurve = async () => {
    const opened = await openDocumentFile();
    if (!opened) return;
    if (opened.doc.kind !== 'matcher') {
      setMessage({ text: t('matcher.reference.noMatch'), isError: true });
      return;
    }
    const result = loadReferenceFromDocument(opened.doc);
    if (!result.ok) {
      setMessage({ text: t('matcher.reference.noMatch'), isError: true });
      return;
    }
    onDocChange({
      ...doc,
      referenceCurveType: ReferenceCurveType.Loaded,
      loadedReferenceCurve: result.curve,
    });
  };

  const saveFile = async () => {
    setSaving(true);
    try {
      await saveDocumentFile(doc);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="matcher-tab" data-testid="matcher-tab">
      <div className="tab-bar" role="tablist">
        {MATCHER_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'tab selected' : 'tab'}
            data-testid={`matcher-tab-${key}`}
            onClick={() => setTab(key)}
          >
            {tabLabel(key)}
          </button>
        ))}
      </div>

      {message && (
        <p
          className={message.isError ? 'matcher-message error' : 'matcher-message'}
          role={message.isError ? 'alert' : 'status'}
          data-testid="matcher-message"
        >
          {message.text}
        </p>
      )}

      {tab === 'info' && <InfoTab doc={doc} />}

      {tab === 'film' && (
        <FilmTab
          doc={doc}
          onSelectCurve={(index) => update({ selectedFilmCurve: index })}
          onManageApprox={() => setDialog({ kind: 'approx' })}
          onOverride={(patch) => onDocChange(overrideAnalysisParams(doc, patch))}
          onRestore={() => onDocChange(restoreFileDefaults(doc))}
        />
      )}

      {tab === 'paper' && (
        <PaperTab
          doc={doc}
          onSelectCurve={(index) => update({ selectedPaperCurve: index })}
          onLockChange={(locked) => update({ lockFilmDrToEs: locked })}
          onOverride={(patch) => onDocChange(overrideAnalysisParams(doc, patch))}
          onRestore={() => onDocChange(restoreFileDefaults(doc))}
          onSaveMatch={saveMatch}
          onLoadReference={loadReferenceCurve}
          onSetReference={(type) => update(setReference(type))}
        />
      )}

      {tab === 'compare' && (
        <CompareTab
          doc={doc}
          onRemove={(index) => onDocChange(removeSavedMatch(doc, index))}
          onLoadExternal={loadExternalMatch}
          onSaveCurrent={saveMatch}
        />
      )}

      <div className="matcher-footer">
        <button type="button" data-testid="matcher-save" disabled={saving} onClick={saveFile}>
          {t('common.save')}
        </button>
      </div>

      {dialog?.kind === 'approx' && doc.film && (
        <ApproximatedCurvesDialog
          film={doc.film}
          curves={doc.approximatedCurves}
          onAdd={(curve) =>
            update({ approximatedCurves: [...doc.approximatedCurves, curve] })
          }
          onRemove={(index) =>
            update({ approximatedCurves: doc.approximatedCurves.filter((_, i) => i !== index) })
          }
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'delete-match' && (
        <ConfirmDialog
          title={t('common.delete')}
          message={t('curves.deleteConfirm', dialog.name)}
          confirmLabel={t('common.delete')}
          onConfirm={() => {
            onDocChange(removeSavedMatch(doc, dialog.index));
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}

      {showReload && pendingReload && (
        <ReloadDialog
          notice={pendingReload}
          onReload={() => {
            onDocChange(restoreFileDefaults(doc));
            setShowReload(false);
          }}
          onDismiss={() => setShowReload(false)}
        />
      )}
    </div>
  );
}

/** Подпись вкладки Matcher по ключу. */
function tabLabel(key: MatcherTabKey): string {
  switch (key) {
    case 'info':
      return t('tab.info');
    case 'film':
      return t('tab.film');
    case 'paper':
      return t('tab.paper');
    default:
      return t('tab.compare');
  }
}

/** Применяет тип эталонной кривой (с обновлением серых при стандартной). */
function setReference(type: ReferenceCurveType): Partial<MatcherDocument> {
  if (type === ReferenceCurveType.Loaded) {
    return { referenceCurveType: type };
  }
  return { referenceCurveType: type, referenceCurveGrays: standardReferenceGrays(type) };
}

/**
 * Уведомление об обновлении исходных файлов (задача 7.4).
 *
 * Вызывается при загрузке документа с доступными исходными файлами: если файл
 * плёнки или бумаги новее, чем сохранённая дата изменения, приложение
 * предлагает перезагрузить параметры анализа.
 */
function initialReferenceNotice(
  doc: MatcherDocument,
  modifyTimes?: { film?: number; paper?: number },
): { film?: string; paper?: string } | undefined {
  if (!modifyTimes) return undefined;
  const { updated } = checkReferences(doc, modifyTimes);
  const notice: { film?: string; paper?: string } = {};
  if (updated.includes('film')) notice.film = doc.filmRef.name;
  if (updated.includes('paper')) notice.paper = doc.paperRef.name;
  return updated.length > 0 ? notice : undefined;
}

/** Диалог предложения перезагрузить обновлённые параметры анализа. */
function ReloadDialog({
  notice,
  onReload,
  onDismiss,
}: {
  notice: { film?: string; paper?: string };
  onReload: () => void;
  onDismiss: () => void;
}) {
  const key = notice.film ? 'matcher.updatedFilm' : 'matcher.updatedPaper';
  const name = notice.film ?? notice.paper ?? '';
  return (
    <Dialog
      title={t('common.confirm')}
      onClose={onDismiss}
      data-testid="matcher-reload-dialog"
      footer={
        <DialogButtons
          onOk={onReload}
          onCancel={onDismiss}
          okLabel={t('common.yes')}
          cancelLabel={t('common.no')}
        />
      }
    >
      <p>{t(key, name)}</p>
    </Dialog>
  );
}

/** Вкладка Info: сведения о семействах (только чтение) и пометка переопределения. */
function InfoTab({ doc }: { doc: MatcherDocument }) {
  const overridden = doc.analysisOverridden;
  return (
    <div className="matcher-info" data-testid="matcher-info">
      <h2>{t('matcher.info.filmFamily')}</h2>
      <dl className="family-fields">
        <FamilyRow label={t('family.name')} value={doc.film?.family.name} />
        <FamilyRow label={t('family.developer')} value={doc.film?.family.developer} />
        <FamilyRow label={t('family.filmIso')} value={doc.film && String(doc.film.family.filmIso)} />
      </dl>
      {overridden && (
        <p className="matcher-override" role="status" data-testid="matcher-override-note">
          {t('matcher.info.overridden')}
        </p>
      )}

      <h2>{t('matcher.info.paperFamily')}</h2>
      <dl className="family-fields">
        <FamilyRow label={t('family.name')} value={doc.paper?.family.name} />
        <FamilyRow label={t('family.developer')} value={doc.paper?.family.developer} />
        <FamilyRow label={t('familyPaper.printMethod')} value={doc.paper?.family.printMethod} />
      </dl>

      <h2>{t('matcher.reference.title')}</h2>
      <p data-testid="matcher-reference-name">{referenceName(doc)}</p>
    </div>
  );
}

/** Строка сведений семейства. */
function FamilyRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="family-row">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

/** Отображаемое имя текущей эталонной кривой. */
function referenceName(doc: MatcherDocument): string {
  switch (doc.referenceCurveType) {
    case ReferenceCurveType.Flared:
      return t('matcher.reference.flared');
    case ReferenceCurveType.Loaded:
      return doc.loadedReferenceCurve?.label || t('matcher.reference.loaded');
    default:
      return t('matcher.reference.default');
  }
}

/** Вкладка Film: выбор кривой, анализ, зоны, приближённые кривые. */
function FilmTab({
  doc,
  onSelectCurve,
  onManageApprox,
  onOverride,
  onRestore,
}: {
  doc: MatcherDocument;
  onSelectCurve: (index: number) => void;
  onManageApprox: () => void;
  onOverride: (patch: { es?: number }) => void;
  onRestore: () => void;
}) {
  const analysis = analyzeMatcherFilm(doc);
  const selected = analysis[doc.selectedFilmCurve];
  const view = useSyncExternalStore(subscribeViewSettings, getViewSettings, getViewSettings);
  const film = doc.film;
  const plot = useMemo(() => {
    const base = buildFamilyPlot(
      film?.curves ?? [],
      film?.stepTablet ?? { densities: [] },
      doc.analysisParams,
      { smooth: view.smoothCurves },
    );
    if (!film || !selected) return base;
    // Зоны сюжета и плотности негатива — как на вкладке Analyze документа плёнки.
    return {
      ...base,
      zones: filmGraphZones(
        selected.curve,
        film.stepTablet,
        doc.analysisParams,
        selected.speedPointLogE,
        selected.sbrLog,
      ),
    };
  }, [film, doc.analysisParams, selected, view.smoothCurves]);
  return (
    <div className="matcher-film" data-testid="matcher-film">
      <CurveList
        id="film"
        curves={(doc.film?.curves ?? []).map((c) => c.label)}
        selected={doc.selectedFilmCurve}
        onSelect={onSelectCurve}
      />
      <div className="matcher-graph" data-testid="matcher-film-graph">
        <FamilyChart
          plot={plot}
          xTitle={t('familyChart.axis.logE')}
          yTitle={t('familyChart.axis.density')}
          showGrid={view.displayGrid}
          colorCurves={view.colorCurves}
          ariaLabel={t('matcher.film.chart')}
          testId="matcher-film-chart"
        />
      </div>
      {selected && (
        <div className="matcher-analysis" data-testid="matcher-film-analysis">
          <p>{`EFS: ${fmt(selected.efs)}`}</p>
          <p>{`G-bar: ${fmt(selected.gBar)}`}</p>
          <p>{`SBR: ${fmt(selected.sbrStops)}`}</p>
        </div>
      )}
      <ZoneTable title={t('matcher.zones.subject')} zones={subjectZoneRows(selected)} testId="subject-zones" />
      <ZoneTable
        title={t('matcher.zones.negative')}
        zones={negativeZoneRows(selected)}
        testId="film-negative-zones"
      />
      <div className="matcher-actions">
        <button type="button" data-testid="manage-approx" onClick={onManageApprox}>
          {t('matcher.approx.manage')}
        </button>
        <ParameterFields doc={doc} onOverride={onOverride} />
        <button type="button" data-testid="restore-defaults" onClick={onRestore}>
          {t('matcher.restoreDefaults')}
        </button>
      </div>
    </div>
  );
}

/** Вкладка Paper: выбор кривой, анализ, зоны, Lock DR=ES, сопоставление, эталон. */
function PaperTab({
  doc,
  onSelectCurve,
  onLockChange,
  onOverride,
  onRestore,
  onSaveMatch,
  onLoadReference,
  onSetReference,
}: {
  doc: MatcherDocument;
  onSelectCurve: (index: number) => void;
  onLockChange: (locked: boolean) => void;
  onOverride: (patch: { es?: number }) => void;
  onRestore: () => void;
  onSaveMatch: () => void;
  onLoadReference: () => void;
  onSetReference: (type: ReferenceCurveType) => void;
}) {
  const analysis = analyzeMatcherPaper(doc);
  const selected = analysis[doc.selectedPaperCurve];
  const view = useSyncExternalStore(subscribeViewSettings, getViewSettings, getViewSettings);
  const paper = doc.paper;
  // Зоны плотности негатива на вкладке Paper определяются выбранной кривой
  // плёнки (spec: matcher / «Вкладка Paper»).
  const filmCurve = analyzeMatcherFilm(doc)[doc.selectedFilmCurve];
  const plot = useMemo(() => {
    const base = buildFamilyPlot(
      paper?.curves ?? [],
      paper?.stepTablet ?? { densities: [] },
      doc.analysisParams,
      { smooth: view.smoothCurves },
    );
    if (!paper || !selected) return base;
    // Зоны печати — как на вкладке Analyze документа бумаги.
    return {
      ...base,
      zones: paperGraphZones(
        selected.curve,
        paper.stepTablet,
        doc.analysisParams,
        selected.idMinLogE,
        selected.idMaxLogE,
      ),
    };
  }, [paper, doc.analysisParams, selected, view.smoothCurves]);
  return (
    <div className="matcher-paper" data-testid="matcher-paper">
      <CurveList
        id="paper"
        curves={(doc.paper?.curves ?? []).map((c) => c.label)}
        selected={doc.selectedPaperCurve}
        onSelect={onSelectCurve}
      />
      <div className="matcher-graph" data-testid="matcher-paper-graph">
        <FamilyChart
          plot={plot}
          xTitle={t('familyChart.axis.logE')}
          yTitle={t('familyChart.axis.density')}
          showGrid={view.displayGrid}
          colorCurves={view.colorCurves}
          ariaLabel={t('matcher.paper.chart')}
          testId="matcher-paper-chart"
        />
      </div>
      {selected && (
        <div className="matcher-analysis" data-testid="matcher-paper-analysis">
          <p>{`IDmin: ${fmt(selected.idMin)}`}</p>
          <p>{`IDmax: ${fmt(selected.idMax)}`}</p>
          <p>{`DR: ${fmt(selected.dr)}`}</p>
          <p>{`ES: ${fmt(selected.es)}`}</p>
          <p>{`ISO Range: ${selected.isoRange ?? '—'}`}</p>
          <p data-testid="paper-toe">{`Toe: ${selected.toe ?? '—'}`}</p>
        </div>
      )}

      <label className="matcher-lock">
        <input
          type="checkbox"
          data-testid="lock-dr-es"
          checked={doc.lockFilmDrToEs}
          onChange={(e) => onLockChange(e.target.checked)}
        />
        <span>{t('matcher.lockDrToEs')}</span>
      </label>
      <p className="matcher-hint">{t('matcher.lockDrToEsHint')}</p>

      <ZoneTable
        title={t('matcher.zones.negative')}
        zones={negativeZoneRows(filmCurve)}
        testId="paper-negative-zones"
      />
      <ZoneTable
        title={t('matcher.zones.print')}
        zones={printZoneRows(selected)}
        testId="paper-print-zones"
      />
      <ZoneTable
        title={t('matcher.zones.reference')}
        zones={referenceZoneRows(doc)}
        testId="paper-reference-zones"
      />

      <div className="matcher-actions">
        <button type="button" data-testid="save-match" onClick={onSaveMatch}>
          {t('matcher.compare.save')}
        </button>
        <button
          type="button"
          data-testid="use-default-reference"
          onClick={() => onSetReference(ReferenceCurveType.Default)}
        >
          {t('matcher.reference.default')}
        </button>
        <button
          type="button"
          data-testid="use-flared-reference"
          onClick={() => onSetReference(ReferenceCurveType.Flared)}
        >
          {t('matcher.reference.flared')}
        </button>
        <button type="button" data-testid="load-reference" onClick={onLoadReference}>
          {t('matcher.reference.load')}
        </button>
        <button
          type="button"
          data-testid="use-loaded-reference"
          disabled={!doc.loadedReferenceCurve}
          onClick={() => onSetReference(ReferenceCurveType.Loaded)}
        >
          {t('matcher.reference.useLoaded')}
        </button>
        <ParameterFields doc={doc} onOverride={onOverride} />
        <button type="button" data-testid="restore-defaults" onClick={onRestore}>
          {t('matcher.restoreDefaults')}
        </button>
      </div>
    </div>
  );
}

/** Поля параметров анализа (ES, Flare, Exp. Adj., IDmax %). */
function ParameterFields({
  doc,
  onOverride,
}: {
  doc: MatcherDocument;
  onOverride: (patch: { es?: number }) => void;
}) {
  const params = doc.analysisParams;
  return (
    <div className="matcher-params" data-testid="matcher-params">
      <NumberField
        testId="matcher-es"
        label={t('analysis.es')}
        className="matcher-param"
        value={params.es}
        onChange={(v) => onOverride({ es: v })}
      />
      <p className="matcher-param-readonly">
        {`${t('charts.flareDensity')}: ${fmt(params.flareDensity)}`}
      </p>
      <p className="matcher-param-readonly">{`${t('charts.expAdj')}: ${fmt(params.expAdj)}`}</p>
      <p className="matcher-param-readonly">
        {`${t('analysis.idminPercent')}: ${fmt(params.idminPercent)}`}
      </p>
    </div>
  );
}

/** Вкладка Compare: сохранённые сопоставления (до 15). */
function CompareTab({
  doc,
  onRemove,
  onLoadExternal,
  onSaveCurrent,
}: {
  doc: MatcherDocument;
  onRemove: (index: number) => void;
  onLoadExternal: () => void;
  onSaveCurrent: () => void;
}) {
  const normalized = normalizeMatches(doc.savedMatches);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const view = useSyncExternalStore(subscribeViewSettings, getViewSettings, getViewSettings);
  // Отображаются только отмеченные сопоставления (spec: matcher / «Вкладка
  // Compare»). По умолчанию, если ничего не отмечено, показываются все.
  const anyChecked = normalized.some((_, i) => checked[i]);
  const shown = normalized.filter((_, i) => (anyChecked ? checked[i] : true));
  const plot = useMemo(() => buildComparisonPlot(shown), [shown]);
  return (
    <div className="matcher-compare" data-testid="matcher-compare">
      <div className="matcher-actions">
        <button type="button" data-testid="compare-save-current" onClick={onSaveCurrent}>
          {t('matcher.compare.save')}
        </button>
        <button type="button" data-testid="compare-load" onClick={onLoadExternal}>
          {t('matcher.compare.load')}
        </button>
      </div>
      {normalized.length === 0 ? (
        <p data-testid="compare-empty">{t('matcher.compare.empty')}</p>
      ) : (
        <>
          <div className="matcher-graph" data-testid="matcher-compare-graph">
            <FamilyChart
              plot={plot}
              xTitle={t('matcher.compare.axis.zone')}
              yTitle={t('familyChart.axis.density')}
              showGrid={view.displayGrid}
              colorCurves={view.colorCurves}
              ariaLabel={t('matcher.compare.chart')}
              testId="matcher-compare-chart"
            />
          </div>
          <table className="compare-table" data-testid="compare-table">
            <thead>
              <tr>
                <th>{t('matcher.compare.show')}</th>
                <th>{t('matcher.compare.name')}</th>
                <th>{t('matcher.compare.film')}</th>
                <th>{t('matcher.compare.paper')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {normalized.map((match, i) => (
                <CompareRow
                  key={`${match.name}-${i}`}
                  match={match}
                  index={i}
                  checked={checked[i] ?? false}
                  onCheck={(value) => setChecked((prev) => ({ ...prev, [i]: value }))}
                  onRemove={() => onRemove(i)}
                />
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="matcher-hint">{`${doc.savedMatches.length} / ${15}`}</p>
    </div>
  );
}

/** Строка таблицы сравнения сопоставлений. */
function CompareRow({
  match,
  index,
  checked,
  onCheck,
  onRemove,
}: {
  match: SavedMatch;
  index: number;
  checked: boolean;
  onCheck: (value: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <tr data-testid={`compare-row-${index}`}>
      <td>
        <input
          type="checkbox"
          data-testid={`compare-show-${index}`}
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
        />
      </td>
      <td>
        {match.clipped ? `${match.name} (${t('matcher.compare.clipped')})` : match.name}
      </td>
      <td>{match.filmLabel}</td>
      <td>{match.paperLabel}</td>
      <td>
        <button type="button" data-testid={`compare-remove-${index}`} onClick={onRemove}>
          {t('matcher.compare.remove')}
        </button>
      </td>
    </tr>
  );
}

/** Список кривых с выбором. */
function CurveList({
  id,
  curves,
  selected,
  onSelect,
}: {
  id: string;
  curves: readonly string[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  if (curves.length === 0) return <p data-testid={`${id}-no-curves`}>{t('matcher.noCurves')}</p>;
  return (
    <ul className="matcher-curves" role="listbox" aria-label={t('matcher.curves')} data-testid={`matcher-curves-${id}`}>
      {curves.map((label, i) => (
        <li key={`${label}-${i}`}>
          <button
            type="button"
            role="option"
            aria-selected={selected === i}
            className={selected === i ? 'curve-item selected' : 'curve-item'}
            data-testid={`${id}-curve-${i}`}
            onClick={() => onSelect(i)}
          >
            {label || `${t('data.curve')} ${i + 1}`}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Таблица зон (номер + плотность). */
function ZoneTable({
  title,
  zones,
  testId,
}: {
  title: string;
  zones: { zone: number; density: number; low?: number; high?: number; median?: number }[];
  testId: string;
}) {
  return (
    <div className="matcher-zones" data-testid={testId}>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>{t('matcher.zones.zone')}</th>
            <th>{t('matcher.zones.density')}</th>
            {zones[0]?.median !== undefined && <th>{t('matcher.zones.median')}</th>}
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => (
            <tr key={zone.zone}>
              <td>{zone.zone}</td>
              <td>{fmt(zone.density)}</td>
              {zone.median !== undefined && <td>{fmt(zone.median)}</td>}
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

/** Строки зон сюжета (по результату анализа плёнки). */
function subjectZoneRows(curve: ReturnType<typeof analyzeMatcherFilm>[number] | undefined) {
  if (!curve || curve.speedPointLogE === undefined || curve.sbrLog === undefined) return [];
  return Array.from({ length: 7 }, (_, i) => ({
    zone: i + 2,
    density: curve.speedPointLogE! + (i / 6) * curve.sbrLog!,
  }));
}

/** Строки зон плотности негатива (по результату анализа плёнки). */
function negativeZoneRows(curve: ReturnType<typeof analyzeMatcherFilm>[number] | undefined) {
  if (!curve || curve.speedPointLogE === undefined || curve.sbrLog === undefined) return [];
  return Array.from({ length: 7 }, (_, i) => ({
    zone: i + 2,
    density: curve.speedPointLogE! + (i / 6) * curve.sbrLog!,
  }));
}

/** Строки зон печати (по результату анализа бумаги). */
function printZoneRows(curve: ReturnType<typeof analyzeMatcherPaper>[number] | undefined) {
  if (!curve || curve.idMin === undefined || curve.dr === undefined) return [];
  return Array.from({ length: 7 }, (_, i) => ({
    zone: i + 2,
    density: curve.idMin! + (i / 6) * curve.dr!,
    median: curve.idMin! + ((i + 0.5) / 6) * curve.dr!,
  }));
}

/** Строки эталонных зон (по эталонным серым эталонной кривой). */
function referenceZoneRows(doc: MatcherDocument) {
  const grays = doc.referenceCurveType === ReferenceCurveType.Loaded && doc.loadedReferenceCurve
    ? doc.loadedReferenceCurve.points.map((p) => p.density)
    : doc.referenceCurveGrays.length >= 9
      ? doc.referenceCurveGrays.slice(1, 9)
      : [];
  if (grays.length === 0) return [];
  return grays.map((density, i) => ({ zone: i + 2, density }));
}

export { InfoTab, FilmTab, PaperTab, CompareTab };
