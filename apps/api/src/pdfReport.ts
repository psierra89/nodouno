import { normalizeBuildingInput, type BuildingInput } from '@nodouno/calc';
import {
  calculationsSnapshotSchema,
  dimensioningSnapshotSchema,
  type ProjectSpecs
} from '@nodouno/shared';
import { jsPDF } from 'jspdf';

export type PdfReportInput = {
  projectName: string;
  exportedAt?: string;
  specs: ProjectSpecs;
  simplifiedModel: unknown;
  calculations: unknown;
  dimensioning: unknown;
};

type CalcResults = {
  calculations: {
    loads: {
      slabs: Array<{ elementId: string; D: number; L: number; qu: number }>;
    };
    demands: {
      beams: Array<{ elementId: string; MuKnm: number; VuKn: number }>;
      columns: Array<{ elementId: string; PuKn: number; MuKnm: number }>;
    };
  };
  dimensioning: {
    slabs: Array<{ elementId: string; rhoUsed: number; rhoMin: number }>;
    beams: Array<{
      elementId: string;
      flexion: { rhoUsed: number };
      shear: { needsStirrups: boolean };
    }>;
    columns: Array<{
      elementId: string;
      minBars: number;
      interactionChecked: boolean;
    }>;
  };
};

const fmt = (value: number, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : '—');

function addSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  return y + 8;
}

function addLine(doc: jsPDF, text: string, y: number) {
  doc.text(text, 14, y, { maxWidth: 182 });
  return y + 6;
}

function ensurePage(doc: jsPDF, y: number) {
  if (y <= 270) return y;
  doc.addPage();
  return 18;
}

function parseModel(simplifiedModel: unknown): BuildingInput | null {
  if (simplifiedModel == null) return null;
  try {
    return normalizeBuildingInput(simplifiedModel);
  } catch {
    return null;
  }
}

function parseResults(calculations: unknown, dimensioning: unknown): CalcResults | null {
  const calcParsed = calculationsSnapshotSchema.safeParse(calculations);
  const dimParsed = dimensioningSnapshotSchema.safeParse(dimensioning);
  if (!calcParsed.success || !dimParsed.success) return null;
  return {
    calculations: calcParsed.data as CalcResults['calculations'],
    dimensioning: dimParsed.data as CalcResults['dimensioning']
  };
}

export function buildTechnicalReportPdf(input: PdfReportInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const model = parseModel(input.simplifiedModel);
  const results = parseResults(input.calculations, input.dimensioning);
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Informe tecnico — Nodouno', 14, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = addLine(doc, `Proyecto: ${input.projectName}`, y);
  y = addLine(doc, `Exportado: ${new Date(exportedAt).toLocaleString('es-AR')}`, y);
  y = addLine(doc, `Normativa: ${input.specs.regulation}`, y);
  y = addLine(doc, `Hormigon: ${input.specs.concrete} · Acero: ${input.specs.steel}`, y);
  y += 4;

  y = addSectionTitle(doc, 'Resumen del modelo', y);
  if (!model) {
    y = addLine(doc, 'Modelo simplificado no disponible.', y);
  } else {
    y = addLine(doc, `Losas: ${model.slabs.length}`, y);
    y = addLine(doc, `Vigas: ${model.beams.length}`, y);
    y = addLine(doc, `Columnas: ${model.columns.length}`, y);
    y = addLine(
      doc,
      `Materiales: fck=${fmt(model.materials.fckMpa)} MPa · fy=${fmt(model.materials.fyMpa)} MPa`,
      y
    );
  }
  y += 4;

  y = addSectionTitle(doc, 'Cargas y solicitaciones', y);
  if (!results) {
    y = addLine(doc, 'Sin resultados de calculo. Ejecute el pipeline antes de exportar.', y);
  } else {
    const { loads, demands } = results.calculations;
    for (const slab of loads.slabs.slice(0, 12)) {
      y = ensurePage(doc, y);
      y = addLine(
        doc,
        `Losa ${slab.elementId.slice(-6)}: D=${fmt(slab.D)} · L=${fmt(slab.L)} · qu=${fmt(slab.qu)} kN/m2`,
        y
      );
    }
    for (const beam of demands.beams.slice(0, 12)) {
      y = ensurePage(doc, y);
      y = addLine(
        doc,
        `Viga ${beam.elementId.slice(-6)}: Mu=${fmt(beam.MuKnm)} kN·m · Vu=${fmt(beam.VuKn)} kN`,
        y
      );
    }
    for (const column of demands.columns.slice(0, 12)) {
      y = ensurePage(doc, y);
      y = addLine(
        doc,
        `Columna ${column.elementId.slice(-6)}: Pu=${fmt(column.PuKn)} kN · Mu=${fmt(column.MuKnm)} kN·m`,
        y
      );
    }
  }
  y += 4;

  y = addSectionTitle(doc, 'Dimensionamiento', y);
  if (!results) {
    y = addLine(doc, 'Sin dimensionamiento disponible.', y);
  } else {
    const { dimensioning } = results;
    for (const slab of dimensioning.slabs.slice(0, 12)) {
      y = ensurePage(doc, y);
      y = addLine(
        doc,
        `Losa ${slab.elementId.slice(-6)}: rho=${fmt(slab.rhoUsed, 4)} · rhomin=${fmt(slab.rhoMin, 4)}`,
        y
      );
    }
    for (const beam of dimensioning.beams.slice(0, 12)) {
      y = ensurePage(doc, y);
      y = addLine(
        doc,
        `Viga ${beam.elementId.slice(-6)}: rho=${fmt(beam.flexion.rhoUsed, 4)} · estribos=${beam.shear.needsStirrups ? 'si' : 'no'}`,
        y
      );
    }
    for (const column of dimensioning.columns.slice(0, 12)) {
      y = ensurePage(doc, y);
      y = addLine(
        doc,
        `Columna ${column.elementId.slice(-6)}: barras min=${column.minBars} · interaccion=${column.interactionChecked ? 'ok' : 'pendiente'}`,
        y
      );
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Informe generado por Nodouno API (MVP).', 14, 287);
  doc.setTextColor(0);
  return doc;
}

export function buildTechnicalReportPdfBase64(input: PdfReportInput): {
  filename: string;
  contentBase64: string;
  mimeType: 'application/pdf';
} {
  const doc = buildTechnicalReportPdf(input);
  const safeName = input.projectName.trim().replace(/\s+/g, '-').toLowerCase() || 'proyecto';
  const filename = `${safeName}-informe-tecnico.pdf`;
  const dataUri = doc.output('datauristring');
  const contentBase64 = dataUri.includes(',') ? dataUri.split(',')[1]! : dataUri;
  return {
    filename,
    contentBase64,
    mimeType: 'application/pdf'
  };
}
