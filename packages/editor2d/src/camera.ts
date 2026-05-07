import type { CameraState } from './types';

export const MIN_ZOOM = 4;
export const MAX_ZOOM = 800;

/** Coordenadas mundiales (m) -> pixeles del canvas (origen top-left). */
export function worldToScreen(cam: CameraState, viewW: number, viewH: number, x: number, y: number) {
  return {
    sx: viewW / 2 + (x - cam.x) * cam.zoom,
    sy: viewH / 2 + (y - cam.y) * cam.zoom
  };
}

/** Pixeles del canvas -> coordenadas mundiales (m). */
export function screenToWorld(cam: CameraState, viewW: number, viewH: number, sx: number, sy: number) {
  return {
    x: cam.x + (sx - viewW / 2) / cam.zoom,
    y: cam.y + (sy - viewH / 2) / cam.zoom
  };
}

/** Devuelve nueva camara aplicando un factor de zoom anclado al cursor. */
export function zoomAtCursor(
  cam: CameraState,
  viewW: number,
  viewH: number,
  sx: number,
  sy: number,
  factor: number
): CameraState {
  const before = screenToWorld(cam, viewW, viewH, sx, sy);
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
  if (newZoom === cam.zoom) return cam;
  const next: CameraState = { x: cam.x, y: cam.y, zoom: newZoom };
  const after = screenToWorld(next, viewW, viewH, sx, sy);
  next.x += before.x - after.x;
  next.y += before.y - after.y;
  return next;
}

/** Aplica desplazamiento (en pixeles de pantalla) a la camara. */
export function panByPixels(cam: CameraState, dxPx: number, dyPx: number): CameraState {
  return { x: cam.x - dxPx / cam.zoom, y: cam.y - dyPx / cam.zoom, zoom: cam.zoom };
}

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Bounds (m) visibles dentro del viewport actual. */
export function getViewportBounds(cam: CameraState, viewW: number, viewH: number): ViewportBounds {
  const halfW = viewW / (2 * cam.zoom);
  const halfH = viewH / (2 * cam.zoom);
  return {
    minX: cam.x - halfW,
    maxX: cam.x + halfW,
    minY: cam.y - halfH,
    maxY: cam.y + halfH
  };
}
