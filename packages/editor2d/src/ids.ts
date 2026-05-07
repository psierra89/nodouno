/**
 * Genera identificadores estables para entidades del editor.
 * Usa `crypto.randomUUID` cuando esta disponible y, si no, recurre a `Math.random` como fallback.
 */
export function nextId(prefix: string): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return `${prefix}_${g.crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
