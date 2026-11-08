import type { ProgramView, TurnPlan } from "../simulation/simulation";

export type AdviceTopic =
  | "launchVehicle"
  | "assets"
  | "landingSite"
  | "trajectory"
  | "serviceLife"
  | "reliability"
  | "contingency"
  | "crew"
  | "supplies"
  | "protection"
  | "development"
  | "activities"
  | "upkeep"
  | "bringHome"
  | "noLaunch";

export interface AdviceItem {
  topic: AdviceTopic;
  /** What to set, such as "Launch on the Meridian Medium." */
  advice: string;
  /** Why, in one or two sentences. */
  reason: string;
}

export type PlannedMission = NonNullable<TurnPlan["mission"]>;
export type ViewAsset = ProgramView["assets"][number];

/** Names joined as a sentence lists them: "A", "A and B", "A, B and C". */
export function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
}

/** The Assets on offer with these ids, in the order given. */
export const assetsWithIds = (view: ProgramView, ids: readonly string[]) =>
  ids.flatMap((id) => view.assets.find((asset) => asset.id === id) ?? []);

/** The name of the Landing Site with this id, or the id itself if the view has no such site. */
export const siteName = (view: ProgramView, id: string) =>
  view.landingSites.find((site) => site.id === id)?.name ?? id;
