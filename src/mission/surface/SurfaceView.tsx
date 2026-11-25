import type { Timeline } from "../../simulation/simulation";
import type { Point, SceneLabel } from "../sceneParts";
import {
  entryDrift,
  landingPhase,
  fallAt,
  hasImpacted,
  sequenceRunning,
  type SequenceNow,
} from "./sequence";
import { EntryShell } from "./EntryShell";
import type { AscentNow } from "./ascent";
import { AscentAtSite } from "./AscentView";
import { crewFiguresOn, crewLandersStanding } from "./crewAtSite";
import { CrewFigure } from "./crewModels";
import { DustStormEffect } from "./DustStormEffect";
import { SequenceParticles } from "./SequenceParticles";
import {
  dustStormAt,
  landerSpot,
  spotOf,
  surfaceAssetsAt,
  surfaceCentre,
  type SurfaceAsset,
  type SurfaceModel,
} from "./surface";
import { models, Shadow, wrecks } from "./surfaceModels";
import { Rocks, Sky, Terrain } from "./SurfaceGround";
import { groundHeight } from "./terrain";

/** How far above the ground each model's label sits. */
const labelHeights: Record<SurfaceModel, number> = {
  lander: 1.5,
  rover: 1.05,
  crewLander: 2.2,
  fuelPlant: 1.5,
  habitat: 1.4,
  lab: 1.45,
  ascentVehicle: 1.95,
};

/** The sequence at this Landing Site, if it's here. */
function sequenceAt(now: SequenceNow | null, siteName: string) {
  return now?.sequence.siteName === siteName ? now : null;
}

/** Existing Assets and earlier Crew landers stay at their own places as the new payload lands. */
function arrivingAt(here: SequenceNow | null, place: number, lander = 0) {
  if (!sequenceRunning(here) || here.sequence.crashed) return null;
  return here.sequence.assets.some(
    (asset) => asset.place === place && asset.lander === lander,
  )
    ? here
    : null;
}

function descentPose(arrival: SequenceNow | null) {
  return arrival
    ? {
        ...fallAt(arrival.sequence.crashed, arrival.elapsedMs),
        drift: entryDrift(arrival.elapsedMs),
      }
    : { altitude: 0, tilt: 0, drift: 0 };
}

function DescentModel({
  model,
  arrival,
  heading = 0,
}: {
  model: SurfaceModel;
  arrival: SequenceNow | null;
  heading?: number;
}) {
  const Model = models[model];
  const { altitude, tilt, drift } = descentPose(arrival);
  return (
    <group
      position={[drift, altitude, 0]}
      rotation={[tilt * 0.5, heading, tilt]}
    >
      {arrival && landingPhase(arrival) === "entry" ? (
        <EntryShell
          crewed={model === "crewLander"}
          elapsedMs={arrival.elapsedMs}
        />
      ) : (
        <Model />
      )}
    </group>
  );
}

/** The Crew at their Landing Site: each lander they came in, and each of them at work outside. */
function CrewAtSite({
  asset,
  day,
  here,
  siteName,
}: {
  asset: SurfaceAsset;
  day: number;
  here: SequenceNow | null;
  siteName: string;
}) {
  return (
    <>
      {crewLandersStanding(asset, day).map((lander) => {
        const { x, z } = landerSpot(asset.place, lander);
        return (
          <group key={lander} position={[x, groundHeight(siteName, x, z), z]}>
            <Shadow model="crewLander" />
            <DescentModel
              model="crewLander"
              arrival={arrivingAt(here, asset.place, lander)}
            />
          </group>
        );
      })}
      {crewFiguresOn(asset, day, here).map(({ name, x, z, heading }) => (
        <group
          key={name}
          position={[x, groundHeight(siteName, x, z), z]}
          rotation={[0, heading, 0]}
        >
          <CrewFigure />
        </group>
      ))}
    </>
  );
}

/** A crash: what was bought coming down, and then for the rest of the Turn what's left of it. Nothing here is operating. */
function Crash({
  arrival,
  siteName,
}: {
  arrival: SequenceNow;
  siteName: string;
}) {
  const impacted = hasImpacted(arrival);
  return (
    <>
      {arrival.sequence.assets.map(({ model, place, lander }) => {
        const { x, z } = landerSpot(place, lander);
        const Wreck = wrecks[model];
        return (
          <group key={place} position={[x, groundHeight(siteName, x, z), z]}>
            {impacted ? (
              <Wreck />
            ) : (
              <>
                <Shadow model={model} />
                <DescentModel model={model} arrival={arrival} />
              </>
            )}
          </group>
        );
      })}
    </>
  );
}

