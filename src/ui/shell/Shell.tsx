import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { t } from '@/i18n';
import type { MessageKey } from '@/i18n';
import type { CurveDocument, FilmDocument, PaperDocument, PlotterDocument } from '@/core/model';
import { PRODUCT } from '@/core/model';
import {
  clearRecentFiles,
  closeDocument,
  createNewFilm,
  createNewPaper,
  getActiveDocument,
  getPrintSettings,
  getShellState,
  getViewSettings,
  markSaved,
  openDocument,
  setActiveDocument,
  setActiveTab,
  subscribeShell,
  subscribeViewSettings,
  toggleViewSetting,
  updateDocument,
} from '@/store';
import type { OpenDocument } from '@/store';
import { createMatcherViaDialogs, defaultMatcherCreateDeps } from '@/ui/matcher/create-matcher';
import type { MatcherCreateReason } from '@/ui/matcher/create-matcher';
import { openDocumentFile, saveDocumentFile } from '@/ui/file-service';
import type { FileBackend, OpenedDocument } from '@/ui/file-service';
import { OptionsDialog } from '@/ui/options/OptionsDialog';
import { StepTabletDialog } from '@/ui/documents/StepTabletDialog';
import { PrintCurvesDialog } from '@/ui/print/PrintCurvesDialog';
import { PrintPreview } from '@/ui/print/PrintPreview';
import { MenuBar } from './MenuBar';
import {
  APP_COMMANDS,
  CommandBar,
  DOCUMENT_COMMANDS,
  FILE_COMMANDS,
  OUTPUT_COMMANDS,
} from './CommandBar';
import { StatusBar } from './StatusBar';
import { DocumentTabs } from './DocumentTabs';
import { DocumentWindow } from './DocumentWindow';
import { AboutDialog } from './AboutDialog';
import { HelpDialog } from './HelpDialog';
import { ClosePromptDialog } from './ClosePromptDialog';
import type { MenuCommand } from './menu';

/**
 * Оболочка приложения (spec: app-shell).
 *
 * Современная оболочка: панель приложения (меню), иконочная панель команд,
 * полоса вкладок открытых документов, содержимое активного документа и строка
 * состояния. Выполняет команды меню и обслуживает горячие клавиши, список
 * последних файлов, справку, «О программе» и запрос сохранения при закрытии
 * документа с несохранёнными изменениями.
 *
 * Файловые операции вынесены в `ShellDeps`, чтобы тесты подменяли диалоги и не
 * зависели от системы.
 */
export interface ShellDeps {
  /** Открыть файл через диалог. */
  openFile?: () => Promise<OpenedDocument | null>;
  /** Сохранить документ через диалог; `null` — отмена. */
  saveFile?: (doc: PlotterDocument) => Promise<string | null>;
  /** Создать документ Matcher через диалоги плёнки и бумаги. */
  createMatcher?: () => ReturnType<typeof createMatcherViaDialogs>;
  /** Открыть внешний адрес (сайт BTZS.org). */
  openExternal?: (url: string) => void;
  /** Файловый бэкенд для диалогов (прокидывается в Matcher). */
  fileBackend?: FileBackend;
  /** Начальное состояние встроенного диалога (для тестов). */
  initialDialog?: ShellDialog;
}

/** Встроенный диалог оболочки. */
export type ShellDialog =
  | null
  | { kind: 'about' }
  | { kind: 'help' }
  | { kind: 'options' }
  | { kind: 'step-tablet'; id: string }
  | { kind: 'print-curves'; id: string }
  | { kind: 'print-preview'; id: string };

