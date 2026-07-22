import { normalizeBuildingInput, type BuildingInput } from '@nodouno/calc';
import type { CalcPipelineResults } from './technicalPanel';

/** Reconstruye resultados de cálculo persistidos, incluyendo formatos legacy. */
export function hydratePipelineResults(
  calculations: unknown,
  dimensioning: unknown,
  simplifiedModel: BuildingInput | null
): CalcPipelineResults | null {
  if (!calculations || typeof calculations !== 'object') return null;
  const calc = calculations as Record<string, unknown>;
  const loadsRaw = calc.loads as Record<string, unknown> | undefined;
  const demandsRaw = calc.demands as Record<string, unknown> | undefined;
  if (!loadsRaw || !demandsRaw || !dimensioning) return null;

  const model = simplifiedModel ? normalizeBuildingInput(simplifiedModel) : null;

  const loads = loadsRaw as CalcPipelineResults['calculations']['loads'];
  if (!Array.isArray(loads.beams) && Array.isArray(loadsRaw.beamLineLoadsKnm) && model) {
    loads.beams = loadsRaw.beamLineLoadsKnm.map((q, i) => ({
      elementId: model.beams[i]?.id ?? `beam-${i + 1}`,
      elementType: 'beam' as const,
      lineLoadKnm: Number(q)
    }));
  }
  if (!Array.isArray(loads.columns) && Array.isArray(loadsRaw.columnAxialLoadsKn) && model) {
    loads.columns = loadsRaw.columnAxialLoadsKn.map((pu, i) => ({
      elementId: model.columns[i]?.id ?? `column-${i + 1}`,
      elementType: 'column' as const,
      axialLoadKn: Number(pu)
    }));
  }

  return {
    calculations: {
      loads,
      demands: demandsRaw as CalcPipelineResults['calculations']['demands']
    },
    dimensioning: dimensioning as CalcPipelineResults['dimensioning']
  };
}
