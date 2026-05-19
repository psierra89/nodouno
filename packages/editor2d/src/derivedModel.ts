import type { BuildingInput } from '@nodouno/calc';
import { liveLoadForTypology } from '@nodouno/shared';
import type { DrawingState, SlabEntity, SlabLoadProps } from './types';
import { associateBeamWithSlabs, slabSpansFromPoints } from './tributary';

export interface DeriveBuildingModelResult {
  model: BuildingInput;
  source: 'derived_from_drawing';
  warnings: string[];
}

export interface DeriveBuildingModelError {
  error: string;
}

const DEFAULT_MATERIALS: BuildingInput['materials'] = {
  fckMpa: 25,
  fyMpa: 420,
  phiFlexion: 0.9,
  phiShear: 0.75
};

const DEFAULT_DEAD_LOAD_KNM2 = 1.5;

function beamSpanM(b: { x1: number; y1: number; x2: number; y2: number }): number {
  return Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
}

function readSlabLoadProps(slab: SlabEntity): SlabLoadProps {
  const props = slab.props ?? {};
  return {
    loadTypologyCode: props.loadTypologyCode as SlabLoadProps['loadTypologyCode'],
    deadLoadKnm2:
      typeof props.deadLoadKnm2 === 'number' && Number.isFinite(props.deadLoadKnm2)
        ? props.deadLoadKnm2
        : DEFAULT_DEAD_LOAD_KNM2,
    liveLoadOverrideKnm2:
      typeof props.liveLoadOverrideKnm2 === 'number' ? props.liveLoadOverrideKnm2 : undefined
  };
}

function slabToInput(slab: SlabEntity): BuildingInput['slabs'][number] | DeriveBuildingModelError {
  const loadProps = readSlabLoadProps(slab);
  if (!loadProps.loadTypologyCode) {
    return { error: `Losa ${slab.id}: falta tipología de carga (CIRSOC 101).` };
  }
  const live = liveLoadForTypology(loadProps.loadTypologyCode, loadProps.liveLoadOverrideKnm2);
  if (live === null) {
    return {
      error: `Losa ${slab.id}: carga viva inválida o faltante para tipología ${loadProps.loadTypologyCode}.`
    };
  }
  const { spanXm, spanYm, areaM2 } = slabSpansFromPoints(slab.points);
  if (areaM2 < 0.25) {
    return { error: `Losa ${slab.id}: área demasiado pequeña.` };
  }
  return {
    id: slab.id,
    spanXm,
    spanYm,
    areaM2,
    thicknessM: slab.thicknessM > 0 ? slab.thicknessM : 0.2,
    deadLoadKnm2: loadProps.deadLoadKnm2 ?? DEFAULT_DEAD_LOAD_KNM2,
    liveLoadKnm2: live,
    loadTypologyCode: loadProps.loadTypologyCode,
    points: slab.points.map((p) => ({ x: p.x, y: p.y }))
  };
}

/**
 * Deriva un `BuildingInput` multi-losa desde el dibujo 2D (vigas, columnas, losas).
 */
export function deriveBuildingModel(
  state: DrawingState
): DeriveBuildingModelResult | DeriveBuildingModelError {
  const slabs = state.entities.slabs;
  if (slabs.length === 0) {
    return { error: 'El dibujo no contiene losas. Dibuje al menos una losa en el paso 2.' };
  }

  const slabInputs: BuildingInput['slabs'] = [];
  for (const slab of slabs) {
    const mapped = slabToInput(slab);
    if ('error' in mapped) return mapped;
    slabInputs.push(mapped);
  }

  const warnings: string[] = [];
  const beamsDrawn = state.entities.beams;
  const columnsDrawn = state.entities.columns;

  const beamSection = beamsDrawn[0]
    ? { widthM: beamsDrawn[0].widthM, depthM: beamsDrawn[0].depthM }
    : { widthM: 0.25, depthM: 0.5 };
  const columnSection = columnsDrawn[0]
    ? { widthM: columnsDrawn[0].widthM, depthM: columnsDrawn[0].depthM }
    : { widthM: 0.35, depthM: 0.35 };

  let beamOutputs: BuildingInput['beams'];

  if (beamsDrawn.length > 0) {
    beamOutputs = beamsDrawn.map((b) => {
      const contributions = associateBeamWithSlabs(b, slabs);
      if (contributions.length === 0) {
        warnings.push(`Viga ${b.id}: sin losa asociada (revisar ubicación en planta).`);
      }
      return {
        id: b.id,
        spanM: Math.max(0.5, beamSpanM(b)),
        widthM: b.widthM,
        depthM: b.depthM,
        slabContributions: contributions,
        x1: b.x1,
        y1: b.y1,
        x2: b.x2,
        y2: b.y2
      };
    });
  } else {
    const maxSpanX = Math.max(...slabInputs.map((s) => s.spanXm));
    const maxSpanY = Math.max(...slabInputs.map((s) => s.spanYm));
    const twX = Math.max(0.4, maxSpanY / 2);
    const twY = Math.max(0.4, maxSpanX / 2);
    const defaultSlabId = slabInputs[0]!.id;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const slab of slabInputs) {
      const pts =
        slab.points && slab.points.length >= 3
          ? slab.points
          : [
              { x: -slab.spanXm / 2, y: -slab.spanYm / 2 },
              { x: slab.spanXm / 2, y: -slab.spanYm / 2 },
              { x: slab.spanXm / 2, y: slab.spanYm / 2 },
              { x: -slab.spanXm / 2, y: slab.spanYm / 2 }
            ];
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
    if (!Number.isFinite(minX)) {
      minX = -maxSpanX / 2;
      maxX = maxSpanX / 2;
      minY = -maxSpanY / 2;
      maxY = maxSpanY / 2;
    }

    beamOutputs = [
      {
        id: 'beam-1',
        spanM: maxSpanX,
        widthM: beamSection.widthM,
        depthM: beamSection.depthM,
        slabContributions: [{ slabId: defaultSlabId, tributaryWidthM: twX }],
        x1: minX,
        y1: minY,
        x2: maxX,
        y2: minY
      },
      {
        id: 'beam-2',
        spanM: maxSpanX,
        widthM: beamSection.widthM,
        depthM: beamSection.depthM,
        slabContributions: [{ slabId: defaultSlabId, tributaryWidthM: twX }],
        x1: minX,
        y1: maxY,
        x2: maxX,
        y2: maxY
      },
      {
        id: 'beam-3',
        spanM: maxSpanY,
        widthM: beamSection.widthM,
        depthM: beamSection.depthM,
        slabContributions: [{ slabId: defaultSlabId, tributaryWidthM: twY }],
        x1: minX,
        y1: minY,
        x2: minX,
        y2: maxY
      },
      {
        id: 'beam-4',
        spanM: maxSpanY,
        widthM: beamSection.widthM,
        depthM: beamSection.depthM,
        slabContributions: [{ slabId: defaultSlabId, tributaryWidthM: twY }],
        x1: maxX,
        y1: minY,
        x2: maxX,
        y2: maxY
      }
    ];
    warnings.push('No hay vigas en el dibujo; se generó emparrillado 4+4 por defecto.');
  }

  let columnOutputs: BuildingInput['columns'];
  if (columnsDrawn.length > 0) {
    columnOutputs = columnsDrawn.map((c) => ({
      id: c.id,
      cx: c.cx,
      cy: c.cy,
      widthM: c.widthM,
      depthM: c.depthM,
      floors: 2,
      momentKnm: undefined
    }));
  } else {
    columnOutputs = [1, 2, 3, 4].map((n) => ({
      id: `column-${n}`,
      widthM: columnSection.widthM,
      depthM: columnSection.depthM,
      floors: 2
    }));
    warnings.push('No hay columnas en el dibujo; se usaron 4 columnas esquineras por defecto.');
  }

  return {
    model: {
      slabs: slabInputs,
      beams: beamOutputs,
      columns: columnOutputs,
      materials: { ...DEFAULT_MATERIALS }
    },
    source: 'derived_from_drawing',
    warnings
  };
}

