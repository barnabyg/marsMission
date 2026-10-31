import type { Timeline } from "../simulation/simulation";
import { journeyProgress } from "./solarSystem/orbits";

function describeAsset(
  asset: NonNullable<Timeline["mission"]>["assets"][number],
  day: number,
): string | null {
  if (asset.lostOnDay !== null && day >= asset.lostOnDay) {
    return asset.crashed
      ? `${asset.name}: crashed at ${asset.landingSiteName ?? "Mars"}`
      : `${asset.name}: lost, and will not reach Mars`;
  }
  if (asset.deliveredOnDay !== null && day >= asset.deliveredOnDay) {
    return asset.landingSiteName
      ? `${asset.name}: landed at ${asset.landingSiteName}`
      : `${asset.name}: arrived at Mars`;
  }
  return null;
}

/** What the player reads about the Turn's Mission on a given day. */
export function describeJourney(
  mission: Timeline["mission"],
  day: number,
): string {
  if (!mission) return "No Mission this Turn";
  const settled = mission.assets.flatMap((asset) => {
    const text = describeAsset(asset, day);
    return text === null ? [] : [text];
  });
  const stillGoing = mission.assets
    .filter((asset) => describeAsset(asset, day) === null)
    .map((asset) => asset.name);
  if (stillGoing.length > 0) {
    const progress = journeyProgress(mission, day);
    settled.push(
      progress < 1
        ? `${stillGoing.join(", ")}: ${Math.round(progress * 100)}% of the way to Mars`
        : `${stillGoing.join(", ")}: arriving at Mars`,
    );
  }
  return settled.join(". ");
}

/** What the "Operating at Mars" list shows on a given day. */
export function assetsOperatingOn(timeline: Timeline, day: number): string[] {
  return timeline.assetsAtMars
    .filter((asset) => day >= asset.fromDay)
    .map((asset) =>
      asset.landingSiteName
        ? `${asset.name} at ${asset.landingSiteName}`
        : asset.name,
    );
}
