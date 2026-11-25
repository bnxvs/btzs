import { useState } from 'react';
import { formatNumber, t } from '@/i18n';
import type { CurveDocument, StepTablet } from '@/core/model';
import { importStepTabletFromDocument } from '@/core/model';
import { openDocumentFile } from '@/ui/file-service';
import type { OpenedDocument } from '@/ui/file-service';
import {
  SAVED_TABLET_COUNT,
  loadSavedStepTablets,
  saveStepTablet,
} from '@/store';
import type { StepTabletSlot } from '@/store';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { Dialog } from '@/ui/components/Dialog';

/**
 * Диалог «Step Tablet» (spec: step-tablet / «Step tablet dialog»).
 *
 * Позволяет:
 *  - импортировать клин из другого файла Plotter (`.pfc`/`.ppc`);
 *  - выбрать один из двух сохранённых по умолчанию клиньев;
 *  - просмотреть значения обоих сохранённых клиньев;
 *  - сохранить текущий клин как клин #1/#2 (с подтверждением перезаписи).
 *
 * Файловые операции и доступ к сохранённым клиньям вынесены в `deps`, чтобы
 * тесты подменяли их без реальных диалогов и без `localStorage`.
 */
export interface StepTabletDialogDeps {
  /** Открывает файл, содержащий ступенчатый клин (`.pfc`/`.ppc`); `null` — отмена. */
  openStepTabletFile: () => Promise<OpenedDocument | null>;
  /** Читает два сохранённых клина (#1, #2). */
  loadSaved: () => [StepTablet, StepTablet];
  /** Сохраняет клин в указанный слот. */
  saveSaved: (slot: StepTabletSlot, tablet: StepTablet) => void;
}

/** Провайдеры по умолчанию: системный диалог и хранилище клиньев. */
export function defaultStepTabletDeps(): StepTabletDialogDeps {
  return {
    openStepTabletFile: () =>
      openDocumentFile({
        filters: [
          { label: 'Plotter Files', patterns: ['*.pfc', '*.ppc', '*.pmf'] },
          { label: 'All Files', patterns: ['*.*'] },
        ],
      }),
    loadSaved: loadSavedStepTablets,
    saveSaved: saveStepTablet,
  };
}

export interface StepTabletDialogProps {
  /** Текущий документ плёнки/бумаги. */
  doc: CurveDocument;
  /** Обновление документа (импорт или выбор сохранённого клина). */
  onDocChange: (doc: CurveDocument) => void;
  /** Закрытие диалога. */
  onClose: () => void;
  /** Провайдеры (подменяются в тестах). */
  deps?: StepTabletDialogDeps;
}

type Notice = { text: string; isError?: boolean };

export function StepTabletDialog({ doc, onDocChange, onClose, deps }: StepTabletDialogProps) {
  const backend = deps ?? defaultStepTabletDeps();
  const [saved, setSaved] = useState<[StepTablet, StepTablet]>(() => backend.loadSaved());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [viewing, setViewing] = useState<StepTabletSlot | null>(null);
  const [confirmSlot, setConfirmSlot] = useState<StepTabletSlot | null>(null);

  /** Импорт клина из файла Plotter (spec: «Импорт клина из файла»). */
  const importFromFile = async () => {
    setNotice(null);
    try {
      const opened = await backend.openStepTabletFile();
      if (!opened) return; // отмена — без сообщений
      const result = importStepTabletFromDocument(opened.doc);
      if (!result.ok) {
        setNotice({
          text: t(
            result.error === 'matcher' ? 'stepTablet.matcherHasNoTablet' : 'stepTablet.noTablet',
          ),
          isError: true,
        });
        return;
      }
      onDocChange({ ...doc, stepTablet: result.tablet });
      setNotice({ text: t('stepTablet.imported') });
    } catch (error) {
      setNotice({
        text: t(
          'stepTablet.importFailed',
          error instanceof Error ? error.message : String(error),
        ),
        isError: true,
      });
    }
  };

  /** Выбор сохранённого клина как активного (spec: «Использование сохранённого клина»). */
  const applySaved = (slot: StepTabletSlot) => {
    setNotice(null);
    onDocChange({ ...doc, stepTablet: { densities: [...saved[slot].densities] } });
  };

  /** Сохранение текущего клина как #1/#2 (spec: «Сохранение клина по умолчанию»). */
  const saveAs = (slot: StepTabletSlot) => {
    backend.saveSaved(slot, doc.stepTablet);
    setSaved(backend.loadSaved());
    setConfirmSlot(null);
    setNotice({ text: t('stepTablet.saved', slot + 1) });
  };

  return (
    <>
      <Dialog
        title={t('stepTablet.title')}
        onClose={onClose}
        data-testid="step-tablet-dialog"
        footer={
          <button type="button" onClick={onClose} data-testid="step-tablet-close">
            {t('common.close')}
          </button>
        }
      >
        <div className="step-tablet-actions">
          <button
            type="button"
            data-testid="step-tablet-import"
            onClick={importFromFile}
          >
            {t('stepTablet.import')}
          </button>
          {Array.from({ length: SAVED_TABLET_COUNT }, (_, i) => {
            const slot = i as StepTabletSlot;
            return (
              <div className="step-tablet-saved" key={slot}>
                <button
                  type="button"
                  data-testid={`step-tablet-use-${i}`}
                  onClick={() => applySaved(slot)}
                >
                  {t('stepTablet.useSaved', String(i + 1))}
                </button>
                <button
                  type="button"
                  data-testid={`step-tablet-view-${i}`}
                  onClick={() => setViewing(slot)}
                >
                  {t('stepTablet.view', String(i + 1))}
                </button>
                <button
                  type="button"
                  data-testid={`step-tablet-save-${i}`}
                  onClick={() => setConfirmSlot(slot)}
                >
                  {t('stepTablet.saveAs', String(i + 1))}
                </button>
              </div>
            );
          })}
        </div>

        {notice && (
          <p
            className={notice.isError ? 'dialog-error' : 'dialog-hint'}
            role={notice.isError ? 'alert' : 'status'}
            data-testid="step-tablet-message"
          >
            {notice.text}
          </p>
        )}

        <h3>{t('data.tablet')}</h3>
        <StepTabletTable
          tablet={viewing === null ? doc.stepTablet : saved[viewing]}
          testId="step-tablet-current"
        />
      </Dialog>

      {confirmSlot !== null && (
        <ConfirmDialog
          title={t('stepTablet.overwriteTitle')}
          message={t('stepTablet.overwriteConfirm', String(confirmSlot + 1))}
          confirmLabel={t('common.yes')}
          data-testid="step-tablet-overwrite"
          onConfirm={() => saveAs(confirmSlot)}
          onCancel={() => setConfirmSlot(null)}
        />
      )}
    </>
  );
}

/** Таблица значений клина (ступень → плотность). */
function StepTabletTable({ tablet, testId }: { tablet: StepTablet; testId: string }) {
  return (
    <table className="step-tablet-table" data-testid={testId}>
      <thead>
        <tr>
          <th>{t('stepTablet.legend.step')}</th>
          <th>{t('stepTablet.legend.density')}</th>
        </tr>
      </thead>
      <tbody>
        {tablet.densities.map((density, step) => (
          <tr key={step}>
            <td>{step + 1}</td>
            <td>{formatNumber(density, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
