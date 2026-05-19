import type { BeamInput, BuildingInput, ColumnInput, MaterialProps, SlabInput } from './types';

const DEFAULT_MATERIALS: MaterialProps = {
  fckMpa: 25,
  fyMpa: 420,
  phiFlexion: 0.9,
  phiShear: 0.75
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSlab(raw: unknown, index: number): SlabInput | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `slab-${index + 1}`;
  const spanXm = toNumber(raw.spanXm ?? raw.spanM, 0);
  const spanYm = toNumber(raw.spanYm ?? raw.spanM, spanXm);
  const thicknessM = toNumber(raw.thicknessM, 0.2);
  const deadLoadKnm2 = toNumber(raw.deadLoadKnm2, 1.5);
  const liveLoadKnm2 = toNumber(raw.liveLoadKnm2, 2);
  const areaM2 = toNumber(raw.areaM2, spanXm * spanYm);
  const loadTypologyCode =
    typeof raw.loadTypologyCode === 'string' ? raw.loadTypologyCode : 'CUSTOM';
  let points: SlabInput['points'];
  if (Array.isArray(raw.points)) {
    points = raw.points
      .map((p) => {
        if (!isRecord(p)) return null;
        const x = toNumber(p.x, NaN);
        const y = toNumber(p.y, NaN);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
      })
      .filter((p): p is { x: number; y: number } => p !== null);
    if (points.length < 3) points = undefined;
  }

  return {
    id,
    spanXm,
    spanYm,
    areaM2,
    thicknessM,
    deadLoadKnm2,
    liveLoadKnm2,
    loadTypologyCode,
    points
  };
}

function globalTributaryFromSlabs(slabs: SlabInput[]): number {
  if (slabs.length === 0) return 2;
  const spans = slabs.map((s) => Math.min(s.spanXm, s.spanYm));
  return Math.max(0.4, Math.min(...spans) / 2);
}

function normalizeBeam(raw: unknown, index: number, globalTributary: number): BeamInput | null {
  if (!isRecord(raw)) return null;
  const spanM = toNumber(raw.spanM, 0);
  const widthM = toNumber(raw.widthM, 0.25);
  const depthM = toNumber(raw.depthM, 0.5);
  const id = typeof raw.id === 'string' ? raw.id : `beam-${index + 1}`;

  let slabContributions: BeamInput['slabContributions'] = [];
  if (Array.isArray(raw.slabContributions)) {
    slabContributions = raw.slabContributions
      .map((c, ci) => {
        if (!isRecord(c)) return null;
        const slabId = typeof c.slabId === 'string' ? c.slabId : '';
        const tributaryWidthM = toNumber(c.tributaryWidthM, globalTributary);
        if (!slabId) return null;
        return { slabId, tributaryWidthM };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }

  if (slabContributions.length === 0) {
    const legacyTw = toNumber(raw.tributaryWidthM, globalTributary);
    slabContributions = [{ slabId: 'legacy', tributaryWidthM: legacyTw }];
  }

  const x1 = typeof raw.x1 === 'number' ? raw.x1 : undefined;
  const y1 = typeof raw.y1 === 'number' ? raw.y1 : undefined;
  const x2 = typeof raw.x2 === 'number' ? raw.x2 : undefined;
  const y2 = typeof raw.y2 === 'number' ? raw.y2 : undefined;

  return {
    id,
    spanM,
    widthM,
    depthM,
    slabContributions,
    selfWeightKnm: typeof raw.selfWeightKnm === 'number' ? raw.selfWeightKnm : undefined,
    x1,
    y1,
    x2,
    y2
  };
}

function normalizeColumn(raw: unknown, index: number): ColumnInput | null {
  if (!isRecord(raw)) return null;
  const cx = typeof raw.cx === 'number' ? raw.cx : undefined;
  const cy = typeof raw.cy === 'number' ? raw.cy : undefined;
  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `column-${index + 1}`,
    cx,
    cy,
    widthM: toNumber(raw.widthM, 0.35),
    depthM: toNumber(raw.depthM, 0.35),
    floors: Math.max(1, Math.round(toNumber(raw.floors, 2))),
    selfWeightKnm: typeof raw.selfWeightKnm === 'number' ? raw.selfWeightKnm : undefined,
    momentKnm: typeof raw.momentKnm === 'number' ? raw.momentKnm : undefined
  };
}

/**
 * Convierte JSON legacy `{ slab }` → `{ slabs: [slab] }` y rellena `slabContributions`
 * cuando faltan (proyectos guardados antes del modelo multi-losa).
 */
export function normalizeBuildingInput(raw: unknown): BuildingInput {
  if (!isRecord(raw)) {
    return { slabs: [], beams: [], columns: [], materials: { ...DEFAULT_MATERIALS } };
  }

  let slabs: SlabInput[] = [];
  if (Array.isArray(raw.slabs)) {
    slabs = raw.slabs
      .map((s, i) => normalizeSlab(s, i))
      .filter((s): s is SlabInput => s !== null);
  } else if (raw.slab != null) {
    const legacy = normalizeSlab(raw.slab, 0);
    if (legacy) slabs = [legacy];
  }

  const globalTributary = globalTributaryFromSlabs(slabs);
  const beams = (Array.isArray(raw.beams) ? raw.beams : [])
    .map((b, i) => normalizeBeam(b, i, globalTributary))
    .filter((b): b is BeamInput => b !== null);

  if (slabs.length > 0 && beams.some((b) => b.slabContributions.some((c) => c.slabId === 'legacy'))) {
    const defaultSlabId = slabs[0]!.id;
    for (const beam of beams) {
      beam.slabContributions = beam.slabContributions.map((c) =>
        c.slabId === 'legacy' ? { ...c, slabId: defaultSlabId } : c
      );
    }
  }

  const columns = (Array.isArray(raw.columns) ? raw.columns : [])
    .map((c, i) => normalizeColumn(c, i))
    .filter((c): c is ColumnInput => c !== null);

  const materials = isRecord(raw.materials)
    ? {
        fckMpa: toNumber(raw.materials.fckMpa, DEFAULT_MATERIALS.fckMpa),
        fyMpa: toNumber(raw.materials.fyMpa, DEFAULT_MATERIALS.fyMpa),
        phiFlexion: toNumber(raw.materials.phiFlexion, DEFAULT_MATERIALS.phiFlexion),
        phiShear: toNumber(raw.materials.phiShear, DEFAULT_MATERIALS.phiShear)
      }
    : { ...DEFAULT_MATERIALS };

  return { slabs, beams, columns, materials };
}
