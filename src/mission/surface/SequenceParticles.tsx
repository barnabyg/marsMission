import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DynamicDrawUsage,
  LinearFilter,
} from "three";
import { useDisposal } from "../sceneParts";
import {
  newParticlePools,
  writeParticles,
  type ParticlePool,
} from "./particles";
import type { LandingSequence } from "./sequence";
import { placeOf } from "./surface";
import { groundHeight } from "./terrain";

const dotSize = 32;

/** A round, soft-edged dot, as points are otherwise square. Generated here, so it's no art file. */
function softDot(): DataTexture {
  const pixels = new Uint8Array(dotSize * dotSize * 4);
  for (let row = 0; row < dotSize; row++) {
    for (let column = 0; column < dotSize; column++) {
      const across = (column + 0.5) / dotSize - 0.5;
      const along = (row + 0.5) / dotSize - 0.5;
      const fall = Math.max(1 - Math.hypot(across, along) * 2, 0);
      const pixel = (row * dotSize + column) * 4;
      pixels.fill(
        Math.round(fall * fall * (3 - 2 * fall) * 255),
        pixel,
        pixel + 4,
      );
    }
  }
  const texture = new DataTexture(pixels, dotSize, dotSize);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function geometryOf({ positions, colors }: ParticlePool): BufferGeometry {
  return new BufferGeometry()
    .setAttribute(
      "position",
      new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage),
    )
    .setAttribute(
      "color",
      new BufferAttribute(colors, 4).setUsage(DynamicDrawUsage),
    );
}

function markChanged(geometry: BufferGeometry) {
  const { position, color } = geometry.attributes;
  if (position) position.needsUpdate = true;
  if (color) color.needsUpdate = true;
}

/** The plumes, fire and dust of a running sequence. It's only here while one is running, and frees everything when it goes. */
export function SequenceParticles({
  sequence,
  elapsedMs,
}: {
  sequence: LandingSequence;
  elapsedMs: number;
}) {
  const { siteName, assets, crashed } = sequence;
  const pools = useMemo(() => newParticlePools(), []);
  const emitters = useMemo(
    () =>
      assets.map(({ place }) => {
        const { x, z } = placeOf(place);
        return { x, y: groundHeight(siteName, x, z), z };
      }),
    [assets, siteName],
  );
  const plume = useMemo(() => geometryOf(pools.plume), [pools]);
  const dust = useMemo(() => geometryOf(pools.dust), [pools]);
  const dot = useMemo(() => softDot(), []);
  useDisposal(plume);
  useDisposal(dust);
  useDisposal(dot);

  // A paused sequence has nothing to work out.
  const drawnMs = useRef<number | null>(null);
  useFrame(() => {
    if (drawnMs.current === elapsedMs) return;
    drawnMs.current = elapsedMs;
    writeParticles(crashed, elapsedMs, emitters, pools);
    markChanged(plume);
    markChanged(dust);
  });

  return (
    <>
      {/* Dust first, so that the fire shows through it. They move too much for one bounding sphere to be worth keeping. */}
      <points geometry={dust} frustumCulled={false} renderOrder={1}>
        <pointsMaterial
          size={0.85}
          alphaMap={dot}
          vertexColors
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      <points geometry={plume} frustumCulled={false} renderOrder={2}>
        <pointsMaterial
          size={0.3}
          alphaMap={dot}
          vertexColors
          transparent
          depthWrite={false}
          toneMapped={false}
          blending={AdditiveBlending}
        />
      </points>
    </>
  );
}