export function Shell({ deps = {} }: { deps?: ShellDeps }) {
  const state = useSyncExternalStore(subscribeShell, getShellState, getShellState);
  const view = useSyncExternalStore(subscribeViewSettings, getViewSettings, getViewSettings);
  const [hint, setHint] = useState('');
  const [dialog, setDialog] = useState<ShellDialog>(deps.initialDialog ?? null);
  const [closing, setClosing] = useState<string | null>(null);

  const active = getActiveDocument();

  const menuState = useMemo(
    () => ({
      smoothCurves: view.smoothCurves,
      colorCurves: view.colorCurves,
      displayGrid: view.displayGrid,
      recentFiles: state.recentFiles,
      kind: active?.doc.kind ?? null,
    }),
    [state.recentFiles, active, view.smoothCurves, view.colorCurves, view.displayGrid],
  );

  const commandGroups = useMemo(() => {
    const groups: (readonly typeof FILE_COMMANDS[number][])[] = [FILE_COMMANDS];
    const kind = active?.doc.kind ?? null;
    if (kind !== null && kind !== 'matcher') groups.push(DOCUMENT_COMMANDS);
    if (kind === 'film' || kind === 'paper') groups.push(OUTPUT_COMMANDS);
    groups.push(APP_COMMANDS);
    return groups;
  }, [active]);

  const byId = (id: string): OpenDocument | null =>
    state.documents.find((entry) => entry.id === id) ?? null;

  const save = async (entry: OpenDocument): Promise<string | null> => {
    try {
      const saver =
        deps.saveFile ??
        ((doc: PlotterDocument) => saveDocumentFile(doc, { backend: deps.fileBackend }));
      const path = await saver(entry.doc);
      if (path === null) return null;
      markSaved(entry.id, path);
      return path;
    } catch (error) {
      setHint(t('shell.closeSaveFailed', error instanceof Error ? error.message : String(error)));
      return null;
    }
  };

  const requestClose = (id: string) => {
    const entry = byId(id);
    if (!entry) return;
    if (entry.dirty) setClosing(id);
    else closeDocument(id);
  };

  /** Сообщение строки состояния для причины отказа создания Matcher. */
  const matcherFailure: Record<MatcherCreateReason, MessageKey> = {
    cancelled: 'matcher.createCancelled',
    'wrong-film': 'matcher.wrongKindFilm',
    'wrong-paper': 'matcher.wrongKindPaper',
  };

  /**
   * Выполняет команду меню, сообщая о сбое в строке состояния вместо
   * молчаливого проглатывания ошибки.
   */
  const runCommand = async (command: MenuCommand): Promise<void> => {
    try {
      await dispatch(command);
    } catch (error) {
      setHint(t('shell.commandFailed', error instanceof Error ? error.message : String(error)));
    }
  };

  const dispatch = async (command: MenuCommand): Promise<void> => {
    switch (command) {
      case 'new-film':
        openDocument(createNewFilm());
        return;
      case 'new-paper':
        openDocument(createNewPaper());
        return;
      case 'new-matcher': {
        const create =
          deps.createMatcher ??
          (() => createMatcherViaDialogs(defaultMatcherCreateDeps(deps.fileBackend)));
        const result = await create();
        if (result.ok) openDocument(result.doc, '');
        else setHint(t(matcherFailure[result.reason]));
        return;
      }
      case 'open': {
        try {
          const open = deps.openFile ?? (() => openDocumentFile({ backend: deps.fileBackend }));
          const opened = await open();
          if (opened) openDocument(opened.doc, opened.path);
        } catch (error) {
          setHint(t('shell.openFailed', error instanceof Error ? error.message : String(error)));
        }
        return;
      }
      case 'close':
        if (active) requestClose(active.id);
        return;
      case 'save':
        if (active) await save(active);
        return;
      case 'save-as':
        if (active) await save(active);
        return;
      case 'step-tablet':
        if (active && active.doc.kind !== 'matcher') setDialog({ kind: 'step-tablet', id: active.id });
        return;
      case 'print':
        if (active && active.doc.kind !== 'matcher') setDialog({ kind: 'print-curves', id: active.id });
        return;
      case 'print-preview':
        if (active && active.doc.kind !== 'matcher') setDialog({ kind: 'print-preview', id: active.id });
        return;
      case 'options':
        setDialog({ kind: 'options' });
        return;
      case 'about':
        setDialog({ kind: 'about' });
        return;
      case 'help-topics':
        setDialog({ kind: 'help' });
        return;
      case 'btzs-website': {
        const open = deps.openExternal ?? ((url: string) => window.open(url, '_blank', 'noopener'));
        open(PRODUCT.website);
        return;
      }
      case 'clear-recent':
        clearRecentFiles();
        return;
      case 'smooth-curves':
        toggleViewSetting('smoothCurves');
        return;
      case 'color-curves':
        toggleViewSetting('colorCurves');
        return;
      case 'display-grid':
        toggleViewSetting('displayGrid');
        return;
      default:
        // Остальные пункты обрабатываются внутри вкладок (Edit/Match).
        return;
    }
  };

  // Горячие клавиши (ACCELERATOR): Ctrl+F/N/M/O/S/P/T, F1.
  // Обработчик берёт актуальную команду из ref, чтобы не переподписываться.
  const runCommandRef = useRef(runCommand);
  runCommandRef.current = runCommand;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      let command: MenuCommand | null = null;
      if (mod && key === 'f') command = 'new-film';
      else if (mod && key === 'n') command = 'new-paper';
      else if (mod && key === 'm') command = 'new-matcher';
      else if (mod && key === 'o') command = 'open';
      else if (mod && key === 's') command = 'save';
      else if (mod && key === 'p') command = 'print';
      else if (mod && key === 't') command = 'step-tablet';
      else if (key === 'f1') command = 'help-topics';
      if (command) {
        event.preventDefault();
        void runCommandRef.current(command);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const activeDoc = active?.doc ?? null;
  const curveDoc =
    activeDoc && activeDoc.kind !== 'matcher' ? (activeDoc as CurveDocument) : null;
  const printDoc =
    activeDoc && activeDoc.kind !== 'matcher' ? (activeDoc as FilmDocument | PaperDocument) : null;
  const closingEntry = closing ? byId(closing) : null;
  const closingName = closingEntry
    ? closingEntry.doc.kind === 'matcher'
      ? t('matcher.title')
      : (closingEntry.doc as CurveDocument).family.name || t('shell.untitled')
    : '';

  return (
    <div className="app-shell" data-testid="app-shell">
      <MenuBar state={menuState} onCommand={(command) => void runCommand(command)} onHint={setHint} />

      <CommandBar
        groups={commandGroups}
        label={t('shell.commandBar')}
        onCommand={(command) => void runCommand(command)}
        onHint={setHint}
      />

      {state.documents.length > 0 && (
        <DocumentTabs
          documents={state.documents}
          activeId={state.activeId}
          onSelect={setActiveDocument}
          onClose={requestClose}
        />
      )}

      <main className="document-area" data-testid="document-area">
        {active === null ? (
          <p className="no-documents" data-testid="no-documents">
            {t('shell.noDocuments')}
          </p>
        ) : (
          <DocumentWindow
            key={active.id}
            entry={active}
            onDocChange={(doc) => updateDocument(active.id, doc)}
            onTabChange={(tab) => setActiveTab(active.id, tab)}
          />
        )}
      </main>

      <StatusBar documentName={active ? active.doc.kind === 'matcher' ? t('matcher.title') : (active.doc as CurveDocument).family.name || t('shell.untitled') : ''} dirty={active?.dirty ?? false} hint={hint} />

      {dialog?.kind === 'about' && <AboutDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'options' && <OptionsDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'step-tablet' && curveDoc && byId(dialog.id) && (
        <StepTabletDialog
          doc={curveDoc}
          onDocChange={(doc) => updateDocument(dialog.id, doc)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'print-curves' && printDoc && (
        <PrintCurvesDialog
          doc={printDoc}
          onClose={() => setDialog(null)}
          onPrinted={() => setDialog({ kind: 'print-preview', id: dialog.id })}
        />
      )}
      {dialog?.kind === 'print-preview' && printDoc && (
        <PrintPreview doc={printDoc} settings={getPrintSettings()} onClose={() => setDialog(null)} />
      )}

      {closingEntry && (
        <ClosePromptDialog
          name={closingName}
          onSave={async () => {
            const path = await save(closingEntry);
            if (path !== null) {
              closeDocument(closingEntry.id);
              setClosing(null);
            }
          }}
          onDiscard={() => {
            closeDocument(closingEntry.id);
            setClosing(null);
          }}
          onCancel={() => setClosing(null)}
        />
      )}
    </div>
  );
}
