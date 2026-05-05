import { describe, expect, it } from 'vitest';
import { calculateDemands, calculateDesign, calculateLoads } from './index';
import type { BuildingInput } from './types';

const baseInput: BuildingInput = {
  slab: {
    spanM: 5,
    thicknessM: 0.2,
    deadLoadKnm2: 1.5,
    liveLoadKnm2: 2
  },
  beams: [
    { spanM: 5, widthM: 0.25, depthM: 0.5, tributaryWidthM: 2.5 },
    { spanM: 5, widthM: 0.25, depthM: 0.5, tributaryWidthM: 2.5 },
    { spanM: 4, widthM: 0.25, depthM: 0.5, tributaryWidthM: 2 },
    { spanM: 4, widthM: 0.25, depthM: 0.5, tributaryWidthM: 2 }
  ],
  columns: [
    { widthM: 0.35, depthM: 0.35, floors: 2 },
    { widthM: 0.35, depthM: 0.35, floors: 2 },
    { widthM: 0.35, depthM: 0.35, floors: 2 },
    { widthM: 0.35, depthM: 0.35, floors: 2 }
  ],
  materials: {
    fckMpa: 25,
    fyMpa: 420,
    phiFlexion: 0.9,
    phiShear: 0.75
  }
};

describe('motor de calculo - cargas', () => {
  it('calcula la carga ultima de losa y distribuye a vigas/columnas', () => {
    const loads = calculateLoads(baseInput);
    expect(loads.slabUltimateQkNm2).toBeCloseTo(10.76, 6);
    expect(loads.beamLineLoadsKnm.length).toBe(4);
    expect(loads.columnAxialLoadsKn.every((value) => value > 0)).toBe(true);
  });
});

describe('motor de calculo - solicitaciones', () => {
  it('calcula Mu y Vu simplificados para vigas y losa', () => {
    const demands = calculateDemands(baseInput);
    expect(demands.slabMuKnmPerM).toBeCloseTo(33.625, 3);
    expect(demands.beams[0].MuKnm).toBeGreaterThan(0);
    expect(demands.beams[0].VuKn).toBeGreaterThan(0);
    expect(demands.columns[0].PuKn).toBeGreaterThan(0);
  });
});

describe('motor de calculo - dimensionamiento', () => {
  it('aplica cuantias minimas, chequeo de corte y reglas de columnas', () => {
    const design = calculateDesign(baseInput);
    expect(design.slab.rhoUsed).toBeGreaterThanOrEqual(design.slab.rhoMin);
    expect(typeof design.beams[0].shear.needsStirrups).toBe('boolean');
    expect(design.beams[0].shear.sMaxMm).toBeLessThanOrEqual(600);
    expect(design.columns[0].rhoGeomMin).toBe(0.01);
    expect(design.columns[0].minBars).toBe(4);
  });
});
