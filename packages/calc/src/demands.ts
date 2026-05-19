import { calculateLoads } from './loads';
import type { BuildingInput, DemandResult } from './types';

export const calculateDemands = (input: BuildingInput): DemandResult => {
  const loads = calculateLoads(input);

  const slabs = input.slabs.map((slab, index) => {
    const qu = loads.slabs[index]?.qu ?? 0;
    const shortSpan = Math.min(slab.spanXm, slab.spanYm);
    return {
      id: slab.id,
      MuKnmPerM: (qu * shortSpan ** 2) / 8
    };
  });

  const beams = input.beams.map((beam, index) => {
    const qu = loads.beamLineLoadsKnm[index] ?? 0;
    return {
      MuKnm: (qu * beam.spanM ** 2) / 8,
      VuKn: (qu * beam.spanM) / 2
    };
  });

  const columns = loads.columnAxialLoadsKn.map((pu, index) => ({
    PuKn: pu,
    MuKnm: input.columns[index]?.momentKnm ?? 0
  }));

  return {
    slabs,
    beams,
    columns
  };
};
