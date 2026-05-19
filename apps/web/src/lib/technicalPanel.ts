import { normalizeBuildingInput } from '@nodouno/calc';
import type { BuildingInput, ElementType } from '@nodouno/calc';
import type { DemandResult, DesignResult, LoadResult } from '@nodouno/calc';

export interface CalcPipelineResults {
  calculations: {
    loads: LoadResult;
    demands: DemandResult;
  };
  dimensioning: DesignResult;
}

const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');

function findSlab(model: BuildingInput, id: string): SlabInput | undefined {
  return model.slabs.find((s) => s.id === id);
}

function findBeam(model: BuildingInput, id: string): BeamInput | undefined {
  return model.beams.find((b) => (b.id ?? '') === id || b.id === id);
}

function findColumn(model: BuildingInput, id: string): ColumnInput | undefined {
  return model.columns.find((c) => (c.id ?? '') === id || c.id === id);
}

function beamByIndex(model: BuildingInput, id: string): BeamInput | undefined {
  const idx = Number(id.replace(/^beam-/, '')) - 1;
  if (Number.isFinite(idx) && idx >= 0) return model.beams[idx];
  return findBeam(model, id);
}

function columnByIndex(model: BuildingInput, id: string): ColumnInput | undefined {
  const idx = Number(id.replace(/^column-/, '')) - 1;
  if (Number.isFinite(idx) && idx >= 0) return model.columns[idx];
  return findColumn(model, id);
}

function diagramSvg(
  kind: 'moment' | 'shear' | 'load',
  values: { max: number; min?: number },
  label: string
): string {
  const max = Math.max(Math.abs(values.max), Math.abs(values.min ?? 0), 1e-6);
  const h = 56;
  const w = 220;
  const mid = h / 2;
  const scale = (h * 0.4) / max;
  const peak = values.max * scale;
  const dip = (values.min ?? 0) * scale;
  let path = '';
  if (kind === 'load') {
    path = `M 8 ${mid} L ${w - 8} ${mid} M 24 ${mid - 14} L 24 ${mid + 14} M ${w - 24} ${mid - 14} L ${w - 24} ${mid + 14}`;
    for (let x = 32; x < w - 32; x += 18) {
      path += ` M ${x} ${mid} L ${x} ${mid - 12}`;
    }
  } else if (kind === 'moment') {
    path = `M 8 ${mid} Q ${w / 2} ${mid - peak} ${w - 8} ${mid}`;
  } else {
    path = `M 8 ${mid} L ${w / 2} ${mid - peak} L ${w / 2} ${mid + dip} L ${w - 8} ${mid}`;
  }
  return `
    <figure class="tech-diagram">
      <figcaption class="text-body-sm font-bold text-obsidian">${label}</figcaption>
      <svg viewBox="0 0 ${w} ${h}" class="mt-8 w-full max-w-[240px]" aria-hidden="true">
        <line x1="8" y1="${mid}" x2="${w - 8}" y2="${mid}" stroke="#000d10" stroke-width="1" opacity="0.25"/>
        <path d="${path}" fill="none" stroke="#bc7155" stroke-width="2"/>
      </svg>
      <p class="mt-4 text-body-sm text-slate-mist tabular-nums">máx ≈ ${fmt(values.max)}</p>
    </figure>`;
}

function sectionSvg(
  bMm: number,
  hMm: number,
  rho: number,
  bars: number,
  title: string
): string {
  const w = 120;
  const h = 100;
  const pad = 12;
  const bw = w - pad * 2;
  const bh = h - pad * 2;
  const barR = Math.max(2, Math.min(5, bw * 0.06));
  const n = Math.min(Math.max(bars, 2), 8);
  let circles = '';
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const cx = pad + barR + t * (bw - barR * 2);
    const cy = h - pad - barR - 4;
    circles += `<circle cx="${cx}" cy="${cy}" r="${barR}" fill="#bc7155"/>`;
  }
  return `
    <figure class="tech-diagram">
      <figcaption class="text-body-sm font-bold text-obsidian">${title}</figcaption>
      <svg viewBox="0 0 ${w} ${h}" class="mt-8 w-full max-w-[140px]" aria-hidden="true">
        <rect x="${pad}" y="${pad}" width="${bw}" height="${bh}" fill="#f0f0f0" stroke="#000d10" stroke-width="1.5"/>
        ${circles}
      </svg>
      <p class="mt-4 text-body-sm text-slate-mist tabular-nums">${bMm}×${hMm} mm · ρ=${fmt(rho, 4)}</p>
    </figure>`;
}

