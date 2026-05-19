import { describe, expect, it } from 'vitest';
import { calculateDemands, calculateDesign, calculateLoads } from './index';
import type { BuildingInput } from './types';

const baseInput: BuildingInput = {
  slabs: [
    {
      id: 'slab-1',
      spanXm: 5,
      spanYm: 4,
      areaM2: 20,
      thicknessM: 0.2,
      deadLoadKnm2: 1.5,
      liveLoadKnm2: 2,
      loadTypologyCode: 'RES_1_2_FAM'
    }
  ],
  beams: [
    {
      spanM: 5,
      widthM: 0.25,
      depthM: 0.5,
      slabContributions: [{ slabId: 'slab-1', tributaryWidthM: 2.5 }]
    },
    {
      spanM: 5,
      widthM: 0.25,
      depthM: 0.5,
      slabContributions: [{ slabId: 'slab-1', tributaryWidthM: 2.5 }]
    },
    {
      spanM: 4,
      widthM: 0.25,
      depthM: 0.5,
      slabContributions: [{ slabId: 'slab-1', tributaryWidthM: 2 }]
    },
    {
      spanM: 4,
      widthM: 0.25,
      depthM: 0.5,
      slabContributions: [{ slabId: 'slab-1', tributaryWidthM: 2 }]
    }
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

const twoSlabInput: BuildingInput = {
  slabs: [
    {
      id: 'slab-a',
      spanXm: 5,
      spanYm: 4,
      areaM2: 20,
      thicknessM: 0.2,
      deadLoadKnm2: 1.5,
      liveLoadKnm2: 2,
      loadTypologyCode: 'RES_1_2_FAM'
    },
    {
      id: 'slab-b',
      spanXm: 4,
      spanYm: 3,
      areaM2: 12,
      thicknessM: 0.18,
      deadLoadKnm2: 1.5,
      liveLoadKnm2: 5,
      loadTypologyCode: 'RESTAURANT'
    }
  ],
  beams: [
    {
      id: 'beam-shared',
      spanM: 5,
      widthM: 0.25,
      depthM: 0.5,
      slabContributions: [
        { slabId: 'slab-a', tributaryWidthM: 2 },
        { slabId: 'slab-b', tributaryWidthM: 1.5 }
      ]
    }
  ],
  columns: [{ widthM: 0.35, depthM: 0.35, floors: 2 }],
  materials: baseInput.materials
};

describe('motor de calculo - cargas', () => {
  it('calcula qu por losa y distribuye a vigas/columnas', () => {
    const loads = calculateLoads(baseInput);
    expect(loads.slabs[0]?.qu).toBeCloseTo(10.76, 6);
    expect(loads.beamLineLoadsKnm.length).toBe(4);
    expect(loads.columnAxialLoadsKn.every((value) => value > 0)).toBe(true);
  });

  it('dos losas distintas producen qu distintos y suma en viga compartida', () => {
    const loads = calculateLoads(twoSlabInput);
    expect(loads.slabs[0]?.qu).toBeCloseTo(10.76, 2);
    expect(loads.slabs[1]?.qu).not.toBeCloseTo(loads.slabs[0]?.qu ?? 0, 2);
    const quA = loads.slabs[0]?.qu ?? 0;
    const quB = loads.slabs[1]?.qu ?? 0;
    const expectedLine = quA * 2 + quB * 1.5 + 0.25 * 0.5 * 24;
    expect(loads.beamLineLoadsKnm[0]).toBeCloseTo(expectedLine, 2);
  });
});

describe('motor de calculo - solicitaciones', () => {
  it('calcula Mu por losa (luz corta) y vigas', () => {
    const demands = calculateDemands(baseInput);
    expect(demands.slabs[0]?.MuKnmPerM).toBeCloseTo(21.52, 2);
    expect(demands.beams[0].MuKnm).toBeGreaterThan(0);
    expect(demands.beams[0].VuKn).toBeGreaterThan(0);
    expect(demands.columns[0].PuKn).toBeGreaterThan(0);
    expect(demands.columns[0].MuKnm).toBe(0);
  });
});

describe('motor de calculo - dimensionamiento', () => {
  it('aplica cuantias minimas, chequeo de corte y reglas de columnas', () => {
    const design = calculateDesign(baseInput);
    expect(design.slabs[0].rhoUsed).toBeGreaterThanOrEqual(design.slabs[0].rhoMin);
    expect(typeof design.beams[0].shear.needsStirrups).toBe('boolean');
    expect(design.beams[0].shear.sMaxMm).toBeLessThanOrEqual(600);
    expect(design.columns[0].rhoGeomMin).toBe(0.01);
    expect(design.columns[0].minBars).toBe(4);
    expect(design.columns[0].interactionChecked).toBe(false);
  });
});
