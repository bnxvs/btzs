import { t } from '@/i18n';
import { documentTitle } from '@/store';
import type { OpenDocument } from '@/store';

/**
 * Полоса вкладок открытых документов (spec: app-shell / «Tabbed document
 * shell»). Каждый открытый документ — вкладка; активная выделена, у изменённых
 * показана точка, у каждой — кнопка закрытия.
 */
export interface DocumentTabsProps {
  /** Открытые документы. */
  documents: readonly OpenDocument[];
  /** Идентификатор активной вкладки. */
  activeId: string | null;
  /** Переключение вкладки. */
  onSelect: (id: string) => void;
  /** Закрытие вкладки (с запросом сохранения при изменениях). */
  onClose: (id: string) => void;
}

export function DocumentTabs({ documents, activeId, onSelect, onClose }: DocumentTabsProps) {
  return (
    <div
      className="document-tabstrip"
      role="tablist"
      aria-label={t('shell.documentTabs')}
      data-testid="document-tabstrip"
    >
      {documents.map((entry) => {
        const active = entry.id === activeId;
        const title = documentTitle(entry, t('shell.untitled'));
        return (
          <div
            key={entry.id}
            className={`doc-tab${active ? ' active' : ''}`}
            data-testid={`doc-tab-${entry.id}`}
            data-active={active ? 'true' : 'false'}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="doc-tab-title"
              data-testid={`doc-tab-title-${entry.id}`}
              onClick={() => onSelect(entry.id)}
            >
              {entry.dirty && (
                <span className="doc-tab-dirty" data-testid={`doc-tab-dirty-${entry.id}`} aria-hidden="true">
                  ●
                </span>
              )}
              <span className="doc-tab-label">{title}</span>
            </button>
            <button
              type="button"
              className="doc-tab-close"
              title={t('shell.closeTab')}
              aria-label={t('shell.closeTab')}
              data-testid={`doc-tab-close-${entry.id}`}
              onClick={() => onClose(entry.id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
