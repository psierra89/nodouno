import { calculateLoads } from './loads';
import type { BuildingInput, DemandResult } from './types';

export const calculateDemands = (input: BuildingInput): DemandResult => {
  const loads = calculateLoads(input);
  const slabQuById = new Map(loads.slabs.map((slab) => [slab.elementId, slab.qu]));
  const beamLoadById = new Map(loads.beams.map((beam) => [beam.elementId, beam.lineLoadKnm]));
  const columnLoadById = new Map(loads.columns.map((column) => [column.elementId, column.axialLoadKn]));

  const slabs = input.slabs.map((slab, index) => {
    const qu = slabQuById.get(slab.id) ?? loads.slabs[index]?.qu ?? 0;
    const shortSpan = Math.min(slab.spanXm, slab.spanYm);
    return {
      id: slab.id,
      elementId: slab.id,
      elementType: 'slab' as const,
      MuKnmPerM: (qu * shortSpan ** 2) / 8
    };
  });

  const beams = input.beams.map((beam, index) => {
    const beamId = beam.id ?? `beam-${index + 1}`;
    const qu = beamLoadById.get(beamId) ?? loads.beamLineLoadsKnm[index] ?? 0;
    return {
      elementId: beamId,
      elementType: 'beam' as const,
      MuKnm: (qu * beam.spanM ** 2) / 8,
      VuKn: (qu * beam.spanM) / 2
    };
  });

  const columns = input.columns.map((column, index) => {
    const columnId = column.id ?? `column-${index + 1}`;
    const pu = columnLoadById.get(columnId) ?? loads.columnAxialLoadsKn[index] ?? 0;
    return {
      elementId: columnId,
      elementType: 'column' as const,
      PuKn: pu,
      MuKnm: column.momentKnm ?? 0
    };
  });

  return {
    slabs,
    beams,
    columns
  };
};
