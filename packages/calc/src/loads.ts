import type { BuildingInput, LoadResult } from './types';

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

export const calculateLoads = (input: BuildingInput): LoadResult => {
  const slabDkNm2 = input.slab.thicknessM * CONCRETE_UNIT_WEIGHT_KNM3 + input.slab.deadLoadKnm2;
  const slabLkNm2 = input.slab.liveLoadKnm2;
  const slabUltimateQkNm2 = 1.2 * slabDkNm2 + 1.6 * slabLkNm2;

  const beamLineLoadsKnm = input.beams.map((beam) => {
    const beamSelfWeight = beam.selfWeightKnm ?? beam.widthM * beam.depthM * CONCRETE_UNIT_WEIGHT_KNM3;
    return slabUltimateQkNm2 * beam.tributaryWidthM + beamSelfWeight;
  });

  const totalBeamReactionKn = beamLineLoadsKnm.reduce((acc, lineLoad, i) => {
    const beamSpan = input.beams[i]?.spanM ?? 0;
    return acc + (lineLoad * beamSpan) / 2;
  }, 0);

  const columnAxialLoadsKn = input.columns.map((column) => {
    const selfWeight = column.selfWeightKnm ?? column.widthM * column.depthM * CONCRETE_UNIT_WEIGHT_KNM3;
    return (totalBeamReactionKn + selfWeight) * Math.max(column.floors, 1);
  });

  return {
    slabDkNm2,
    slabLkNm2,
    slabUltimateQkNm2,
    beamLineLoadsKnm,
    columnAxialLoadsKn
  };
};
