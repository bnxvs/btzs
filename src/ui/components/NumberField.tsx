import { useState } from 'react';
import { formatNumber, parseNumber } from '@/i18n';

/**
 * Числовое поле с десятичным разделителем локали.
 *
 * Пока пользователь редактирует поле, отображается введённый текст (черновик),
 * а не переформатированное число: иначе контролируемый ввод переписывал бы
 * значение на каждый символ и «съедал» десятичный разделитель (`0,` разбирается
 * как `0`), из-за чего дробные значения вроде `0,015` было невозможно ввести.
 * По потере фокуса поле приводится к каноническому виду.
 */
export interface NumberFieldProps {
  testId: string;
  value: number;
  onChange: (value: number) => void;
  /** Подпись; если задана — поле оборачивается в `<label>`. */
  label?: string;
  /** Класс обёртки-`label` (оформление различается по вкладкам). */
  className?: string;
  /** Поле недоступно для редактирования. */
  disabled?: boolean;
  /** Подсказка клавиатуре (по умолчанию `decimal`). */
  inputMode?: 'decimal' | 'numeric';
  /**
   * Число знаков после разделителя в каноническом виде. Если не задано,
   * значение показывается без лишних нулей (до 10 значащих знаков), поэтому
   * введённая точность не теряется.
   */
  fractionDigits?: number;
}

export function NumberField({
  testId,
  value,
  onChange,
  label,
  className,
  disabled,
  inputMode = 'decimal',
  fractionDigits,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const canonical =
    fractionDigits === undefined ? formatNumber(value) : formatNumber(value, fractionDigits);

  const input = (
    <input
      type="text"
      inputMode={inputMode}
      data-testid={testId}
      disabled={disabled}
      value={draft ?? canonical}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const parsed = parseNumber(raw);
        // Пустое или неполное число (`0,`, `-`) не коммитим — но черновик
        // сохраняем, чтобы разделитель и знак не пропадали.
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );

  if (label === undefined) return input;
  return (
    <label className={className}>
      <span>{label}</span>
      {input}
    </label>
  );
}
