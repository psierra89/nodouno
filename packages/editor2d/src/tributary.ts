import type { BeamEntity, SlabEntity } from './types';
import {
  distancePointToSegment,
  entityBoundingBox,
  pointInPolygon,
  polygonArea
} from './geometry';

const EDGE_PROXIMITY_M = 0.3;
const MIN_TRIBUTARY_M = 0.4;

export interface BeamSlabAssociation {
  slabId: string;
  tributaryWidthM: number;
}

function beamMidpoint(beam: BeamEntity): { x: number; y: number } {
  return { x: (beam.x1 + beam.x2) / 2, y: (beam.y1 + beam.y2) / 2 };
}

function slabBboxSpans(slab: SlabEntity): { spanXm: number; spanYm: number } {
  const bb = entityBoundingBox(slab);
  return {
    spanXm: Math.max(0.1, bb.maxX - bb.minX),
    spanYm: Math.max(0.1, bb.maxY - bb.minY)
  };
}

/**
 * Mitad de la luz perpendicular estimada: distancia del segmento viga al borde
 * del bbox de la losa más cercano en dirección perpendicular a la viga.
 */
export function estimateTributaryWidthM(beam: BeamEntity, slab: SlabEntity): number {
  const { spanXm, spanYm } = slabBboxSpans(slab);
  const cap = Math.min(spanXm, spanYm) / 2;
  const bb = entityBoundingBox(slab);
  const mid = beamMidpoint(beam);
  const dx = beam.x2 - beam.x1;
  const dy = beam.y2 - beam.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return Math.max(MIN_TRIBUTARY_M, Math.min(cap, spanYm / 2));

  const nx = -dy / len;
  const ny = dx / len;

  const corners: Array<{ x: number; y: number }> = [
    { x: bb.minX, y: bb.minY },
    { x: bb.maxX, y: bb.minY },
    { x: bb.maxX, y: bb.maxY },
    { x: bb.minX, y: bb.maxY }
  ];

  let minDist = Infinity;
  for (const c of corners) {
    const vx = c.x - mid.x;
    const vy = c.y - mid.y;
    const perp = Math.abs(vx * nx + vy * ny);
    if (perp < minDist) minDist = perp;
  }

  const halfWidth = minDist === Infinity ? cap : minDist;
  return Math.max(MIN_TRIBUTARY_M, Math.min(cap, halfWidth));
}

function beamTouchesSlab(beam: BeamEntity, slab: SlabEntity): boolean {
  const mid = beamMidpoint(beam);
  if (pointInPolygon(mid, slab.points)) return true;

  for (let i = 0, j = slab.points.length - 1; i < slab.points.length; j = i++) {
    const a = slab.points[j];
    const b = slab.points[i];
    const dMid = distancePointToSegment(mid, a, b);
    if (dMid <= EDGE_PROXIMITY_M + beam.widthM / 2) return true;

    const d1 = distancePointToSegment({ x: beam.x1, y: beam.y1 }, a, b);
    const d2 = distancePointToSegment({ x: beam.x2, y: beam.y2 }, a, b);
    if (d1 <= EDGE_PROXIMITY_M || d2 <= EDGE_PROXIMITY_M) return true;
  }
  return false;
}

/** Asocia una viga con todas las losas que tributan carga hacia ella. */
export function associateBeamWithSlabs(
  beam: BeamEntity,
  slabs: SlabEntity[]
): BeamSlabAssociation[] {
  const out: BeamSlabAssociation[] = [];
  for (const slab of slabs) {
    if (!beamTouchesSlab(beam, slab)) continue;
    out.push({
      slabId: slab.id,
      tributaryWidthM: estimateTributaryWidthM(beam, slab)
    });
  }
  return out;
}

export function slabSpansFromPoints(points: Array<{ x: number; y: number }>): {
  spanXm: number;
  spanYm: number;
  areaM2: number;
} {
  const bb = entityBoundingBox({ id: '', type: 'slab', points, thicknessM: 0, props: {} });
  return {
    spanXm: Math.max(0.1, bb.maxX - bb.minX),
    spanYm: Math.max(0.1, bb.maxY - bb.minY),
    areaM2: polygonArea(points)
  };
}
