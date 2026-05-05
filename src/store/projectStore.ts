import { atom } from 'nanostores';

export const currentStep = atom<'draft' | 'drawn' | 'calculated' | 'dimensioned'>('draft');
