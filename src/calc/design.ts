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
  const isDuctile = rhoUsed <= 0.025; // TODO: reemplazar por chequeo formal de epsilon_t >= 0.005

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

const calculateColumn = (): ColumnDesignResult => ({
  rhoGeomMin: 0.01,
  rhoGeomMax: 0.08,
  minBars: 4
});

export const calculateDesign = (input: BuildingInput): DesignResult => {
  const demands = calculateDemands(input);
  const { materials } = input;

  const slab = calculateFlexure(
    demands.slabMuKnmPerM,
    1,
    input.slab.thicknessM,
    materials.fckMpa,
    materials.fyMpa,
    materials.phiFlexion
  );

  const beams = input.beams.map((beam, index) => {
    const demand = demands.beams[index];
    return {
      flexion: calculateFlexure(
        demand.MuKnm,
        beam.widthM,
        beam.depthM,
        materials.fckMpa,
        materials.fyMpa,
        materials.phiFlexion
      ),
      shear: calculateShear(
        demand.VuKn,
        beam.widthM,
        beam.depthM,
        materials.fckMpa,
        materials.phiShear
      )
    };
  });

  const columns = input.columns.map(() => calculateColumn());

  return {
    slab,
    beams,
    columns
  };
};
