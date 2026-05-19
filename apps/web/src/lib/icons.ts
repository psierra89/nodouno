/** Iconos monocromo estilo stroke (inspirados en Lucide / SVG Repo). */
export type IconName =
  | 'arrow-right'
  | 'boxes'
  | 'calculator'
  | 'check'
  | 'chevron-left'
  | 'chevron-right'
  | 'download'
  | 'eraser'
  | 'folder-open'
  | 'hand'
  | 'help-circle'
  | 'layout-dashboard'
  | 'line-diagonal'
  | 'log-in'
  | 'log-out'
  | 'maximize'
  | 'minus'
  | 'mouse-pointer'
  | 'pentagon'
  | 'pencil-ruler'
  | 'plus'
  | 'redo'
  | 'save'
  | 'square'
  | 'trash'
  | 'undo'
  | 'weight'
  | 'x'
  | 'zoom-in'
  | 'zoom-out';

const PATHS: Record<IconName, string> = {
  'arrow-right':
    '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  boxes:
    '<path d="M21 8v13H3V8"/><path d="m1 8 10-5 10 5"/><path d="M11 3v10"/><path d="M7 12h8"/>',
  calculator:
    '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  eraser:
    '<path d="m7 21-4-4a2 2 0 0 1 0-2.8l9.6-9.6a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8L11 21"/><path d="m22 2-7.5 7.5"/><path d="m15 9 6 6"/>',
  'folder-open':
    '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  hand:
    '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-2.83-2.83a2 2 0 0 1 2.83-2.83l.79.79"/>',
  'help-circle':
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  'layout-dashboard':
    '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  'line-diagonal': '<path d="M5 19 19 5"/>',
  'log-in':
    '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>',
  'log-out':
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  maximize:
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  minus: '<path d="M5 12h14"/>',
  'mouse-pointer':
    '<path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/>',
  pentagon:
    '<path d="M12 2 20 8.5V16l-8 6-8-6V8.5z"/>',
  'pencil-ruler':
    '<path d="m13 5 8 8-4 4-8-8 4-4z"/><path d="m2 22 5.5-1.5L16 12"/><path d="M22 2 11 13"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>',
  save:
    '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  square: '<rect x="3" y="3" width="18" height="18" rx="2"/>',
  trash:
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 11"/>',
  weight:
    '<path d="M6 3h12l4 7H2z"/><path d="M12 10v11"/><path d="M8 21h8"/><circle cx="12" cy="14" r="2"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'zoom-in':
    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>',
  'zoom-out':
    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>'
};

export function iconSvg(name: IconName, size = 20): string {
  const paths = PATHS[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const iconButtonClass =
  'inline-flex items-center justify-center rounded-full border border-obsidian bg-canvas-white transition-colors disabled:cursor-not-allowed disabled:opacity-45';

export const iconButtonSizes = {
  md: 'h-[46px] w-[46px]',
  sm: 'h-[40px] w-[40px]',
  cad: 'h-[44px] w-[44px]'
} as const;

/** Botón solo icono para plantillas HTML dinámicas (dashboard). */
export function iconButtonHtml(
  icon: IconName,
  label: string,
  extraClass = '',
  attrs: Record<string, string> = {}
): string {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `<button type="button" class="${iconButtonClass} ${iconButtonSizes.md} ${extraClass}" title="${label}" aria-label="${label}" ${attrStr}>${iconSvg(icon)}</button>`;
}
