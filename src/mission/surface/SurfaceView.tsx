import { memo, useMemo } from "react";
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  SphereGeometry,
} from "three";
import type { Timeline } from "../../simulation/simulation";
import { useDisposal, type Point, type SceneLabel } from "../sceneParts";
import {
  fallAt,
  hasImpacted,
  sequenceRunning,
  type LandingSequence,
  type SequenceNow,
} from "./sequence";
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
import { buildTerrain, groundHeight, horizonColor } from "./terrain";

/** Big enough to reach past the land's fade, and small enough to stay clear of the solar system's camera and the stars. */
const skyRadius = 14.5;
const zenithColor = [0.2, 0.09, 0.06] as const;

/** How far above the ground each model's label sits. */
const labelHeights: Record<SurfaceModel, number> = {
  lander: 1.5,
  rover: 1.05,
  crewLander: 2.2,
};

function Terrain({ siteName }: { siteName: string }) {
  const geometry = useMemo(() => {
    const { positions, colors, indices } = buildTerrain(siteName);
    return new BufferGeometry()
      .setAttribute("position", new BufferAttribute(positions, 3))
      .setAttribute("color", new BufferAttribute(colors, 3))
      .setIndex(new BufferAttribute(indices, 1));
  }, [siteName]);
  useDisposal(geometry);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </mesh>
  );
}

const Sky = memo(function Sky() {
  const geometry = useMemo(() => {
    const sphere = new SphereGeometry(skyRadius, 24, 16);
    const { position } = sphere.attributes;
    const colors = new Float32Array((position?.count ?? 0) * 3);
    for (let vertex = 0; vertex < colors.length / 3; vertex++) {
      const height = Math.max((position?.getY(vertex) ?? 0) / skyRadius, 0);
      const share = Math.min(height * 1.6, 1);
      for (let channel = 0; channel < 3; channel++) {
        colors[vertex * 3 + channel] =
          (horizonColor[channel] ?? 0) * (1 - share) +
          (zenithColor[channel] ?? 0) * share;
      }
    }
    return sphere.setAttribute("color", new BufferAttribute(colors, 3));
  }, []);
  useDisposal(geometry);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors side={BackSide} toneMapped={false} />
    </mesh>
  );
});

/** The sequence at this Landing Site, if it's here. */
function sequenceAt(now: SequenceNow | null, siteName: string) {
  return now?.sequence.siteName === siteName ? now : null;
}

/** How high an operating Asset, or one of the Crew's landers in its place, is above its spot, which is only above the ground while it's landing. */
function altitudeOf(
  here: SequenceNow | null,
  place: number,
  lander = 0,
): number {
  if (!sequenceRunning(here) || here.sequence.crashed) return 0;
  return here.sequence.assets.some(
    (asset) => asset.place === place && asset.lander === lander,
  )
    ? fallAt(false, here.elapsedMs).altitude
    : 0;
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
  const Model = models.crewLander;
  return (
    <>
      {crewLandersStanding(asset, day).map((lander) => {
        const { x, z } = landerSpot(asset.place, lander);
        return (
          <group key={lander} position={[x, groundHeight(siteName, x, z), z]}>
            <Shadow model="crewLander" />
            <group position={[0, altitudeOf(here, asset.place, lander), 0]}>
              <Model />
            </group>
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
  sequence,
  elapsedMs,
  siteName,
}: {
  sequence: LandingSequence;
  elapsedMs: number;
  siteName: string;
}) {
  const impacted = hasImpacted({ sequence, elapsedMs });
  const { altitude, tilt } = fallAt(true, elapsedMs);
  return (
    <>
      {sequence.assets.map(({ model, place, lander }) => {
        const { x, z } = landerSpot(place, lander);
        const Wreck = wrecks[model];
        const Model = models[model];
        return (
          <group key={place} position={[x, groundHeight(siteName, x, z), z]}>
            {impacted ? (
              <Wreck />
            ) : (
              <>
                <Shadow model={model} />
                <group
                  position={[0, altitude, 0]}
                  rotation={[tilt * 0.5, 0, tilt]}
                >
                  <Model />
                </group>
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
  day,
  siteName,
  sequence,
}: {
  timeline: Pick<Timeline, "assetsAtMars" | "dustStorms">;
  day: number;
  siteName: string;
  sequence: SequenceNow | null;
}) {
  const here = sequenceAt(sequence, siteName);
  return (
    <group position={surfaceCentre}>
      <Sky />
      <Terrain siteName={siteName} />
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
        const Model = models[model];
        const { x, z, heading } = spotOf(asset, day);
        return (
          <group key={place} position={[x, groundHeight(siteName, x, z), z]}>
            <Shadow model={model} />
            <group
              position={[0, altitudeOf(here, place), 0]}
              rotation={[0, heading, 0]}
            >
              <Model />
            </group>
          </group>
        );
      })}
      {here?.sequence.crashed === true && (
        <Crash
          sequence={here.sequence}
          elapsedMs={here.elapsedMs}
          siteName={siteName}
        />
      )}
      {dustStormAt(timeline, day, siteName) && <DustStormEffect />}
      {sequenceRunning(here) && (
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
  day: number,
  siteName: string | null,
  sequence: SequenceNow | null,
): SceneLabel[] {
  if (siteName === null) return [];
  const here = sequenceAt(sequence, siteName);
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
    return {
      text: name,
      position: inTheShot(
        x,
        groundHeight(siteName, x, z) +
          labelHeights[model] +
          altitudeOf(here, place, lander),
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
        x,
        groundHeight(siteName, x, z) + labelHeights[model] + altitude,
        z,
      ),
      testId: "surface-crash",
      className: "on-surface crashed-label",
    };
  });
  return [...operating, ...lost];
}