/** @deprecated Usar `deriveBuildingModel`. */
export interface SimplifiedFallback {
  spanX: number;
  spanY: number;
  thicknessM: number;
  deadLoadKnm2: number;
  liveLoadKnm2: number;
}

/** @deprecated Usar `deriveBuildingModel`. */
export function deriveSimplifiedModel(state: DrawingState, fallback: SimplifiedFallback) {
  const patched: DrawingState = structuredClone(state);
  if (patched.entities.slabs.length === 0) {
    const slabId = 'fallback-slab';
    const twX = fallback.spanY / 2;
    const twY = fallback.spanX / 2;
    return {
      slab: {
        id: slabId,
        spanXm: fallback.spanX,
        spanYm: fallback.spanY,
        areaM2: fallback.spanX * fallback.spanY,
        thicknessM: fallback.thicknessM,
        deadLoadKnm2: fallback.deadLoadKnm2,
        liveLoadKnm2: fallback.liveLoadKnm2,
        loadTypologyCode: 'CUSTOM'
      },
      slabs: [
        {
          id: slabId,
          spanXm: fallback.spanX,
          spanYm: fallback.spanY,
          areaM2: fallback.spanX * fallback.spanY,
          thicknessM: fallback.thicknessM,
          deadLoadKnm2: fallback.deadLoadKnm2,
          liveLoadKnm2: fallback.liveLoadKnm2,
          loadTypologyCode: 'CUSTOM'
        }
      ],
      beams: [
        {
          spanM: fallback.spanX,
          widthM: 0.25,
          depthM: 0.5,
          slabContributions: [{ slabId, tributaryWidthM: twX }]
        },
        {
          spanM: fallback.spanX,
          widthM: 0.25,
          depthM: 0.5,
          slabContributions: [{ slabId, tributaryWidthM: twX }]
        },
        {
          spanM: fallback.spanY,
          widthM: 0.25,
          depthM: 0.5,
          slabContributions: [{ slabId, tributaryWidthM: twY }]
        },
        {
          spanM: fallback.spanY,
          widthM: 0.25,
          depthM: 0.5,
          slabContributions: [{ slabId, tributaryWidthM: twY }]
        }
      ],
      columns: [
        { widthM: 0.35, depthM: 0.35, floors: 2 },
        { widthM: 0.35, depthM: 0.35, floors: 2 },
        { widthM: 0.35, depthM: 0.35, floors: 2 },
        { widthM: 0.35, depthM: 0.35, floors: 2 }
      ],
      materials: { ...DEFAULT_MATERIALS },
      source: 'fixed_mvp_rectangular' as const
    };
  }
  for (const slab of patched.entities.slabs) {
    if (!slab.props.loadTypologyCode) {
      slab.props = {
        ...slab.props,
        loadTypologyCode: 'RES_1_2_FAM',
        deadLoadKnm2: fallback.deadLoadKnm2,
        liveLoadOverrideKnm2: fallback.liveLoadKnm2
      };
    }
  }
  const derived = deriveBuildingModel(patched);
  if ('error' in derived) {
    throw new Error(derived.error);
  }
  const first = derived.model.slabs[0];
  return {
    slab: first,
    slabs: derived.model.slabs,
    beams: derived.model.beams,
    columns: derived.model.columns,
    materials: derived.model.materials,
    source: derived.source
  };
}
