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
import { SequenceParticles } from "./SequenceParticles";
import {
  placeOf,
  spotOf,
  surfaceAssetsAt,
  surfaceCentre,
  type SurfaceModel,
} from "./surface";
import { models, Shadow, wrecks } from "./surfaceModels";
import { buildTerrain, groundHeight, horizonColor } from "./terrain";

/** Big enough to reach past the land's fade, and small enough to stay clear of the solar system's camera and the stars. */
const skyRadius = 14.5;
const zenithColor = [0.2, 0.09, 0.06] as const;

/** How far above the ground each model's label sits. */
const labelHeights: Record<SurfaceModel, number> = { lander: 1.5, rover: 1.05 };

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

/** How high an operating Asset is above its spot, which is only above the ground while it's landing. */
function altitudeOf(here: SequenceNow | null, place: number): number {
  if (!sequenceRunning(here) || here.sequence.crashed) return 0;
  return here.sequence.assets.some((asset) => asset.place === place)
    ? fallAt(false, here.elapsedMs).altitude
    : 0;
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
      {sequence.assets.map(({ model, place }) => {
        const { x, z } = placeOf(place);
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
  timeline: Pick<Timeline, "assetsAtMars">;
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
    const { x, z } = spotOf(asset, day);
    return {
      text: name,
      position: inTheShot(
        x,
        groundHeight(siteName, x, z) +
          labelHeights[model] +
          altitudeOf(here, place),
        z,
      ),
      testId: "surface-asset",
      className: `on-surface ${model}-label`,
    };
  });
  if (!sequenceRunning(here) || !here.sequence.crashed) return operating;
  const { altitude } = fallAt(true, here.elapsedMs);
  const lost = here.sequence.assets.map(({ name, model, place }) => {
    const { x, z } = placeOf(place);
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
