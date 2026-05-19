import type { BuildingInput, LoadResult, SlabLoadBreakdown } from './types';

const CONCRETE_UNIT_WEIGHT_KNM3 = 24;

export const calculateUltimateSurfaceLoad = (
  thicknessM: number,
  deadLoadKnm2: number,
  liveLoadKnm2: number
): number => {
  const selfWeight = thicknessM * CONCRETE_UNIT_WEIGHT_KNM3;
  const d = selfWeight + deadLoadKnm2;
  return 1.2 * d + 1.6 * liveLoadKnm2;
};

function slabBreakdown(slab: BuildingInput['slabs'][number]): SlabLoadBreakdown {
  const D = slab.thicknessM * CONCRETE_UNIT_WEIGHT_KNM3 + slab.deadLoadKnm2;
  const L = slab.liveLoadKnm2;
  const qu = calculateUltimateSurfaceLoad(slab.thicknessM, slab.deadLoadKnm2, slab.liveLoadKnm2);
  return { id: slab.id, D, L, qu };
}

export const calculateLoads = (input: BuildingInput): LoadResult => {
  const quBySlabId = new Map<string, number>();
  const slabs = input.slabs.map((slab) => {
    const breakdown = slabBreakdown(slab);
    quBySlabId.set(slab.id, breakdown.qu);
    return breakdown;
  });

  const beamLineLoadsKnm = input.beams.map((beam) => {
    const beamSelfWeight =
      beam.selfWeightKnm ?? beam.widthM * beam.depthM * CONCRETE_UNIT_WEIGHT_KNM3;
    const slabPart = beam.slabContributions.reduce((acc, contrib) => {
      const qu = quBySlabId.get(contrib.slabId) ?? 0;
      return acc + qu * contrib.tributaryWidthM;
    }, 0);
    return slabPart + beamSelfWeight;
  });

  const totalBeamReactionKn = beamLineLoadsKnm.reduce((acc, lineLoad, i) => {
    const beamSpan = input.beams[i]?.spanM ?? 0;
    return acc + (lineLoad * beamSpan) / 2;
  }, 0);

  const columnAxialLoadsKn = input.columns.map((column) => {
    const selfWeight =
      column.selfWeightKnm ?? column.widthM * column.depthM * CONCRETE_UNIT_WEIGHT_KNM3;
    return (totalBeamReactionKn + selfWeight) * Math.max(column.floors, 1);
  });

  return {
    slabs,
    beamLineLoadsKnm,
    columnAxialLoadsKn
  };
};
