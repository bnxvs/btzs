import { useRef, useState } from 'react';
import { formatNumber, parseNumber, t } from '@/i18n';
import {
  STEP_COUNT,
  appendCurve,
  filledDensities,
  removeCurve,
  importCurves,
} from '@/core/model';
import type { Curve, CurveDocument } from '@/core/model';
import { openDocumentFile } from '@/ui/file-service';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { CurveDetailsDialog } from './CurveDetailsDialog';
import { ArrangeCurvesDialog } from './ArrangeCurvesDialog';

/**
 * Вкладка Data документа плёнки/бумаги.
 *
 * Таблица (spec: film-documents / «Film document data entry»):
 *  - первый столбец — номера ступеней клина;
 *  - второй — плотности активного ступенчатого клина (редактируемые);
 *  - далее по столбцу на каждую кривую.
 *
 * Ввод плотностей: Enter или стрелка вниз переходят к следующей ступени
 * того же столбца. F2 на ячейке запоминает её, Ctrl+Enter распространяет
 * значение на все ступени ниже («Автозаполнение нижних ступеней»).
 *
 * Автозаполнение старших ступеней: пока пользователь работает в столбце,
 * его верхние поля остаются пустыми (на графике их заполняет
 * `filledDensities`); при выборе другого столбца заполнение материализуется
 * в документе (spec: «поля остаются пустыми до выбора другого столбца»).
 */
export interface DataTabProps {
  /** Документ плёнки или бумаги. */
  doc: CurveDocument;
  /** Обновление документа (любое изменение). */
  onDocChange: (doc: CurveDocument) => void;
}

type DialogState =
  | { kind: 'curve-details'; curve: Curve; index: number | undefined }
  | { kind: 'arrange' }
  | { kind: 'delete'; index: number; label: string }
  | null;

