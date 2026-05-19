import { describe, expect, it } from 'vitest';
import {
  CIRSOC_101_LOAD_TYPOLOGIES,
  getTypology,
  liveLoadForTypology
} from './cirsoc101-loads';

describe('CIRSOC 101 catalog', () => {
  it('expone al menos 20 tipologías', () => {
    expect(CIRSOC_101_LOAD_TYPOLOGIES.length).toBeGreaterThanOrEqual(20);
  });

  it('getTypology devuelve entrada conocida', () => {
    const t = getTypology('OFFICE');
    expect(t?.label).toMatch(/Oficinas/i);
    expect(t?.liveLoadKnm2).toBe(2.5);
  });

  it('liveLoadForTypology usa Tabla 4.1 o override CUSTOM', () => {
    expect(liveLoadForTypology('RES_1_2_FAM')).toBe(2);
    expect(liveLoadForTypology('PARKING')).toBe(2.5);
    expect(liveLoadForTypology('CUSTOM', 3.5)).toBe(3.5);
    expect(liveLoadForTypology('CUSTOM')).toBeNull();
    expect(liveLoadForTypology('UNKNOWN')).toBeNull();
  });
});
