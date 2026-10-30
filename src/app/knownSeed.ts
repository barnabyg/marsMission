/**
 * The seed a new Program should use, for browser tests and playtests. It comes from `?seed=123` in
 * the address, which normal play never has, and it works in a production build as well as on the
 * development server.
 */
export function knownSeed(search: string): number | null {
  const value = new URLSearchParams(search).get("seed");
  return value !== null && /^\d+$/.test(value) ? Number(value) : null;
}
