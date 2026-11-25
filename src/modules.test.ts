import { describe, expect, it } from 'vitest';
import * as analysis from '@/core/analysis';
import * as format from '@/core/format';
import * as model from '@/core/model';
import * as i18n from '@/i18n';
import * as store from '@/store';
import * as ui from '@/ui';

describe('структура пакетов', () => {
  it('каждый пакет разрешается и экспортирует модуль', () => {
    for (const mod of [analysis, format, model, i18n, store, ui]) {
      expect(mod).toBeTypeOf('object');
      expect(Object.keys(mod).length).toBeGreaterThan(0);
    }
  });
});
