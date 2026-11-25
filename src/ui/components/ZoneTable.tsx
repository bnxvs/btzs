import { formatNumber, t } from '@/i18n';
import type { MessageKey } from '@/i18n';

/**
 * Таблица зон (spec: curve-analysis / «Zone analysis»).
 *
 * Одна таблица показывает зоны 2..8 с двух сторон: плотность (негатива либо
 * печати) и относительную экспозицию (logE). Раньше «зоны сюжета» и «зоны
 * плотности негатива» были двумя таблицами с одними и теми же числами — это
 * одни и те же зоны, только по разным осям (см. `app/film_tab.htm`: зоны сюжета
 * равномерны по экспозиции снизу, зоны плотности негатива задаются контуром
 * кривой справа).
 */

/** Строка таблицы зон: номер, интервал плотности и интервал экспозиции. */
export interface ZoneRow {
  /** Номер зоны (2..8). */
  zone: number;
  /** Нижняя граница плотности. */
  low?: number;
  /** Верхняя граница плотности. */
  high?: number;
  /** Медиана плотности (для подсказки при наведении). */
  median?: number;
  /** Одиночная плотность (когда диапазон не задан, например эталонные зоны). */
  density?: number;
  /** Левая граница зоны по относительной экспозиции (logE). */
  x0?: number;
  /** Правая граница зоны по относительной экспозиции (logE). */
  x1?: number;
}

export interface ZoneTableProps {
  /** Заголовок таблицы. */
  title: string;
  /** Строки зон. */
  rows: readonly ZoneRow[];
  /** Идентификатор для тестов. */
  testId: string;
  /** Подпись столбца плотности (по умолчанию «Плотность»). */
  densityLabel?: MessageKey;
  /** Показывать столбец медианы плотности (зоны печати). */
  showMedian?: boolean;
  /** Подсвеченная зона. */
  hovered?: number | null;
  /** Наведение на строку зоны. */
  onHover?: (zone: number | null) => void;
}

/** Форматирует значение (или «—»). */
function fmt(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '—' : formatNumber(value, 2);
}

/** Интервал «низ – верх» либо одиночное значение. */
function span(low?: number, high?: number, single?: number): string {
  if (low !== undefined && high !== undefined) return `${fmt(low)} – ${fmt(high)}`;
  return fmt(single);
}

export function ZoneTable({
  title,
  rows,
  testId,
  densityLabel = 'matcher.zones.density',
  showMedian = false,
  hovered,
  onHover,
}: ZoneTableProps) {
  if (rows.length === 0) return null;
  const hasExposure = rows.some((r) => r.x0 !== undefined && r.x1 !== undefined);
  return (
    <div className="zone-table" data-testid={testId}>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>{t('matcher.zones.zone')}</th>
            <th>{t(densityLabel)}</th>
            {showMedian && <th>{t('matcher.zones.median')}</th>}
            {hasExposure && <th>{t('matcher.zones.exposure')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.zone}
              className={hovered === row.zone ? 'zone-row hovered' : 'zone-row'}
              data-testid={`${testId}-row-${row.zone}`}
              onMouseEnter={onHover ? () => onHover(row.zone) : undefined}
              onMouseLeave={onHover ? () => onHover(null) : undefined}
            >
              <td>{row.zone}</td>
              <td>{span(row.low, row.high, row.density)}</td>
              {showMedian && <td>{fmt(row.median)}</td>}
              {hasExposure && <td>{span(row.x0, row.x1)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
