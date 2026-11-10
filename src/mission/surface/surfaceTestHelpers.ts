import type { AssetAtMars, Timeline } from "../../simulation/simulation";

/** Fixtures for the tests of `surface.ts`: an Asset at Mars, one on its way, and a Timeline with them. */

type Mission = NonNullable<Timeline["mission"]>;
export type MissionAsset = Mission["assets"][number];

export const asset = ({
  name = "Lander",
  ...overrides
}: Partial<AssetAtMars>): AssetAtMars => ({
  key: "lander",
  name,
  label: name,
  kind: "lander",
  landingSiteName: "Alpha Plain",
  activityName: "Nothing",
  surfaceMotion: "still",
  arrivedOnDay: -100,
  fromDay: 0,
  untilDay: null,
  ...overrides,
});

export const onTheWay = (overrides: Partial<MissionAsset>): MissionAsset => ({
  name: "Newcomer",
  kind: "lander",
  landingSiteName: "Beta Basin",
  deliveredOnDay: 205,
  lostOnDay: null,
  crashed: false,
  ...overrides,
});

export const timelineOf = (
  assetsAtMars: AssetAtMars[],
  assets: MissionAsset[] = [],
): Pick<Timeline, "assetsAtMars" | "mission"> => ({
  assetsAtMars,
  mission:
    assets.length === 0
      ? null
      : {
          launchDay: 0,
          arrivalDay: 200,
          launchVehicleName: "Test Vehicle",
          assetNames: assets.map(({ name }) => name),
          assets,
          failedOnDay: null,
        },
});
