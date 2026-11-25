import { t } from '@/i18n';

/**
 * Строка состояния (spec: app-shell / «Command bar and status line»).
 *
 * Слева — имя активного документа с признаком несохранённых изменений, справа —
 * подсказка активной команды. Индикаторы режимов клавиатуры MFC
 * (EXT/CAP/NUM/SCRL/OVR/REC) намеренно не воспроизводятся.
 */
export interface StatusBarProps {
  /** Имя активного документа (пустая строка — нет открытых документов). */
  documentName?: string;
  /** Есть несохранённые изменения. */
  dirty?: boolean;
  /** Подсказка активной команды (пустая строка — нет подсказки). */
  hint?: string;
}

export function StatusBar({ documentName = '', dirty = false, hint = '' }: StatusBarProps) {
  return (
    <div className="status-bar" role="status" data-testid="status-bar">
      {documentName && (
        <span className="status-document" data-testid="status-document">
          {documentName}
          {dirty && (
            <span className="status-dirty" data-testid="status-dirty" title={t('shell.dirty')}>
              {' ●'}
            </span>
          )}
        </span>
      )}
      <span className="status-spacer" />
      <span className="status-hint" data-testid="status-hint">
        {hint}
      </span>
    </div>
  );
}
