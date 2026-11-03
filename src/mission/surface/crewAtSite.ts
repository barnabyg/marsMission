import type { Timeline } from "../../simulation/simulation";
import { roverSpot, type RoverSpot } from "./motion";
import {
  sequenceMs,
  sequenceRunning,
  touchdownMs,
  type SequenceNow,
} from "./sequence";
import {
  crewLandersOf,
  isIndoors,
  isThere,
  landerSpot,
  surfaceAssetsAt,
  type SurfaceAsset,
} from "./surface";

/** A Crew member out on the surface, where they are and which way they face. */
export interface CrewFigure extends RoverSpot {
  name: string;
}

/** How far in front of their lander the Crew work, and how far apart. */
const inFront = 1.15;
const apart = 0.5;

/** How long before the sequence ends the Crew are clear of their lander, so that they're at work as it ends. */
const outBeforeEndMs = 400;

/** The landers standing at a place on a given day: each while any of the Crew it brought are there. */
export function crewLandersStanding(
  asset: SurfaceAsset,
  day: number,
): number[] {
  const landers = crewLandersOf(asset.crew);
  return landers.flatMap((landedOn, lander) =>
    asset.crew.some(
      (member) => member.arrivedOnDay === landedOn && isThere(member, day),
    )
      ? [lander]
      : [],
  );
}

/** How far out of their lander the Crew coming down in this sequence are, from 0 aboard to 1 clear, or null if they aren't in it. */
function stepOutShare(
  here: SequenceNow | null,
  place: number,
  lander: number,
): number | null {
  if (!sequenceRunning(here) || here.sequence.crashed) return null;
  const landing = here.sequence.assets.some(
    (asset) => asset.place === place && asset.lander === lander,
  );
  if (!landing) return null;
  const share =
    (here.elapsedMs - touchdownMs) /
    (sequenceMs - outBeforeEndMs - touchdownMs);
  return Math.min(Math.max(share, 0), 1);
}

/**
 * The Crew out on the surface at their Landing Site on a given day, working in front of the lander they came in and
 * getting about as their Activity has them do, as a rover does. They're indoors while they shelter from a dust storm,
 * aboard as their lander comes down, and gone once lost. `here` is the sequence at this Landing Site, if there is one.
 * It only reads the Timeline, so it can't change anything.
 */
export function crewFiguresOn(
  asset: SurfaceAsset,
  day: number,
  here: SequenceNow | null,
): CrewFigure[] {
  const landers = crewLandersOf(asset.crew);
  return asset.crew.flatMap((member) => {
    if (!isThere(member, day) || isIndoors(member, day)) return [];
    const lander = landers.indexOf(member.arrivedOnDay);
    const crewmates = asset.crew.filter(
      ({ arrivedOnDay }) => arrivedOnDay === member.arrivedOnDay,
    );
    const door = landerSpot(asset.place, lander);
    const home = {
      x:
        door.x +
        (crewmates.indexOf(member) - (crewmates.length - 1) / 2) * apart,
      z: door.z - inFront,
    };
    const share = stepOutShare(here, asset.place, lander);
    if (share === 0) return [];
    if (share !== null && share < 1) {
      return [
        {
          name: member.name,
          x: door.x + (home.x - door.x) * share,
          z: door.z + (home.z - door.z) * share,
          // Walking out towards the camera.
          heading: Math.atan2(door.z - home.z, home.x - door.x),
        },
      ];
    }
    const spot = roverSpot(
      {
        surfaceMotion: asset.surfaceMotion,
        key: `${asset.key}:${member.name}`,
        arrivedOnDay: member.arrivedOnDay,
        fromDay: member.fromDay,
        untilDay: member.untilDay,
      },
      home,
      day,
    );
    return [{ name: member.name, ...spot }];
  });
}

/** The names of the Crew out on the surface at a Landing Site on a given day, which the browser tests read. */
export function crewOutsideAt(
  timeline: Pick<Timeline, "assetsAtMars">,
  day: number,
  siteName: string,
  now: SequenceNow | null,
): string[] {
  const here = now?.sequence.siteName === siteName ? now : null;
  return surfaceAssetsAt(timeline, day, siteName)
    .filter(({ model }) => model === "crewLander")
    .flatMap((asset) =>
      crewFiguresOn(asset, day, here).map(({ name }) => name),
    );
}
