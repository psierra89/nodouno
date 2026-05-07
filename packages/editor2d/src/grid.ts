import type { CameraState } from './types';
import { getViewportBounds } from './camera';

export interface GridStyle {
  /** Color de lineas menores (cada 0.1 m). */
  minor: string;
  /** Color de lineas mayores (cada 1.0 m). */
  major: string;
  /** Color del eje (origen). */
  axis: string;
}

const DEFAULT_STYLE: GridStyle = {
  minor: '#ececef',
  major: '#cdcdd2',
  axis: '#8e8e95'
};

const MAX_LINES_PER_AXIS = 4000;

/**
 * Dibuja la grilla CAD (menor 0.1 m / mayor 1.0 m) sobre el contexto en coordenadas de pantalla.
 * Oculta lineas menores cuando estan a menos de ~6 px en pantalla.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  cam: CameraState,
  viewW: number,
  viewH: number,
  options?: { gridSizeM?: number; majorEvery?: number; style?: Partial<GridStyle> }
) {
  const minorM = Math.max(0.001, options?.gridSizeM ?? 0.1);
  const majorM = options?.majorEvery ? minorM * options.majorEvery : 1.0;
  const style: GridStyle = { ...DEFAULT_STYLE, ...(options?.style ?? {}) };
  const view = getViewportBounds(cam, viewW, viewH);

  const minorPx = minorM * cam.zoom;
  const showMinor = minorPx >= 6;

  const drawAxisLines = (stepM: number, color: string) => {
    const stepPx = stepM * cam.zoom;
    if (stepPx <= 0.5) return;
    const pad = 1;
    const startIdxX = Math.floor((view.minX - pad) / stepM);
    const endIdxX = Math.ceil((view.maxX + pad) / stepM);
    const startIdxY = Math.floor((view.minY - pad) / stepM);
    const endIdxY = Math.ceil((view.maxY + pad) / stepM);
    if (endIdxX - startIdxX > MAX_LINES_PER_AXIS) return;
    if (endIdxY - startIdxY > MAX_LINES_PER_AXIS) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = startIdxX; i <= endIdxX; i++) {
      const xWorld = i * stepM;
      const sx = (xWorld - cam.x) * cam.zoom + viewW / 2;
      const px = Math.round(sx) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, viewH);
    }
    for (let i = startIdxY; i <= endIdxY; i++) {
      const yWorld = i * stepM;
      const sy = (yWorld - cam.y) * cam.zoom + viewH / 2;
      const py = Math.round(sy) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(viewW, py);
    }
    ctx.stroke();
  };

  if (showMinor) drawAxisLines(minorM, style.minor);
  drawAxisLines(majorM, style.major);

  ctx.strokeStyle = style.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const sxAxis = (0 - cam.x) * cam.zoom + viewW / 2;
  const syAxis = (0 - cam.y) * cam.zoom + viewH / 2;
  if (sxAxis >= 0 && sxAxis <= viewW) {
    const px = Math.round(sxAxis) + 0.5;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, viewH);
  }
  if (syAxis >= 0 && syAxis <= viewH) {
    const py = Math.round(syAxis) + 0.5;
    ctx.moveTo(0, py);
    ctx.lineTo(viewW, py);
  }
  ctx.stroke();
}
