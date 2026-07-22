import type { BuildingInput } from '@nodouno/calc';
import type { ProjectSpecs } from '@nodouno/shared';
import { jsPDF } from 'jspdf';
import type { CalcPipelineResults } from './technicalPanel';

export type TechnicalReportInput = {
  projectName: string;
  exportedAt?: string;
  specs: ProjectSpecs;
  model: BuildingInput | null;
  results: CalcPipelineResults | null;
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

export function buildTechnicalReportPdf(input: TechnicalReportInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Informe técnico — Nodouno', 14, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = addLine(doc, `Proyecto: ${input.projectName}`, y);
  y = addLine(doc, `Exportado: ${new Date(exportedAt).toLocaleString()}`, y);
  y = addLine(doc, `Normativa: ${input.specs.regulation}`, y);
  y = addLine(doc, `Hormigón: ${input.specs.concrete} · Acero: ${input.specs.steel}`, y);
  y += 4;

  y = addSectionTitle(doc, 'Resumen del modelo', y);
  if (!input.model) {
    y = addLine(doc, 'Modelo simplificado no disponible.', y);
  } else {
    y = addLine(doc, `Losas: ${input.model.slabs.length}`, y);
    y = addLine(doc, `Vigas: ${input.model.beams.length}`, y);
    y = addLine(doc, `Columnas: ${input.model.columns.length}`, y);
    y = addLine(
      doc,
      `Materiales: fck=${fmt(input.model.materials.fckMpa)} MPa · fy=${fmt(input.model.materials.fyMpa)} MPa`,
      y
    );
  }
  y += 4;

  y = addSectionTitle(doc, 'Cargas y solicitaciones', y);
  if (!input.results) {
    y = addLine(doc, 'Sin resultados de cálculo. Ejecute el pipeline antes de exportar.', y);
  } else {
    const { loads, demands } = input.results.calculations;
    for (const slab of loads.slabs.slice(0, 12)) {
      y = addLine(
        doc,
        `Losa ${slab.elementId.slice(-6)}: D=${fmt(slab.D)} · L=${fmt(slab.L)} · qu=${fmt(slab.qu)} kN/m²`,
        y
      );
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
    }
    for (const beam of demands.beams.slice(0, 12)) {
      y = addLine(
        doc,
        `Viga ${beam.elementId.slice(-6)}: Mu=${fmt(beam.MuKnm)} kN·m · Vu=${fmt(beam.VuKn)} kN`,
        y
      );
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
    }
    for (const column of demands.columns.slice(0, 12)) {
      y = addLine(
        doc,
        `Columna ${column.elementId.slice(-6)}: Pu=${fmt(column.PuKn)} kN · Mu=${fmt(column.MuKnm)} kN·m`,
        y
      );
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
    }
  }
  y += 4;

  y = addSectionTitle(doc, 'Dimensionamiento', y);
  if (!input.results) {
    y = addLine(doc, 'Sin dimensionamiento disponible.', y);
  } else {
    const { dimensioning } = input.results;
    for (const slab of dimensioning.slabs.slice(0, 12)) {
      y = addLine(
        doc,
        `Losa ${slab.elementId.slice(-6)}: ρ=${fmt(slab.rhoUsed, 4)} · ρmin=${fmt(slab.rhoMin, 4)}`,
        y
      );
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
    }
    for (const beam of dimensioning.beams.slice(0, 12)) {
      y = addLine(
        doc,
        `Viga ${beam.elementId.slice(-6)}: ρ=${fmt(beam.flexion.rhoUsed, 4)} · estribos=${beam.shear.needsStirrups ? 'sí' : 'no'}`,
        y
      );
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
    }
    for (const column of dimensioning.columns.slice(0, 12)) {
      y = addLine(
        doc,
        `Columna ${column.elementId.slice(-6)}: barras mín=${column.minBars} · interacción=${column.interactionChecked ? 'ok' : 'pendiente'}`,
        y
      );
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Informe generado automáticamente por Nodouno (MVP).', 14, 287);
  doc.setTextColor(0);
  return doc;
}

export function downloadTechnicalReportPdf(input: TechnicalReportInput) {
  const doc = buildTechnicalReportPdf(input);
  const safeName = input.projectName.trim().replace(/\s+/g, '-').toLowerCase() || 'proyecto';
  doc.save(`${safeName}-informe-tecnico.pdf`);
}
