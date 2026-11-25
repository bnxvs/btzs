import { config } from './config';

/**
 * `ui` — компоненты окон, вкладок, меню, панелей и диалогов, а также вкладка
 * графиков. Здесь только опорная точка для проверки структуры пакетов.
 */
export const UI_MODULE = 'ui';
export { config as uiConfig };
export { ChartsTab } from './charts/ChartsTab';
export type { ChartsTabProps } from './charts/ChartsTab';
export { MatcherTab } from './matcher/MatcherTab';
export type { MatcherTabProps } from './matcher/MatcherTab';
export { createMatcherViaDialogs, defaultMatcherCreateDeps } from './matcher/create-matcher';
export type {
  MatcherCreateDeps,
  MatcherCreateResult,
} from './matcher/create-matcher';
export { StepTabletDialog, defaultStepTabletDeps } from './documents/StepTabletDialog';
export type {
  StepTabletDialogDeps,
  StepTabletDialogProps,
} from './documents/StepTabletDialog';
export { AnalyzeTab } from './documents/AnalyzeTab';
export type { AnalyzeTabProps } from './documents/AnalyzeTab';
export { PrintCurvesDialog } from './print/PrintCurvesDialog';
export type { PrintCurvesDialogProps } from './print/PrintCurvesDialog';
export { PrintPreview } from './print/PrintPreview';
export type { PrintPreviewProps } from './print/PrintPreview';
export { PrintPageContent } from './print/PrintPageContent';
export type { PrintPageContentProps } from './print/PrintPageContent';
export {
  buildPrintJob,
  getPrintBackend,
  printDocument,
  setPrintBackend,
} from './print/print-service';
export type { PrintBackend } from './print/print-service';
export { PRINT_ROOT_ID, mountPrintRoot } from './print/print-root';
export {
  applyPrintScope,
  documentCharts,
  layoutPrintPages,
  printPages,
} from './print/print-layout';
export type { PrintJob, PrintJobPage, PrintPage } from './print/print-layout';
export { OptionsDialog } from './options/OptionsDialog';
export type { OptionsDialogProps } from './options/OptionsDialog';
export { MenuBar } from './shell/MenuBar';
export type { MenuBarProps } from './shell/MenuBar';
export { buildMenu, menuLabel } from './shell/menu';
export type { Menu, MenuCommand, MenuItem, MenuState } from './shell/menu';
export { CommandBar, APP_COMMANDS, DOCUMENT_COMMANDS, FILE_COMMANDS, OUTPUT_COMMANDS } from './shell/CommandBar';
export type { CommandButton } from './shell/CommandBar';
export { Icon } from './shell/icons';
export type { IconName } from './shell/icons';
export { StatusBar } from './shell/StatusBar';
export type { StatusBarProps } from './shell/StatusBar';
export { DocumentTabs } from './shell/DocumentTabs';
export type { DocumentTabsProps } from './shell/DocumentTabs';
export { AboutDialog } from './shell/AboutDialog';
export type { AboutDialogProps } from './shell/AboutDialog';
export { DocumentWindow } from './shell/DocumentWindow';
export type { DocumentWindowProps } from './shell/DocumentWindow';
export { Shell } from './shell/Shell';
export type { ShellDeps, ShellDialog } from './shell/Shell';
export { HelpDialog } from './shell/HelpDialog';
export type { HelpDialogProps } from './shell/HelpDialog';
export { ClosePromptDialog } from './shell/ClosePromptDialog';
export type { ClosePromptDialogProps } from './shell/ClosePromptDialog';
export {
  copyChartToClipboard,
  getClipboardBackend,
  serializeSvg,
  setClipboardBackend,
} from './shell/graph-clipboard';
export type { ClipboardBackend } from './shell/graph-clipboard';
