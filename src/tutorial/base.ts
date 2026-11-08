import type { ProgramView } from "../simulation/simulation";

/** The kinds of Asset that make a Base: a fuel plant, a habitat and a Mars lab, operating at one Landing Site. */
export const baseKinds = ["fuel-plant", "habitat", "lab"] as const;

/** Whether an Asset of this kind operates at this Landing Site. */
const operatesAt = (view: ProgramView, kind: string, siteId: string) =>
  view.operatingAssets.some(
    (asset) => asset.kind === kind && asset.landingSiteId === siteId,
  );

/** The kinds of a Base that don't operate at this Landing Site. */
const missingFromBase = (view: ProgramView, siteId: string) =>
  baseKinds.filter((kind) => !operatesAt(view, kind, siteId));

/** Whether Crew are at a Landing Site where a fuel plant, a habitat and a Mars lab operate. */
export function crewAtBase(view: ProgramView): boolean {
  return view.crew.some(
    ({ landingSiteId, members }) =>
      landingSiteId !== null &&
      members.length > 0 &&
      missingFromBase(view, landingSiteId).length === 0,
  );
}
