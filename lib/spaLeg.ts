export type SpaLegFilter = 'All' | 'Spartans' | 'Legacy';

/**
 * Normalizes SPA/LEG values from the roster / computed rows.
 * Accepts variants like: 'SPA', 'Spartan', 'Spartans', 'SPARTAN', 'LEG', 'Legacy', etc.
 */
export const spaLegKey = (v?: unknown): '' | 'spartan' | 'legacy' => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  if (s.startsWith('spa') || s.includes('spartan')) return 'spartan';
  if (s.startsWith('leg') || s.includes('legacy')) return 'legacy';
  return '';
};

export const matchesSpaLegFilter = (v: unknown, filter: SpaLegFilter): boolean => {
  if (filter === 'All') return true;
  const key = spaLegKey(v);
  if (!key) return false;
  return filter === 'Spartans' ? key === 'spartan' : key === 'legacy';
};
