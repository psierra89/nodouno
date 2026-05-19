import { describe, expect, it } from 'vitest';
import { normalizeBuildingInput } from './normalize';

describe('normalizeBuildingInput', () => {
  it('convierte legacy { slab } a { slabs: [slab] }', () => {
    const legacy = {
      slab: {
        spanM: 5,
        thicknessM: 0.2,
        deadLoadKnm2: 1.5,
        liveLoadKnm2: 2
      },
      beams: [{ spanM: 5, widthM: 0.25, depthM: 0.5, tributaryWidthM: 2.5 }],
      columns: [{ widthM: 0.35, depthM: 0.35, floors: 2 }],
      materials: { fckMpa: 25, fyMpa: 420, phiFlexion: 0.9, phiShear: 0.75 }
    };
    const model = normalizeBuildingInput(legacy);
    expect(model.slabs).toHaveLength(1);
    expect(model.slabs[0]?.spanXm).toBe(5);
    expect(model.beams[0]?.slabContributions[0]?.slabId).toBe(model.slabs[0]?.id);
    expect(model.beams[0]?.slabContributions[0]?.tributaryWidthM).toBe(2.5);
  });
});