function renderBeamPanel(
  model: BuildingInput,
  results: CalcPipelineResults,
  elementId: string
): string {
  const beam = beamByIndex(model, elementId);
  if (!beam) return '<p class="text-slate-mist">Viga no encontrada en el modelo.</p>';
  const load = results.calculations.loads.beams.find((b) => b.elementId === elementId);
  const demand = results.calculations.demands.beams.find((b) => b.elementId === elementId);
  const design = results.dimensioning.beams.find((b) => b.elementId === elementId);
  const q = load?.lineLoadKnm ?? 0;
  const L = beam.spanM;
  const bMm = Math.round(beam.widthM * 1000);
  const hMm = Math.round(beam.depthM * 1000);

  return `
    <header>
      <h4 class="text-subheading leading-subheading tracking-subheading">Viga</h4>
      <p class="mt-4 text-body-sm text-slate-mist">ID ${elementId.slice(-8)}</p>
    </header>
    <dl class="mt-16 grid grid-cols-2 gap-8 text-body-sm tabular-nums">
      <div><dt class="text-slate-mist">b×h</dt><dd class="font-bold">${fmt(beam.widthM)}×${fmt(beam.depthM)} m</dd></div>
      <div><dt class="text-slate-mist">Luz</dt><dd class="font-bold">${fmt(L)} m</dd></div>
      <div><dt class="text-slate-mist">q<sub>últ</sub></dt><dd class="font-bold">${fmt(q)} kN/m</dd></div>
    </dl>
    <div class="mt-16 grid gap-16 sm:grid-cols-2">
      ${diagramSvg('load', { max: q }, 'Carga distribuida q')}
      ${diagramSvg('moment', { max: demand?.MuKnm ?? 0 }, 'Momento M')}
      ${diagramSvg('shear', { max: demand?.VuKn ?? 0, min: -(demand?.VuKn ?? 0) }, 'Corte V')}
      ${sectionSvg(bMm, hMm, design?.flexion.rhoUsed ?? 0, 4, 'Sección armada')}
    </div>
    <p class="mt-16 text-body-sm text-slate-mist">
      Estribos: ${design?.shear.needsStirrups ? `sí (s≤${fmt(design.shear.sMaxMm, 0)} mm)` : 'no requeridos'} ·
      ductilidad: ${design?.flexion.isDuctile ? 'OK' : 'revisar ρ'}
    </p>`;
}

function renderSlabPanel(
  model: BuildingInput,
  results: CalcPipelineResults,
  elementId: string
): string {
  const slab = findSlab(model, elementId);
  if (!slab) return '<p class="text-slate-mist">Losa no encontrada en el modelo.</p>';
  const load = results.calculations.loads.slabs.find((s) => s.elementId === elementId);
  const demand = results.calculations.demands.slabs.find((s) => s.elementId === elementId);
  const design = results.dimensioning.slabs.find((s) => s.elementId === elementId);
  const short = Math.min(slab.spanXm, slab.spanYm);
  const long = Math.max(slab.spanXm, slab.spanYm);

  return `
    <header>
      <h4 class="text-subheading leading-subheading tracking-subheading">Losa</h4>
      <p class="mt-4 text-body-sm text-slate-mist">ID ${elementId.slice(-8)} · ${fmt(slab.areaM2, 1)} m²</p>
    </header>
    <dl class="mt-16 grid grid-cols-2 gap-8 text-body-sm tabular-nums">
      <div><dt class="text-slate-mist">Espesor</dt><dd class="font-bold">${fmt(slab.thicknessM)} m</dd></div>
      <div><dt class="text-slate-mist">Luces</dt><dd class="font-bold">${fmt(short)} / ${fmt(long)} m</dd></div>
      <div><dt class="text-slate-mist">D / L</dt><dd class="font-bold">${fmt(load?.D ?? 0)} / ${fmt(load?.L ?? 0)} kN/m²</dd></div>
      <div><dt class="text-slate-mist">q<sub>últ</sub></dt><dd class="font-bold">${fmt(load?.qu ?? 0)} kN/m²</dd></div>
    </dl>
    <div class="mt-16 grid gap-16 sm:grid-cols-2">
      ${diagramSvg('load', { max: load?.qu ?? 0 }, 'Carga superficial')}
      ${diagramSvg('moment', { max: demand?.MuKnmPerM ?? 0 }, 'Momento (franja 1 m)')}
      ${sectionSvg(1000, Math.round(slab.thicknessM * 1000), design?.rhoUsed ?? 0, 6, 'Armado franja 1 m')}
    </div>
    <p class="mt-16 text-body-sm text-slate-mist">
      Tipología: ${slab.loadTypologyCode} · ρ usado: ${fmt(design?.rhoUsed ?? 0, 4)}
    </p>`;
}

