/**
 * Тесты числового поля (NumberField).
 *
 * Проверяется исправление: дробные значения вводятся посимвольно, а
 * десятичный разделитель не «съедается» контролируемым вводом.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { NumberField } from './NumberField';

function Harness({
  initial = 0,
  sink,
  fractionDigits,
}: {
  initial?: number;
  sink: { value: number };
  fractionDigits?: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <NumberField
      testId="field"
      label="значение"
      className="test-field"
      value={value}
      fractionDigits={fractionDigits}
      onChange={(v) => {
        sink.value = v;
        setValue(v);
      }}
    />
  );
}

describe('NumberField', () => {
  beforeEach(() => setLocale('ru'));
  afterEach(() => setLocale('ru'));

  it('позволяет ввести дробное значение посимвольно (0,015)', () => {
    const sink = { value: 0 };
    render(<Harness sink={sink} />);
    const input = screen.getByTestId('field') as HTMLInputElement;

    // Имитируем набор «0,015»: после каждого символа значение поля сохраняет
    // введённый текст, а разделитель не пропадает.
    for (const text of ['0', '0,', '0,0', '0,01', '0,015']) {
      fireEvent.change(input, { target: { value: text } });
      expect(input.value).toBe(text);
    }
    expect(sink.value).toBeCloseTo(0.015, 10);

    // По потере фокуса поле приводится к каноническому виду с полной точностью.
    fireEvent.blur(input);
    expect(input.value).toBe('0,015');
  });

  it('не коммитит неполное значение («0,» и «-»), но сохраняет черновик', () => {
    const sink = { value: 1 };
    render(<Harness initial={1} sink={sink} />);
    const input = screen.getByTestId('field') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '2,' } });
    expect(input.value).toBe('2,');
    expect(sink.value).toBe(2);

    fireEvent.change(input, { target: { value: '-' } });
    expect(input.value).toBe('-');
    expect(sink.value).toBe(2);

    fireEvent.change(input, { target: { value: '-0,5' } });
    expect(sink.value).toBeCloseTo(-0.5, 10);
  });

  it('принимает точку как десятичный разделитель', () => {
    const sink = { value: 0 };
    render(<Harness sink={sink} />);
    const input = screen.getByTestId('field') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.02' } });
    expect(sink.value).toBeCloseTo(0.02, 10);
  });

  it('с заданным fractionDigits показывает ровно столько знаков', () => {
    const sink = { value: 0 };
    render(<Harness initial={1} sink={sink} fractionDigits={1} />);
    expect(screen.getByTestId('field')).toHaveValue('1,0');
  });

  it('без label не оборачивает поле в label', () => {
    const sink = { value: 0 };
    render(<NumberField testId="bare" value={0} onChange={(v) => (sink.value = v)} />);
    expect(screen.getByTestId('bare').closest('label')).toBeNull();
  });
});
