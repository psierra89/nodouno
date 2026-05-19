import { calculateDemands } from './demands';
import type {
  BuildingInput,
  ColumnDesignResult,
  DesignResult,
  FlexureDesignResult,
  ShearDesignResult
} from './types';

const toMm = (valueM: number): number => valueM * 1000;

const calculateRhoMin = (fckMpa: number, fyMpa: number): number => {
  const byFy = 1.4 / fyMpa;
  const byConcrete = (0.25 * Math.sqrt(fckMpa)) / fyMpa;
  return Math.max(byFy, byConcrete);
};

const calculateFlexure = (
  muKnm: number,
  widthM: number,
  depthM: number,
  fckMpa: number,
  fyMpa: number,
  phiFlexion: number
): FlexureDesignResult => {
  const bMm = toMm(widthM);
  const dMm = toMm(depthM);
  const muNmm = muKnm * 1_000_000;

  const rhoRequired = muNmm / (phiFlexion * fyMpa * bMm * dMm ** 2);
  const rhoMin = calculateRhoMin(fckMpa, fyMpa);
  const rhoUsed = Math.max(rhoRequired, rhoMin);
  const isDuctile = rhoUsed <= 0.025;

  return {
    rhoRequired,
    rhoMin,
    rhoUsed,
    isDuctile
  };
};

const calculateShear = (
  vuKn: number,
  widthM: number,
  depthM: number,
  fckMpa: number,
  phiShear: number
): ShearDesignResult => {
  const bMm = toMm(widthM);
  const dMm = toMm(depthM);
  const vcN = 0.17 * Math.sqrt(fckMpa) * bMm * dMm;
  const phiVcKn = (phiShear * vcN) / 1000;

  return {
    needsStirrups: vuKn > phiVcKn / 2,
    sMaxMm: Math.min(dMm / 2, 600)
  };
};

const calculateColumn = (
  puKn: number,
  muKnm: number,
  widthM: number,
  depthM: number,
  fckMpa: number,
  fyMpa: number
): ColumnDesignResult => {
  const base: ColumnDesignResult = {
    rhoGeomMin: 0.01,
    rhoGeomMax: 0.08,
    minBars: 4,
    interactionChecked: Math.abs(muKnm) > 1e-6
  };
  if (!base.interactionChecked) return base;

  const AgMm2 = widthM * depthM * 1e6;
  const pnRoughKn = (0.85 * fckMpa * AgMm2 * 0.65) / 1000;
  const phiPnKn = 0.65 * pnRoughKn;
  const mnRoughKnm = (0.9 * fyMpa * AgMm2 * 0.15 * depthM) / 1e6;

  const interactionRatio =
    phiPnKn > 1 ? Math.abs(puKn) / phiPnKn + Math.abs(muKnm) / Math.max(mnRoughKnm, 1e-6) : 1;

  const needsExtraSteel = interactionRatio > 0.35 || Math.abs(muKnm) > 0.05 * Math.abs(puKn) * depthM;

  return {
    ...base,
    minBars: needsExtraSteel ? Math.max(6, base.minBars) : base.minBars,
    rhoGeomMin: needsExtraSteel ? Math.max(0.012, base.rhoGeomMin) : base.rhoGeomMin
  };
};

export const calculateDesign = (input: BuildingInput): DesignResult => {
  const demands = calculateDemands(input);
  const { materials } = input;
  const slabDemandById = new Map(demands.slabs.map((demand) => [demand.elementId, demand]));
  const beamDemandById = new Map(demands.beams.map((demand) => [demand.elementId, demand]));
  const columnDemandById = new Map(demands.columns.map((demand) => [demand.elementId, demand]));

  const slabs = input.slabs.map((slab, index) => {
    const slabDemand = slabDemandById.get(slab.id) ?? demands.slabs[index];
    const mu = slabDemand?.MuKnmPerM ?? 0;
    const flexure = calculateFlexure(
      mu,
      1,
      slab.thicknessM,
      materials.fckMpa,
      materials.fyMpa,
      materials.phiFlexion
    );
    return {
      elementId: slab.id,
      elementType: 'slab' as const,
      ...flexure
    };
  });

  const beams = input.beams.map((beam, index) => {
    const beamId = beam.id ?? `beam-${index + 1}`;
    const demand = beamDemandById.get(beamId) ?? demands.beams[index];
    return {
      elementId: beamId,
      elementType: 'beam' as const,
      flexion: calculateFlexure(
        demand?.MuKnm ?? 0,
        beam.widthM,
        beam.depthM,
        materials.fckMpa,
        materials.fyMpa,
        materials.phiFlexion
      ),
      shear: calculateShear(
        demand?.VuKn ?? 0,
        beam.widthM,
        beam.depthM,
        materials.fckMpa,
        materials.phiShear
      )
    };
  });

  const columns = input.columns.map((col, index) => {
    const columnId = col.id ?? `column-${index + 1}`;
    const demand = columnDemandById.get(columnId) ?? demands.columns[index];
    const columnDesign = calculateColumn(
      demand?.PuKn ?? 0,
      demand?.MuKnm ?? 0,
      col.widthM,
      col.depthM,
      materials.fckMpa,
      materials.fyMpa
    );
    return {
      elementId: columnId,
      elementType: 'column' as const,
      ...columnDesign
    };
  });

  return {
    slabs,
    beams,
    columns
  };
};
