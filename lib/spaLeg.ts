export type SpaLegFilter = 'All' | 'Spartans' | 'Legacy';

/**
 * Normalizes SPA/LEG values from the roster / computed rows.
 * Accepts variants like: 'SPA', 'Spartan', 'Spartans', 'SPARTAN', 'LEG', 'Legacy', etc.
 */
export const spaLegKey = (v?: unknown): '' | 'spartan' | 'legacy' | 'inactive' => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  if (s.startsWith('ina') || s.includes('inactive') || s.includes('delist')) return 'inactive';
  if (s.startsWith('spa') || s.includes('spartan')) return 'spartan';
  if (s.startsWith('leg') || s.includes('legacy')) return 'legacy';
  return '';
};

export const matchesSpaLegFilter = (v: unknown, filter: SpaLegFilter): boolean => {
  const key = spaLegKey(v);
  // "All" means "all active" (Spartans + Legacy). Inactive should be excluded.
  if (filter === 'All') return key === 'spartan' || key === 'legacy';
  if (!key || key === 'inactive') return false;
  return filter === 'Spartans' ? key === 'spartan' : key === 'legacy';
};
