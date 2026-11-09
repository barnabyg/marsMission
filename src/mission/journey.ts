import type { AssetAtMars, Timeline } from "../simulation/simulation";
import { journeyProgress } from "./solarSystem/orbits";

type Mission = NonNullable<Timeline["mission"]>;

function describeAsset(
  asset: Mission["assets"][number],
  day: number,
  returnsToEarth: Mission["returnsToEarth"],
): string | null {
  if (asset.lostOnDay !== null && day >= asset.lostOnDay) {
    if (returnsToEarth) {
      return day >= returnsToEarth.backOnDay
        ? `${asset.name}: back at Earth`
        : `${asset.name}: heading back to Earth`;
    }
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
    const text = describeAsset(asset, day, mission.returnsToEarth);
    return text === null ? [] : [text];
  });
  const stillGoing = mission.assets
    .filter(
      (asset) => describeAsset(asset, day, mission.returnsToEarth) === null,
    )
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

/** The Assets operating at Mars on a given day. */
export function assetsAtMarsOn(
  timeline: Pick<Timeline, "assetsAtMars">,
  day: number,
): AssetAtMars[] {
  return timeline.assetsAtMars.filter(
    ({ fromDay, untilDay }) =>
      day >= fromDay && (untilDay === null || day < untilDay),
  );
}

/** What the "Operating at Mars" list shows on a given day. */
export function assetsOperatingOn(
  timeline: Pick<Timeline, "assetsAtMars">,
  day: number,
): string[] {
  return assetsAtMarsOn(timeline, day).map(
    (asset) =>
      `${
        asset.landingSiteName
          ? `${asset.label} at ${asset.landingSiteName}`
          : asset.label
      }: ${asset.activityName}${
        asset.cutServiceLifeDays === undefined
          ? ""
          : `, Service Life cut to ${asset.cutServiceLifeDays} days`
      }`,
  );
}
