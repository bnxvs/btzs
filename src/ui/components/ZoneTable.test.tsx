/**
 * Тесты таблицы зон (ZoneTable).
 *
 * Проверяется, что одна таблица показывает зоны с двух сторон: интервал
 * плотности (или одиночное значение) и — при наличии — интервал экспозиции
 * logE, плюс опциональный столбец медианы.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n';
import { ZoneTable } from './ZoneTable';

beforeEach(() => setLocale('ru'));
afterEach(() => setLocale('ru'));

describe('ZoneTable', () => {
  it('показывает диапазон плотности и экспозицию для зон', () => {
    render(
      <ZoneTable
        title="Зоны"
        testId="zones"
        rows={[
          { zone: 2, low: 0.1, high: 0.2, median: 0.15, x0: -1, x1: -0.8 },
          { zone: 3, low: 0.3, high: 0.4, median: 0.35, x0: -0.8, x1: -0.6 },
        ]}
      />,
    );
    expect(screen.getByText('Плотность')).toBeInTheDocument();
    expect(screen.getByText('Экспозиция, logE')).toBeInTheDocument();
    expect(screen.getByTestId('zones-row-2')).toHaveTextContent('0,10 – 0,20');
    expect(screen.getByTestId('zones-row-2')).toHaveTextContent('-1,00 – -0,80');
  });

  it('без экспозиции столбец logE не появляется (эталонные зоны)', () => {
    render(
      <ZoneTable
        title="Эталон"
        testId="ref"
        rows={[
          { zone: 2, density: 0.12 },
          { zone: 3, density: 0.25 },
        ]}
      />,
    );
    expect(screen.getByTestId('ref-row-2')).toHaveTextContent('0,12');
    expect(screen.queryByText('Экспозиция, logE')).not.toBeInTheDocument();
  });

  it('столбец медианы — только при showMedian', () => {
    const { rerender } = render(
      <ZoneTable title="Зоны" testId="z" rows={[{ zone: 2, low: 0.1, high: 0.2, median: 0.15 }]} />,
    );
    expect(screen.queryByText('Медиана')).not.toBeInTheDocument();
    rerender(
      <ZoneTable
        title="Зоны"
        testId="z"
        showMedian
        rows={[{ zone: 2, low: 0.1, high: 0.2, median: 0.15 }]}
      />,
    );
    expect(screen.getByText('Медиана')).toBeInTheDocument();
  });

  it('наведение на строку сообщает номер зоны', () => {
    const onHover = vi.fn();
    render(
      <ZoneTable
        title="Зоны"
        testId="z"
        rows={[{ zone: 5, low: 0.4, high: 0.5, median: 0.45 }]}
        onHover={onHover}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId('z-row-5'));
    expect(onHover).toHaveBeenCalledWith(5);
    fireEvent.mouseLeave(screen.getByTestId('z-row-5'));
    expect(onHover).toHaveBeenCalledWith(null);
  });

  it('без строк таблица не отображается', () => {
    render(<ZoneTable title="Зоны" testId="z" rows={[]} />);
    expect(screen.queryByTestId('z')).not.toBeInTheDocument();
  });
});
