import { useMemo } from "react";
import type { Point, SceneLabel } from "../sceneParts";
import {
  ascentRunning,
  riseAt,
  type AscentCraft,
  type AscentNow,
} from "./ascent";
import {
  AscentWreck,
  KestrelPlatform,
  KestrelRocket,
  rocketBase,
} from "./ascentModels";
import { writeAscentParticles } from "./ascentParticles";
import { CrewCabin, CrewDescentStage, crewCabinBase } from "./crewModels";
import { ParticleLayers } from "./SequenceParticles";
import { landerSpot, surfaceCentre } from "./surface";
import { Shadow } from "./surfaceModels";
import { groundHeight } from "./terrain";

/** What lifts off climbs out of the shot well before this, and is no longer drawn. */
const goneAltitude = 10;

/** How far up each kind of craft its engine fires from, above the ground its lander or platform stands on. */
function engineHeightOf(crewed: boolean): number {
  return crewed ? crewCabinBase : rocketBase;
}

/** One craft lifting off: what it leaves standing, and itself climbing, or falling back and wrecked. */
function Craft({
  craft,
  crewed,
  failed,
  elapsedMs,
  siteName,
}: {
  craft: AscentCraft;
  crewed: boolean;
  failed: boolean;
  elapsedMs: number;
  siteName: string;
}) {
  const { x, z } = landerSpot(craft.place, craft.lander);
  const { altitude, drift, tilt, impacted } = riseAt(failed, elapsedMs);
  const pivot = crewed ? 1.35 : rocketBase + 0.65;
  return (
    <group position={[x, groundHeight(siteName, x, z), z]}>
      <Shadow model={crewed ? "crewLander" : "ascentVehicle"} />
      {crewed ? <CrewDescentStage /> : <KestrelPlatform />}
      {impacted ? (
        <group position={[drift, 0, 0]}>
          <AscentWreck color={crewed ? "#b9b7b2" : "#d9d6cf"} />
        </group>
      ) : (
        altitude < goneAltitude && (
          // Tipping over about its middle as it falls.
          <group
            position={[drift, altitude + pivot, 0]}
            rotation={[0, 0, -tilt]}
          >
            <group position={[0, crewed ? -pivot : rocketBase - pivot, 0]}>
              {crewed ? <CrewCabin /> : <KestrelRocket />}
            </group>
          </group>
        )
      )}
    </group>
  );
}

/**
 * Mars ascent at its Landing Site: what lifts off climbing out of the shot on its plume, or falling back and crashing,
 * and then for the rest of the Turn what it left behind. Simple models and generated effects, so it uses no art file
 * (ADR 0005), and it only reads the Timeline, so it can't change anything.
 */
export function AscentAtSite({
  ascent,
  siteName,
}: {
  ascent: AscentNow;
  siteName: string;
}) {
  const { sequence, elapsedMs } = ascent;
  const { craft, crewed, failed } = sequence;
  const emitters = useMemo(
    () =>
      craft.map(({ place, lander }) => {
        const { x, z } = landerSpot(place, lander);
        return {
          x,
          y: groundHeight(siteName, x, z),
          z,
          engineHeight: engineHeightOf(crewed),
        };
      }),
    [craft, crewed, siteName],
  );
  return (
    <>
      {craft.map((one) => (
        <Craft
          key={`${String(one.place)}:${String(one.lander)}`}
          craft={one}
          crewed={crewed}
          failed={failed}
          elapsedMs={elapsedMs}
          siteName={siteName}
        />
      ))}
      {ascentRunning(ascent) && (
        <ParticleLayers
          elapsedMs={elapsedMs}
          write={(pools) => {
            writeAscentParticles(failed, elapsedMs, emitters, pools);
          }}
        />
      )}
    </>
  );
}

/** How high above what lifts off its label sits. */
const labelHeight = 1.3;

/** The labels of what's lifting off at this Landing Site, while Mars ascent runs there. */
export function ascentLabels(
  ascent: AscentNow | null,
  siteName: string,
): SceneLabel[] {
  if (!ascentRunning(ascent) || ascent.sequence.siteName !== siteName) {
    return [];
  }
  const { sequence, elapsedMs } = ascent;
  const { altitude, drift, impacted } = riseAt(sequence.failed, elapsedMs);
  if (altitude >= goneAltitude) return [];
  const above = engineHeightOf(sequence.crewed) + labelHeight;
  return sequence.craft.map(({ name, place, lander }) => {
    const { x, z } = landerSpot(place, lander);
    const position: Point = [
      surfaceCentre[0] + x + drift,
      surfaceCentre[1] + groundHeight(siteName, x, z) + altitude + above,
      surfaceCentre[2] + z,
    ];
    return {
      text: impacted ? `${name}: crashed` : name,
      position,
      testId: "surface-ascent",
      className: impacted
        ? "on-surface crashed-label"
        : `on-surface ${sequence.crewed ? "crewLander" : "ascentVehicle"}-label`,
    };
  });
}
