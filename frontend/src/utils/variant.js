// Variant (รุ่น) options for items that are split by variant, e.g. a vehicle "RW3" with "EX 2" and "+12".
// Change the two ranges here if the game has more levels.
export const EX_MAX = 8;     // EX 1 … EX 8
export const PLUS_MAX = 20;  // +1 … +20

export const EX_OPTIONS = Array.from({ length: EX_MAX }, (_, i) => i + 1);
export const PLUS_OPTIONS = Array.from({ length: PLUS_MAX }, (_, i) => i + 1);

/** Same normalisation the backend uses to decide "same variant = same queue" */
export const norm = (n) => String(n ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** ex / plus: '' or 0 = none.  → "EX 2 +12" | "EX 2" | "+12" | "" (blank = plain queue of the item) */
export function buildVariant(ex, plus) {
  const parts = [];
  if (Number(ex) > 0) parts.push(`EX ${Number(ex)}`);
  if (Number(plus) > 0) parts.push(`+${Number(plus)}`);
  return parts.join(' ');
}