function renderColumnPanel(
  model: BuildingInput,
  results: CalcPipelineResults,
  elementId: string
): string {
  const col = columnByIndex(model, elementId);
  if (!col) return '<p class="text-slate-mist">Columna no encontrada en el modelo.</p>';
  const load = results.calculations.loads.columns.find((c) => c.elementId === elementId);
  const demand = results.calculations.demands.columns.find((c) => c.elementId === elementId);
  const design = results.dimensioning.columns.find((c) => c.elementId === elementId);
  const storyH = col.floors * 3;
  const bMm = Math.round(col.widthM * 1000);
  const hMm = Math.round(col.depthM * 1000);

  return `
    <header>
      <h4 class="text-subheading leading-subheading tracking-subheading">Columna</h4>
      <p class="mt-4 text-body-sm text-slate-mist">ID ${elementId.slice(-8)}</p>
    </header>
    <dl class="mt-16 grid grid-cols-2 gap-8 text-body-sm tabular-nums">
      <div><dt class="text-slate-mist">b×h</dt><dd class="font-bold">${fmt(col.widthM)}×${fmt(col.depthM)} m</dd></div>
      <div><dt class="text-slate-mist">Altura piso</dt><dd class="font-bold">≈ ${fmt(storyH)} m (${col.floors} pisos)</dd></div>
      <div><dt class="text-slate-mist">P<sub>u</sub></dt><dd class="font-bold">${fmt(load?.axialLoadKn ?? demand?.PuKn ?? 0)} kN</dd></div>
      <div><dt class="text-slate-mist">M<sub>u</sub></dt><dd class="font-bold">${fmt(demand?.MuKnm ?? 0)} kN·m</dd></div>
    </dl>
    <div class="mt-16 grid gap-16 sm:grid-cols-2">
      ${diagramSvg('load', { max: load?.axialLoadKn ?? 0 }, 'Carga axial')}
      ${sectionSvg(bMm, hMm, design?.rhoGeomMin ?? 0.01, design?.minBars ?? 4, 'Sección armada')}
    </div>
    <p class="mt-16 text-body-sm text-slate-mist">
      ρ geom ${fmt(design?.rhoGeomMin ?? 0, 3)}–${fmt(design?.rhoGeomMax ?? 0, 3)} ·
      mín. ${design?.minBars ?? 4} barras ·
      interacción P-M: ${design?.interactionChecked ? 'verificada' : 'axial dominante'}
    </p>`;
}

/**
 * Renderiza el panel técnico derecho (HTML) para el elemento seleccionado.
 */
export function renderTechnicalPanel(
  container: HTMLElement,
  model: BuildingInput | Record<string, unknown> | null,
  results: CalcPipelineResults | null,
  elementId: string | null,
  elementType: ElementType | null
): void {
  if (!elementId || !elementType) {
    container.innerHTML = `
      <p class="text-slate-mist">
        Seleccione un elemento en la vista 3D (viga, columna o losa) para ver cargas, solicitaciones y armado.
      </p>`;
    return;
  }
  if (!model || !results) {
    container.innerHTML = `
      <p class="text-slate-mist">
        Ejecute el cálculo para ver el panel técnico del elemento seleccionado.
      </p>`;
    return;
  }

  const normalized = normalizeBuildingInput(model);
  let html = '';
  if (elementType === 'beam') html = renderBeamPanel(normalized, results, elementId);
  else if (elementType === 'slab') html = renderSlabPanel(normalized, results, elementId);
  else if (elementType === 'column') html = renderColumnPanel(normalized, results, elementId);
  else html = '<p class="text-slate-mist">Tipo de elemento no soportado.</p>';

  container.innerHTML = `<div class="tech-panel grid gap-11">${html}</div>`;
}