export function DataTab({ doc, onDocChange }: DataTabProps) {
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const fillAnchor = useRef<{ column: string; step: number } | null>(null);

  const stepCount = doc.stepTablet.densities.length || STEP_COUNT;
  const tablet = doc.stepTablet.densities;
  const cellId = (column: string, step: number) => `${column}-${step}`;
  // Последний столбец, в котором был фокус (для автозаполнения верхних
  // ступеней при выборе другого столбца).
  const lastColumn = useRef<string | null>(null);

  const focusCell = (column: string, step: number) => {
    document.getElementById(`cell-${cellId(column, step)}`)?.focus();
  };

  /** Сброс черновика ячейки: при потере фокуса значение показывается
   * отформатированным (по активной локали). */
  const clearDraft = (column: string, step: number) => {
    setDrafts((prev) => {
      const id = cellId(column, step);
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const startCurveDetails = () => {
    const size = doc.rawHeader.marker === 104 ? 20 : 4;
    setDialog({
      kind: 'curve-details',
      curve: {
        label: '',
        note: '',
        points: [],
        reserved: Array.from({ length: size }, () => 0),
        dontConnectInChart: false,
      },
      index: undefined,
    });
  };

  const commitCell = (column: string, step: number, raw: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      const id = cellId(column, step);
      if (raw === '') delete next[id];
      else next[id] = raw;
      return next;
    });
    if (column === 'tablet') {
      const value = parseNumber(raw);
      if (Number.isNaN(value)) return;
      const densities = [...tablet];
      densities[step] = value;
      onDocChange({ ...doc, stepTablet: { densities } });
      return;
    }
    const curveIndex = Number(column.slice(1));
    const curve = doc.curves[curveIndex];
    if (!curve) return;
    const value = parseNumber(raw);
    let points: Curve['points'];
    if (raw.trim() === '') {
      // Пустое поле удаляет точку кривой (степень снова «не введена»).
      points = curve.points.filter((p) => p.step !== step);
    } else if (Number.isNaN(value)) {
      // Пока вводится неполное число («-», «1e») — не обновляем документ.
      return;
    } else if (curve.points.some((p) => p.step === step)) {
      points = curve.points.map((p) => (p.step === step ? { ...p, density: value } : p));
    } else {
      points = [...curve.points, { step, density: value }].sort((a, b) => a.step - b.step);
    }
    const curves = [...doc.curves];
    curves[curveIndex] = { ...curve, points };
    onDocChange({ ...doc, curves });
  };

  /** Заполнение столбца вниз от якоря (F2, затем Ctrl+Enter). */
  const fillDown = (column: string) => {
    const anchor = fillAnchor.current;
    if (!anchor || anchor.column !== column) return;
    if (column === 'tablet') {
      const value = tablet[anchor.step];
      const densities = tablet.map((d, step) => (step >= anchor.step ? value : d));
      onDocChange({ ...doc, stepTablet: { densities } });
      return;
    }
    const curveIndex = Number(column.slice(1));
    const curve = doc.curves[curveIndex];
    if (!curve) return;
    const value = filledDensities(curve.points, stepCount)[anchor.step];
    if (value === undefined) return;
    const existing = new Map(curve.points.map((p) => [p.step, p.density]));
    const points: Curve['points'] = [];
    for (let step = 0; step < stepCount; step++) {
      const density = step >= anchor.step ? value : existing.get(step);
      if (density !== undefined) points.push({ step, density });
    }
    const curves = [...doc.curves];
    curves[curveIndex] = { ...curve, points };
    onDocChange({ ...doc, curves });
    // Черновики заполненных ячеек устарели — очищаем их.
    setDrafts((prev) => {
      const next = { ...prev };
      for (let step = anchor.step; step < stepCount; step++) delete next[cellId(column, step)];
      return next;
    });
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    column: string,
    step: number,
  ) => {
    if (event.key === 'F2') {
      fillAnchor.current = { column, step };
      return;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      if (fillAnchor.current) {
        event.preventDefault();
        fillDown(column);
      }
      return;
    }
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      if (step + 1 < stepCount) {
        event.preventDefault();
        commitCell(column, step, event.currentTarget.value);
        focusCell(column, step + 1);
      }
      return;
    }
    if (event.key === 'ArrowUp' && step > 0) {
      event.preventDefault();
      commitCell(column, step, event.currentTarget.value);
      focusCell(column, step - 1);
    }
  };

  const cellValue = (column: string, step: number): string => {
    const draft = drafts[cellId(column, step)];
    if (draft !== undefined) return draft;
    if (column === 'tablet') return formatNumber(tablet[step] ?? 0, 2);
    // Столбец кривой показывает только введённые точки: верхние ступени
    // остаются пустыми до выбора другого столбца (см. fillTopSteps).
    const point = doc.curves[Number(column.slice(1))]?.points.find((p) => p.step === step);
    return point === undefined ? '' : formatNumber(point.density, 2);
  };

  /**
   * Материализация автозаполнения верхних ступеней при выборе другого столбца.
   *
   * Spec (film-documents / «Автозаполнение верхних ступеней»): поля верхних
   * ступеней остаются пустыми до выбора другого столбца — после перехода в
   * другой столбец старшие ступени получают первое введённое значение.
   */
  const fillTopSteps = (column: string) => {
    if (column === 'tablet') return;
    const curveIndex = Number(column.slice(1));
    const curve = doc.curves[curveIndex];
    if (!curve || curve.points.length === 0) return;
    let firstStep = Number.POSITIVE_INFINITY;
    for (const p of curve.points) if (p.step < firstStep) firstStep = p.step;
    if (!Number.isFinite(firstStep) || firstStep === 0) return;
    const firstValue = curve.points.find((p) => p.step === firstStep)?.density;
    if (firstValue === undefined) return;
    const present = new Set(curve.points.map((p) => p.step));
    const points = [...curve.points];
    for (let step = 0; step < firstStep; step++) {
      if (!present.has(step)) points.push({ step, density: firstValue });
    }
    points.sort((a, b) => a.step - b.step);
    const curves = [...doc.curves];
    curves[curveIndex] = { ...curve, points };
    onDocChange({ ...doc, curves });
  };

  /** Выбор другого столбца заполняет верхние ступени предыдущего. */
  const handleCellFocus = (column: string) => {
    const previous = lastColumn.current;
    lastColumn.current = column;
    if (previous === null || previous === column) return;
    fillTopSteps(previous);
  };

  const saveCurve = (fields: Pick<Curve, 'label' | 'note' | 'dontConnectInChart'>) => {
    if (dialog?.kind !== 'curve-details') return;
    setDialog(null);
    const curve: Curve = { ...dialog.curve, ...fields };
    if (dialog.index === undefined) {
      onDocChange(appendCurve(doc, curve));
    } else {
      const curves = [...doc.curves];
      curves[dialog.index] = curve;
      onDocChange({ ...doc, curves });
    }
    setSelected(dialog.index ?? doc.curves.length);
    setMessage(null);
  };

  const deleteCurve = (index: number) => {
    setDialog(null);
    const result = removeCurve(doc, index);
    if (result.removed) {
      onDocChange(result.doc);
      setSelected(undefined);
      setMessage({ text: t('curves.deleteTitle') + ': ' + result.removed.label });
    }
  };

  const importFrom = async () => {
    try {
      const opened = await openDocumentFile();
      if (!opened) return;
      if (opened.doc.kind === 'matcher') {
        setMessage({ text: t('curves.importFailed', opened.path), isError: true });
        return;
      }
      const result = importCurves(doc, opened.doc);
      if (!result.ok) {
        const key =
          result.error === 'wrong-kind'
            ? doc.kind === 'film'
              ? 'curves.importWrongKind'
              : 'curves.importWrongKindFilm'
            : 'curves.noCurves';
        setMessage({ text: t(key), isError: true });
        return;
      }
      onDocChange(result.doc);
      setMessage({ text: t('curves.imported', result.imported) });
    } catch (error) {
      setMessage({
        text: t('curves.importFailed', error instanceof Error ? error.message : String(error)),
        isError: true,
      });
    }
  };

  const curve = dialog?.kind === 'curve-details' && dialog.index !== undefined
    ? doc.curves[dialog.index]
    : undefined;

  return (
    <div className="data-tab" data-testid="data-tab">
      <div className="data-toolbar">
        <button type="button" data-testid="add-curve" onClick={startCurveDetails}>
          {t('data.addCurve')}
        </button>
        <button
          type="button"
          data-testid="delete-curve"
          onClick={() => {
            const index = selected ?? 0;
            const target = doc.curves[index];
            if (!target) {
              setMessage({ text: t('curves.noCurves'), isError: true });
              return;
            }
            setDialog({ kind: 'delete', index, label: target.label });
          }}
        >
          {t('common.delete')}
        </button>
        <button
          type="button"
          data-testid="arrange-curves"
          disabled={doc.curves.length < 2}
          onClick={() => setDialog({ kind: 'arrange' })}
        >
          {t('curves.arrange')}
        </button>
        <button type="button" data-testid="import-curves" onClick={importFrom}>
          {t('common.import')}
        </button>
        {doc.kind === 'paper' && (
          <label className="data-idmin">
            <span>{t('analysis.idminPercent')}</span>
            <input
              type="text"
              inputMode="decimal"
              data-testid="idmin-percent"
              value={formatNumber(doc.analysisParams.idminPercent, 0)}
              onChange={(e) => {
                const value = parseNumber(e.target.value);
                if (Number.isNaN(value)) return;
                onDocChange({
                  ...doc,
                  analysisParams: { ...doc.analysisParams, idminPercent: value },
                });
              }}
            />
          </label>
        )}
      </div>

      {message && (
        <p
          className={message.isError ? 'data-message error' : 'data-message'}
          role={message.isError ? 'alert' : 'status'}
          data-testid="data-message"
        >
          {message.text}
        </p>
      )}

      <table className="data-table" data-testid="data-table">
        <thead>
          <tr>
            <th>{t('data.step')}</th>
            <th>{t('data.tablet')}</th>
            {doc.curves.map((c, i) => (
              <th key={i}>
                <button
                  type="button"
                  className={selected === i ? 'curve-header selected' : 'curve-header'}
                  data-testid={`curve-header-${i}`}
                  onClick={() => setSelected(i)}
                  onDoubleClick={() =>
                    setDialog({ kind: 'curve-details', curve: c, index: i })
                  }
                >
                  {c.label || `${t('data.curve')} ${i + 1}`}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: stepCount }, (_, step) => (
            <tr key={step}>
              <td className="step-number">{step + 1}</td>
              <DensityCell
                column="tablet"
                step={step}
                value={cellValue('tablet', step)}
                onChange={(raw) => commitCell('tablet', step, raw)}
                onKeyDown={handleKeyDown}
                onFocus={handleCellFocus}
                onBlur={() => clearDraft('tablet', step)}
              />
              {doc.curves.map((_c, i) => {
                const column = `c${i}`;
                return (
                  <DensityCell
                    key={column}
                    column={column}
                    step={step}
                    value={cellValue(column, step)}
                    onChange={(raw) => commitCell(column, step, raw)}
                    onKeyDown={handleKeyDown}
                    onFocus={handleCellFocus}
                    onBlur={() => clearDraft(column, step)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="data-hint">{t('data.autofillTopHint')}</p>
      <p className="data-hint">{t('data.autofillDownHint')}</p>

      {dialog?.kind === 'curve-details' && (
        <CurveDetailsDialog
          kind={doc.kind}
          curve={curve ?? dialog.curve}
          onSave={saveCurve}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'arrange' && (
        <ArrangeCurvesDialog
          doc={doc}
          onReorder={(curves) => onDocChange({ ...doc, curves })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={t('curves.deleteTitle')}
          message={t('curves.deleteConfirm', dialog.label)}
          confirmLabel={t('common.delete')}
          onConfirm={() => deleteCurve(dialog.index)}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}

/** Ячейка ввода плотности. */
function DensityCell({
  column,
  step,
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
}: {
  column: string;
  step: number;
  value: string;
  onChange: (raw: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>, column: string, step: number) => void;
  onFocus: (column: string) => void;
  onBlur: () => void;
}) {
  return (
    <td>
      <input
        id={`cell-${column}-${step}`}
        type="text"
        inputMode="decimal"
        aria-label={`${column} ${step + 1}`}
        data-testid={`cell-${column}-${step}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => onKeyDown(e, column, step)}
        onFocus={() => onFocus(column)}
        onBlur={onBlur}
      />
    </td>
  );
}
