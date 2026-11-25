import { t } from '@/i18n';
import type { MessageKey } from '@/i18n';
import type { FilmDocument, MatcherDocument, PaperDocument } from '@/core/model';
import { FamilyTab } from '@/ui/documents/FamilyTab';
import { DataTab } from '@/ui/documents/DataTab';
import { AnalyzeTab } from '@/ui/documents/AnalyzeTab';
import { ChartsTab } from '@/ui/charts/ChartsTab';
import { MatcherTab } from '@/ui/matcher/MatcherTab';
import type { OpenDocument } from '@/store';

/**
 * Содержимое активного документа (spec: app-shell / «Document tabs»).
 *
 * Набор вкладок зависит от типа документа: `Family`/`Data`/`Analyze`/`Charts`
 * для плёнки и бумаги, `Info`/`Film`/`Paper`/`Compare` для Matcher. Активная
 * вкладка хранится в реестре оболочки; изменение документа возвращается наверх
 * через `onDocChange`. Для Matcher полоса вкладок предоставляется самим
 * `MatcherTab` (он держит вкладки Info/Film/Paper/Compare), поэтому здесь просто
 * размещается его содержимое.
 */
export interface DocumentWindowProps {
  /** Активный документ. */
  entry: OpenDocument;
  /** Изменение документа. */
  onDocChange: (doc: OpenDocument['doc']) => void;
  /** Переключение вкладки. */
  onTabChange: (tab: string) => void;
}

/** Ключи подписей вкладок плёнки/бумаги и Matcher. */
const TAB_LABELS: Record<string, MessageKey> = {
  family: 'tab.family',
  data: 'tab.data',
  analyze: 'tab.analyze',
  charts: 'tab.charts',
  info: 'tab.info',
  film: 'tab.film',
  paper: 'tab.paper',
  compare: 'tab.compare',
};

export function DocumentWindow({ entry, onDocChange, onTabChange }: DocumentWindowProps) {
  const matcher = entry.doc.kind === 'matcher';
  const tabs = matcher ? ['info', 'film', 'paper', 'compare'] : ['family', 'data', 'analyze', 'charts'];
  const current = tabs.includes(entry.activeTab) ? entry.activeTab : tabs[0];

  return (
    <section
      className="document-window"
      data-testid={`document-window-${entry.id}`}
      data-kind={entry.doc.kind}
    >
      {matcher ? (
        <div className="document-body" data-testid={`document-body-${entry.id}`} data-tab="info">
          <MatcherTab doc={entry.doc as MatcherDocument} onDocChange={(next) => onDocChange(next)} />
        </div>
      ) : (
        <>
          <div className="document-tabs" role="tablist" data-testid={`document-tabs-${entry.id}`}>
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={tab === current}
                className={`document-tab${tab === current ? ' active' : ''}`}
                data-testid={`tab-${entry.id}-${tab}`}
                onClick={() => onTabChange(tab)}
              >
                {t(TAB_LABELS[tab] ?? 'tab.data')}
              </button>
            ))}
          </div>
          <div className="document-body" data-testid={`document-body-${entry.id}`} data-tab={current}>
            {renderCurveTab(entry.doc as FilmDocument | PaperDocument, current, onDocChange)}
          </div>
        </>
      )}
    </section>
  );
}

function renderCurveTab(
  doc: FilmDocument | PaperDocument,
  tab: string,
  onDocChange: (doc: OpenDocument['doc']) => void,
) {
  switch (tab) {
    case 'family':
      return <FamilyTab doc={doc} onDocChange={(next) => onDocChange(next)} />;
    case 'data':
      return <DataTab doc={doc} onDocChange={(next) => onDocChange(next)} />;
    case 'analyze':
      return <AnalyzeTab doc={doc} onDocChange={(next) => onDocChange(next)} />;
    case 'charts':
      return <ChartsTab doc={doc} onDocChange={(next) => onDocChange(next)} />;
    default:
      return null;
  }
}
