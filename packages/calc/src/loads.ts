import type { BuildingInput, LoadResult, SlabLoadBreakdown } from './types';

const CONCRETE_UNIT_WEIGHT_KNM3 = 24;
const FALLBACK_COLUMN_SELF_WEIGHT_KNM = 2.94;

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
  return { id: slab.id, elementId: slab.id, elementType: 'slab', D, L, qu };
}

export const calculateLoads = (input: BuildingInput): LoadResult => {
  const quBySlabId = new Map<string, number>();
  const slabs = input.slabs.map((slab) => {
    const breakdown = slabBreakdown(slab);
    quBySlabId.set(slab.id, breakdown.qu);
    return breakdown;
  });

  const beams = input.beams.map((beam, index) => {
    const beamId = beam.id ?? `beam-${index + 1}`;
    const beamSelfWeight =
      beam.selfWeightKnm ?? beam.widthM * beam.depthM * CONCRETE_UNIT_WEIGHT_KNM3;
    const slabPart = beam.slabContributions.reduce((acc, contrib) => {
      const qu = quBySlabId.get(contrib.slabId) ?? 0;
      return acc + qu * contrib.tributaryWidthM;
    }, 0);
    return {
      elementId: beamId,
      elementType: 'beam' as const,
      lineLoadKnm: slabPart + beamSelfWeight
    };
  });
  const beamLineLoadsKnm = beams.map((beam) => beam.lineLoadKnm);

  const totalBeamReactionKn = beamLineLoadsKnm.reduce((acc, lineLoad, i) => {
    const beamSpan = input.beams[i]?.spanM ?? 0;
    return acc + (lineLoad * beamSpan) / 2;
  }, 0);

  const columns = input.columns.map((column, index) => {
    const columnId = column.id ?? `column-${index + 1}`;
    const selfWeight =
      column.selfWeightKnm ??
      (column.widthM > 0 && column.depthM > 0
        ? column.widthM * column.depthM * CONCRETE_UNIT_WEIGHT_KNM3
        : FALLBACK_COLUMN_SELF_WEIGHT_KNM);
    return {
      elementId: columnId,
      elementType: 'column' as const,
      axialLoadKn: (totalBeamReactionKn + selfWeight) * Math.max(column.floors, 1)
    };
  });
  const columnAxialLoadsKn = columns.map((column) => column.axialLoadKn);

  return {
    slabs,
    beams,
    columns,
    beamLineLoadsKnm,
    columnAxialLoadsKn
  };
};
