/** Turns a name into a number (the FNV-1a hash). */
export function hashOf(name: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < name.length; index++) {
    hash = Math.imul(hash ^ name.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

/** Eases a value from 0 at or below 0 to 1 at or above 1. */
export function smooth(value: number): number {
  const clamped = Math.min(Math.max(value, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}
