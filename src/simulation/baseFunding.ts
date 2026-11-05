import type { Catalogue } from "../catalogue/catalogue";

/**
 * Base funding: what the Program's backers pay as each Turn ends, for each point of Public Support it had as the Turn
 * started, up to a most for a Turn, in whole tens of millions. It keeps a Program that has lost its Missions able to
 * try again in time, without ever paying as much as Research Grants.
 */
export function baseFundingFor(
  catalogue: Catalogue,
  publicSupport: number,
): number {
  const { baseFunding } = catalogue.program;
  if (!baseFunding) return 0;
  const raw = Math.max(publicSupport, 0) * baseFunding.millionsPerPublicSupport;
  return Math.min(Math.floor(raw / 10) * 10, baseFunding.mostMillions);
}
