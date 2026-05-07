import type { DrawingState } from './types';
import { polygonArea } from './geometry';

export interface SimplifiedFallback {
  spanX: number;
  spanY: number;
  thicknessM: number;
  deadLoadKnm2: number;
  liveLoadKnm2: number;
}

export interface SimplifiedModelOutput {
  slab: {
    spanM: number;
    thicknessM: number;
    deadLoadKnm2: number;
    liveLoadKnm2: number;
  };
  beams: Array<{ spanM: number; widthM: number; depthM: number; tributaryWidthM: number }>;
  columns: Array<{ widthM: number; depthM: number; floors: number; momentKnm?: number }>;
  materials: { fckMpa: number; fyMpa: number; phiFlexion: number; phiShear: number };
  source: 'derived_from_drawing' | 'fixed_mvp_rectangular';
}

const DEFAULT_MATERIALS = { fckMpa: 25, fyMpa: 420, phiFlexion: 0.9, phiShear: 0.75 };

function beamSpanM(b: { x1: number; y1: number; x2: number; y2: number }): number {
  const dx = b.x2 - b.x1;
  const dy = b.y2 - b.y1;
  return Math.hypot(dx, dy);
}

/**
 * Genera un modelo simplificado compatible con el motor de cálculo.
 * Usa las entidades reales del dibujo; si faltan vigas o columnas, completa con el emparrillado 4+4 clásico.
 */
export function deriveSimplifiedModel(
  state: DrawingState,
  fallback: SimplifiedFallback
): SimplifiedModelOutput {
  const slabs = state.entities.slabs;
  const beams = state.entities.beams;
  const columns = state.entities.columns;

  let spanX = fallback.spanX;
  let spanY = fallback.spanY;
  let thicknessM = fallback.thicknessM;
  let derived = false;

  if (slabs.length > 0) {
    const biggest = slabs.reduce(
      (acc, s) => {
        const area = polygonArea(s.points);
        if (!acc || area > acc.area) return { slab: s, area };
        return acc;
      },
      null as null | { slab: (typeof slabs)[number]; area: number }
    );
    if (biggest) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of biggest.slab.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const w = maxX - minX;
      const h = maxY - minY;
      if (w > 0.5 && h > 0.5) {
        spanX = w;
        spanY = h;
        thicknessM = biggest.slab.thicknessM > 0 ? biggest.slab.thicknessM : thicknessM;
        derived = true;
      }
    }
  }

  const tw = Math.max(0.4, Math.min(spanX, spanY) / 2);

  const beamSection = beams[0]
    ? { widthM: beams[0].widthM, depthM: beams[0].depthM }
    : { widthM: 0.25, depthM: 0.5 };
  const columnSection = columns[0]
    ? { widthM: columns[0].widthM, depthM: columns[0].depthM }
    : { widthM: 0.35, depthM: 0.35 };

  let beamOutputs: SimplifiedModelOutput['beams'];
  if (beams.length > 0) {
    beamOutputs = beams.map((b) => ({
      spanM: Math.max(0.5, beamSpanM(b)),
      widthM: b.widthM,
      depthM: b.depthM,
      tributaryWidthM: tw
    }));
  } else {
    beamOutputs = [
      {
        spanM: spanX,
        widthM: beamSection.widthM,
        depthM: beamSection.depthM,
        tributaryWidthM: spanY / 2
      },
      {
        spanM: spanX,
        widthM: beamSection.widthM,
        depthM: beamSection.depthM,
        tributaryWidthM: spanY / 2
      },
      {
        spanM: spanY,
        widthM: beamSection.widthM,
        depthM: beamSection.depthM,
        tributaryWidthM: spanX / 2
      },
      {
        spanM: spanY,
        widthM: beamSection.widthM,
        depthM: beamSection.depthM,
        tributaryWidthM: spanX / 2
      }
    ];
  }

  let columnOutputs: SimplifiedModelOutput['columns'];
  if (columns.length > 0) {
    columnOutputs = columns.map((c) => ({
      widthM: c.widthM,
      depthM: c.depthM,
      floors: 2,
      momentKnm: undefined
    }));
  } else {
    columnOutputs = [
      { widthM: columnSection.widthM, depthM: columnSection.depthM, floors: 2 },
      { widthM: columnSection.widthM, depthM: columnSection.depthM, floors: 2 },
      { widthM: columnSection.widthM, depthM: columnSection.depthM, floors: 2 },
      { widthM: columnSection.widthM, depthM: columnSection.depthM, floors: 2 }
    ];
  }

  return {
    slab: {
      spanM: Math.max(spanX, spanY),
      thicknessM,
      deadLoadKnm2: fallback.deadLoadKnm2,
      liveLoadKnm2: fallback.liveLoadKnm2
    },
    beams: beamOutputs,
    columns: columnOutputs,
    materials: { ...DEFAULT_MATERIALS },
    source: derived ? 'derived_from_drawing' : 'fixed_mvp_rectangular'
  };
}
