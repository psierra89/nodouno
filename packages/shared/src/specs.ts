export type RegulationCode = 'CIRSOC_201';
export type SteelGrade = 'ADN_420';
export type ConcreteGrade = 'H25' | 'H30' | 'H35';

export interface ProjectSpecs {
  regulation: RegulationCode;
  steel: SteelGrade;
  concrete: ConcreteGrade;
}

export const DEFAULT_PROJECT_SPECS: ProjectSpecs = {
  regulation: 'CIRSOC_201',
  steel: 'ADN_420',
  concrete: 'H30'
};

export const normalizeProjectSpecs = (value: unknown): ProjectSpecs => {
  const obj = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  const regulation = obj?.regulation === 'CIRSOC_201' ? 'CIRSOC_201' : DEFAULT_PROJECT_SPECS.regulation;
  const steel = obj?.steel === 'ADN_420' ? 'ADN_420' : DEFAULT_PROJECT_SPECS.steel;
  const concrete =
    obj?.concrete === 'H25' || obj?.concrete === 'H30' || obj?.concrete === 'H35'
      ? obj.concrete
      : DEFAULT_PROJECT_SPECS.concrete;
  return { regulation, steel, concrete };
};

export const concreteStrengthMpa = (grade: ConcreteGrade): number => {
  if (grade === 'H25') return 25;
  if (grade === 'H35') return 35;
  return 30;
};