/** A Landing Site with the Assets operating there. It can't change anything, because it only reads the Timeline. */
export function SurfaceScene({
  timeline,
  playedSeconds,
  day: calendarDay,
  siteName,
  sequence,
  ascent,
}: {
  timeline: Pick<Timeline, "assetsAtMars" | "dustStorms">;
  playedSeconds: number;
  day: number;
  siteName: string;
  sequence: SequenceNow | null;
  /** The Turn's Mars ascent, once it has started, which stays to show what it left behind. */
  ascent: AscentNow | null;
}) {
  const here = sequenceAt(sequence, siteName);
  const day = sequenceRunning(here) ? here.sequence.day : calendarDay;
  return (
    <group position={surfaceCentre}>
      <Sky />
      <Terrain siteName={siteName} />
      <Rocks siteName={siteName} />
      {surfaceAssetsAt(timeline, day, siteName).map((asset) => {
        const { model, place } = asset;
        if (model === "crewLander") {
          return (
            <CrewAtSite
              key={place}
              asset={asset}
              day={day}
              here={here}
              siteName={siteName}
            />
          );
        }

        const { x, z, heading } = spotOf(asset, day);
        return (
          <group key={place} position={[x, groundHeight(siteName, x, z), z]}>
            <Shadow model={model} />
            <DescentModel
              model={model}
              arrival={arrivingAt(here, place)}
              heading={heading}
            />
          </group>
        );
      })}
      {here?.sequence.crashed === true && (
        <Crash arrival={here} siteName={siteName} />
      )}
      {ascent?.sequence.siteName === siteName && (
        <AscentAtSite ascent={ascent} siteName={siteName} />
      )}
      {dustStormAt(timeline, day, siteName) && (
        <DustStormEffect seconds={playedSeconds} />
      )}
      {sequenceRunning(here) && landingPhase(here) !== "entry" && (
        <SequenceParticles
          sequence={here.sequence}
          elapsedMs={here.elapsedMs}
        />
      )}
    </group>
  );
}

export function surfaceLabels(
  timeline: Timeline,
  calendarDay: number,
  siteName: string | null,
  sequence: SequenceNow | null,
): SceneLabel[] {
  if (siteName === null) return [];
  const here = sequenceAt(sequence, siteName);
  const day = sequenceRunning(here) ? here.sequence.day : calendarDay;
  const inTheShot = (x: number, height: number, z: number): Point => [
    surfaceCentre[0] + x,
    surfaceCentre[1] + height,
    surfaceCentre[2] + z,
  ];
  const operating = surfaceAssetsAt(timeline, day, siteName).map((asset) => {
    const { name, model, place } = asset;
    // The Crew's ship is labelled on the first of their landers still standing.
    const lander =
      model === "crewLander" ? (crewLandersStanding(asset, day)[0] ?? 0) : 0;
    const { x, z } =
      model === "crewLander" ? landerSpot(place, lander) : spotOf(asset, day);
    const { altitude, drift } = descentPose(arrivingAt(here, place, lander));
    return {
      text: name,
      position: inTheShot(
        x + drift,
        groundHeight(siteName, x, z) + labelHeights[model] + altitude,
        z,
      ),
      testId: "surface-asset",
      className: `on-surface ${model}-label`,
    };
  });
  if (!sequenceRunning(here) || !here.sequence.crashed) return operating;
  const { altitude } = fallAt(true, here.elapsedMs);
  const lost = here.sequence.assets.map(({ name, model, place, lander }) => {
    const { x, z } = landerSpot(place, lander);
    return {
      text: `${name}: crashed`,
      position: inTheShot(
        x + entryDrift(here.elapsedMs),
        groundHeight(siteName, x, z) + labelHeights[model] + altitude,
        z,
      ),
      testId: "surface-crash",
      className: "on-surface crashed-label",
    };
  });
  return [...operating, ...lost];
}
