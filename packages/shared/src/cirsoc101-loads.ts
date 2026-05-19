/** Subset curado de CIRSOC 101 — Tabla 4.1 (cargas vivas). */
export type LoadTypologyCode =
  | 'RES_1_2_FAM'
  | 'RES_MULTIFAM'
  | 'CORRIDOR_PB'
  | 'CORRIDOR_UPPER'
  | 'OFFICE'
  | 'RETAIL_GF'
  | 'RETAIL_UPPER'
  | 'RESTAURANT'
  | 'SCHOOL_CLASS'
  | 'STORAGE_LIGHT'
  | 'STORAGE_HEAVY'
  | 'ROOF_ACCESSIBLE'
  | 'ROOF_INACCESSIBLE'
  | 'BALCONY_RES'
  | 'BATHROOM_RES'
  | 'KITCHEN_OTHER'
  | 'GYM'
  | 'PARKING'
  | 'MACHINE_ROOM'
  | 'CUSTOM';

export type LoadTypologyGroup =
  | 'residencial'
  | 'comercial'
  | 'institucional'
  | 'circulacion'
  | 'deposito'
  | 'cubierta'
  | 'otros';

export interface LoadTypology {
  code: LoadTypologyCode;
  label: string;
  /** Carga viva Tabla 4.1 (kN/m²). `null` si requiere override manual. */
  liveLoadKnm2: number | null;
  group: LoadTypologyGroup;
  notes?: string;
}

export const CIRSOC_101_LOAD_TYPOLOGIES: readonly LoadTypology[] = [
  { code: 'RES_1_2_FAM', label: 'Vivienda 1–2 familias', liveLoadKnm2: 2, group: 'residencial' },
  { code: 'RES_MULTIFAM', label: 'Deptos / multifamiliar', liveLoadKnm2: 2, group: 'residencial' },
  { code: 'CORRIDOR_PB', label: 'Corredor planta baja', liveLoadKnm2: 5, group: 'circulacion' },
  { code: 'CORRIDOR_UPPER', label: 'Corredor pisos superiores', liveLoadKnm2: 4, group: 'circulacion' },
  { code: 'OFFICE', label: 'Oficinas', liveLoadKnm2: 2.5, group: 'comercial' },
  { code: 'RETAIL_GF', label: 'Comercio planta baja', liveLoadKnm2: 6, group: 'comercial' },
  { code: 'RETAIL_UPPER', label: 'Comercio pisos superiores', liveLoadKnm2: 4, group: 'comercial' },
  { code: 'RESTAURANT', label: 'Restaurante / comedor', liveLoadKnm2: 5, group: 'comercial' },
  { code: 'SCHOOL_CLASS', label: 'Aula escolar', liveLoadKnm2: 3, group: 'institucional' },
  { code: 'STORAGE_LIGHT', label: 'Depósito liviano', liveLoadKnm2: 6, group: 'deposito' },
  { code: 'STORAGE_HEAVY', label: 'Depósito pesado', liveLoadKnm2: 12, group: 'deposito' },
  { code: 'ROOF_ACCESSIBLE', label: 'Azotea con personas', liveLoadKnm2: 5, group: 'cubierta' },
  { code: 'ROOF_INACCESSIBLE', label: 'Azotea inaccesible', liveLoadKnm2: 1, group: 'cubierta' },
  { code: 'BALCONY_RES', label: 'Balcón vivienda', liveLoadKnm2: 5, group: 'residencial' },
  { code: 'BATHROOM_RES', label: 'Baño vivienda', liveLoadKnm2: 2, group: 'residencial' },
  { code: 'KITCHEN_OTHER', label: 'Cocina otros destinos', liveLoadKnm2: 4, group: 'otros' },
  { code: 'GYM', label: 'Gimnasio', liveLoadKnm2: 5, group: 'institucional' },
  { code: 'PARKING', label: 'Estacionamiento', liveLoadKnm2: 2.5, group: 'otros' },
  { code: 'MACHINE_ROOM', label: 'Cuarto máquinas', liveLoadKnm2: 7.5, group: 'otros' },
  {
    code: 'CUSTOM',
    label: 'Personalizado',
    liveLoadKnm2: null,
    group: 'otros',
    notes: 'Ingrese carga viva manualmente.'
  }
] as const;

const typologyByCode = new Map<LoadTypologyCode, LoadTypology>(
  CIRSOC_101_LOAD_TYPOLOGIES.map((t) => [t.code, t])
);

export function getTypology(code: string | undefined): LoadTypology | undefined {
  if (!code) return undefined;
  return typologyByCode.get(code as LoadTypologyCode);
}

/** Resuelve L (kN/m²) desde catálogo o override (obligatorio para CUSTOM). */
export function liveLoadForTypology(
  code: string | undefined,
  overrideKnm2?: number | null
): number | null {
  const typology = getTypology(code);
  if (!typology) return null;
  if (typology.code === 'CUSTOM') {
    return typeof overrideKnm2 === 'number' && Number.isFinite(overrideKnm2) && overrideKnm2 >= 0
      ? overrideKnm2
      : null;
  }
  return typology.liveLoadKnm2;
}

export function isKnownTypologyCode(code: string | undefined): code is LoadTypologyCode {
  return Boolean(code && typologyByCode.has(code as LoadTypologyCode));
}
