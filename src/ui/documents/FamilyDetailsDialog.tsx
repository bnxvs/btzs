import { useState } from 'react';
import { t } from '@/i18n';
import { parseNumber } from '@/i18n';
import { TemperatureUnit } from '@/core/model';
import type { FilmDocument, PaperDocument } from '@/core/model';
import { Dialog, DialogButtons } from '@/ui/components/Dialog';

/**
 * Диалог параметров семейства кривых (Family Details).
 *
 * Плёнка: Date (по умолчанию — сегодняшняя), Name, Film ISO, Developer,
 * Dilution, Temperature (по умолчанию Фаренгейт, с переключением на
 * Цельсий), Volume, Agitation, Notes.
 *
 * Бумага: Name, способ печати (contact/projection), Developer, Dilution,
 * Temperature, время проявления, тонер, сушка, Notes.
 */
export type FamilyDetails = FilmDocument['family'] | PaperDocument['family'];

export interface FamilyDetailsDialogProps {
  kind: 'film' | 'paper';
  family: FamilyDetails;
  onSave: (family: FamilyDetails) => void;
  onCancel: () => void;
}

function isFilm(family: FamilyDetails): family is FilmDocument['family'] {
  return 'filmIso' in family;
}

export function FamilyDetailsDialog({ kind, family, onSave, onCancel }: FamilyDetailsDialogProps) {
  const [form, setForm] = useState<FamilyDetails>({ ...family });

  function set(key: string, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }) as FamilyDetails);
  }

  const text = (key: 'date' | 'name' | 'developer' | 'dilution' | 'notes') => (
    <label className="dialog-field" key={key}>
      <span>{t(`family.${key}` as 'family.name')}</span>
      <input
        type="text"
        value={form[key]}
        data-testid={`family-${key}`}
        onChange={(e) => set(key, e.target.value as never)}
      />
    </label>
  );

  const temperatureField = (
    <label className="dialog-field">
      <span>{t('family.temperature')}</span>
      <span className="dialog-field-row">
        <input
          type="text"
          inputMode="decimal"
          value={String(form.temperature)}
          data-testid="family-temperature"
          onChange={(e) => {
            const value = parseNumber(e.target.value);
            // Пока поле пустое или вводится неполное число — не обновляем.
            if (!Number.isNaN(value)) set('temperature', value);
          }}
        />
        <select
          value={form.temperatureUnit}
          data-testid="family-temperature-unit"
          onChange={(e) => {
            const unit = e.target.value as TemperatureUnit;
            const from = form.temperatureUnit;
            if (unit === from) return;
            // Переключение единицы пересчитывает значение:
            // F→C: (F−32)·5/9; C→F: C·9/5+32.
            const value =
              unit === TemperatureUnit.Celsius
                ? Math.round(((form.temperature - 32) * 5) / 9)
                : Math.round((form.temperature * 9) / 5 + 32);
            setForm((prev) => ({ ...prev, temperature: value, temperatureUnit: unit }));
          }}
        >
          <option value={TemperatureUnit.Fahrenheit}>{t('unit.fahrenheit')}</option>
          <option value={TemperatureUnit.Celsius}>{t('unit.celsius')}</option>
        </select>
      </span>
    </label>
  );

  const filmFields = isFilm(form) && (
    <>
      <label className="dialog-field">
        <span>{t('family.filmIso')}</span>
        <input
          type="text"
          inputMode="decimal"
          value={String(form.filmIso)}
          data-testid="family-film-iso"
          onChange={(e) => {
            const value = parseNumber(e.target.value);
            // Пока поле пустое или вводится неполное число — не обновляем.
            if (!Number.isNaN(value)) set('filmIso', value);
          }}
        />
      </label>
      <label className="dialog-field">
        <span>{t('family.volume')}</span>
        <input
          type="text"
          value={form.volume}
          data-testid="family-volume"
          onChange={(e) => set('volume', e.target.value)}
        />
      </label>
      <label className="dialog-field">
        <span>{t('family.agitation')}</span>
        <input
          type="text"
          value={form.agitation}
          data-testid="family-agitation"
          onChange={(e) => set('agitation', e.target.value)}
        />
      </label>
    </>
  );

  const paperFields = !isFilm(form) && (
    <>
      <label className="dialog-field">
        <span>{t('familyPaper.printMethod')}</span>
        <select
          value={form.printMethod}
          data-testid="family-print-method"
          onChange={(e) => set('printMethod', e.target.value)}
        >
          <option value="contact">{t('familyPaper.contact')}</option>
          <option value="projection">{t('familyPaper.projection')}</option>
        </select>
      </label>
      <label className="dialog-field">
        <span>{t('familyPaper.developingTime')}</span>
        <input
          type="text"
          value={form.developingTime}
          data-testid="family-developing-time"
          onChange={(e) => set('developingTime', e.target.value)}
        />
      </label>
      <label className="dialog-field">
        <span>{t('familyPaper.toner')}</span>
        <input
          type="text"
          value={form.toner}
          data-testid="family-toner"
          onChange={(e) => set('toner', e.target.value)}
        />
      </label>
      <label className="dialog-field">
        <span>{t('familyPaper.drying')}</span>
        <input
          type="text"
          value={form.drying}
          data-testid="family-drying"
          onChange={(e) => set('drying', e.target.value)}
        />
      </label>
    </>
  );

  return (
    <Dialog
      title={t('family.title')}
      onClose={onCancel}
      data-testid="family-details-dialog"
      footer={
        <DialogButtons onOk={() => onSave(form)} onCancel={onCancel} />
      }
    >
      <div className="dialog-fields">
        {text('date')}
        {text('name')}
        {kind === 'film' && filmFields}
        {kind === 'paper' && paperFields}
        {text('developer')}
        {text('dilution')}
        {temperatureField}
        {text('notes')}
      </div>
    </Dialog>
  );
}
