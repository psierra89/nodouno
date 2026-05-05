import { calculateLoads } from './loads';
import type { BuildingInput, DemandResult } from './types';

export const calculateDemands = (input: BuildingInput): DemandResult => {
  const loads = calculateLoads(input);
  const slabMuKnmPerM = (loads.slabUltimateQkNm2 * input.slab.spanM ** 2) / 8;

  const beams = input.beams.map((beam, index) => {
    const qu = loads.beamLineLoadsKnm[index];
    return {
      MuKnm: (qu * beam.spanM ** 2) / 8,
      VuKn: (qu * beam.spanM) / 2
    };
  });

  const columns = loads.columnAxialLoadsKn.map((pu) => ({
    PuKn: pu
  }));

  return {
    slabMuKnmPerM,
    beams,
    columns
  };
};
