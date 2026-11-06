import { memo, useMemo } from "react";
import {
  BackSide,
  BufferAttribute,
  CircleGeometry,
  SphereGeometry,
} from "three";
import { useDisposal, type Point, type SceneLabel } from "../sceneParts";
import { Rod } from "../surface/modelParts";
import {
  hide,
  put,
  shareFor,
  dustCount,
  plumeCount,
} from "../surface/particles";
import { ParticleLayers } from "../surface/SequenceParticles";
import {
  capsuleAt,
  piecesAt,
  splashAt,
  splashdownCentre,
  splashMs,
  type EarthEntryNow,
} from "./splashdown";

const domeRadius = 13;

/** A sky dome or a sea, coloured from `near` to `far` by how far up or out each point is. */
function useShaded(
  geometry: SphereGeometry | CircleGeometry,
  share: (x: number, y: number, z: number) => number,
  near: readonly [number, number, number],
  far: readonly [number, number, number],
) {
  return useMemo(() => {
    const { position } = geometry.attributes;
    const colors = new Float32Array((position?.count ?? 0) * 3);
    for (let vertex = 0; vertex < colors.length / 3; vertex++) {
      const amount = Math.min(
        Math.max(
          share(
            position?.getX(vertex) ?? 0,
            position?.getY(vertex) ?? 0,
            position?.getZ(vertex) ?? 0,
          ),
          0,
        ),
        1,
      );
      for (let channel = 0; channel < 3; channel++) {
        colors[vertex * 3 + channel] =
          (near[channel] ?? 0) * (1 - amount) + (far[channel] ?? 0) * amount;
      }
    }
    return geometry.setAttribute("color", new BufferAttribute(colors, 3));
  }, [geometry, share, near, far]);
}

const skyShare = (_x: number, y: number) => (y / domeRadius) * 1.8;
/** Darker close to the camera, which looks across from one edge, and paler towards the horizon. */
const seaShare = (x: number, y: number) =>
  Math.hypot(x, y - 7) / (domeRadius + 7);
const horizon = [0.78, 0.86, 0.93] as const;
const zenith = [0.22, 0.45, 0.78] as const;
const seaNear = [0.05, 0.2, 0.34] as const;
const seaFar = [0.33, 0.52, 0.68] as const;

const Sky = memo(function Sky() {
  const sphere = useMemo(() => new SphereGeometry(domeRadius, 24, 16), []);
  const geometry = useShaded(sphere, skyShare, horizon, zenith);
  useDisposal(geometry);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors side={BackSide} toneMapped={false} />
    </mesh>
  );
});

const Sea = memo(function Sea() {
  const circle = useMemo(() => new CircleGeometry(domeRadius - 0.2, 48, 0), []);
  const geometry = useShaded(circle, seaShare, seaNear, seaFar);
  useDisposal(geometry);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </mesh>
  );
});

function Unlit({ color }: { color: string }) {
  return <meshBasicMaterial color={color} toneMapped={false} />;
}

/** A recovery ship waiting on the horizon. */
const Ship = memo(function Ship() {
  return (
    <group position={[5.5, 0, 10]} rotation={[0, 0.3, 0]}>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[2.6, 0.32, 0.55]} />
        <Unlit color="#5d6673" />
      </mesh>
      <mesh position={[-0.3, 0.45, 0]}>
        <boxGeometry args={[0.9, 0.32, 0.45]} />
        <Unlit color="#c9ced6" />
      </mesh>
      <mesh position={[-0.3, 0.85, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 6]} />
        <Unlit color="#8a9099" />
      </mesh>
    </group>
  );
});

/** The capsule, its heat shield down, with windows on the side towards the camera. Unlit, as everything here is. */
function Capsule({ scale }: { scale: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.18, 0.42, 0.5, 20]} />
        <Unlit color="#d7dae0" />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.44, 0.4, 0.07, 20]} />
        <Unlit color="#5a3a2a" />
      </mesh>
      <mesh position={[0, 0.53, 0]}>
        <cylinderGeometry args={[0.1, 0.18, 0.08, 16]} />
        <Unlit color="#a9adb6" />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.3, -0.31]} rotation={[-0.45, 0, 0]}>
          <boxGeometry args={[0.1, 0.08, 0.02]} />
          <Unlit color="#1b2433" />
        </mesh>
      ))}
    </group>
  );
}

/** Parachutes above the capsule, opening from nothing to full, striped red and white. */
function Parachutes({
  open,
  count,
  scale,
}: {
  open: number;
  count: number;
  scale: number;
}) {
  const spots: Point[] =
    count === 1
      ? [[0, 2.2, 0]]
      : [
          [-1.05, 2.15, 0.1],
          [1.05, 2.15, 0.1],
          [0, 2.45, 0.3],
        ];
  return (
    <group scale={scale}>
      {spots.map((spot, index) => (
        <group key={index}>
          <group position={spot} scale={[open, Math.max(open, 0.2), open]}>
            <mesh>
              <sphereGeometry
                args={[0.85, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <meshBasicMaterial
                color={index % 2 === 0 ? "#e2703a" : "#f4f1ea"}
                side={2}
                toneMapped={false}
              />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <torusGeometry args={[0.62, 0.025, 6, 24]} />
              <Unlit color="#f4f1ea" />
            </mesh>
          </group>
          {open > 0.3 && (
            <>
              <Rod
                from={[0, 0.55, 0]}
                to={[spot[0] - 0.55 * open, spot[1], spot[2]]}
                radius={0.008}
                color="#e8eaf0"
              />
              <Rod
                from={[0, 0.55, 0]}
                to={[spot[0] + 0.55 * open, spot[1], spot[2]]}
                radius={0.008}
                color="#e8eaf0"
              />
            </>
          )}
        </group>
      ))}
    </group>
  );
}

/** The glow around a capsule coming in hot, and its trail back up the way it came, white-hot at the capsule and fading to orange. */
function EntryGlow({ glow, scale }: { glow: number; scale: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4, 5, 6].map((step) => (
        <mesh key={step} position={[-0.5 * step, 0.47 * step, 0.34 * step]}>
          <sphereGeometry args={[(0.62 - step * 0.06) * scale, 14, 10]} />
          <meshBasicMaterial
            color={step === 0 ? "#ffe9a8" : step < 3 ? "#ffa04a" : "#e2703a"}
            transparent
            opacity={glow * (0.75 - step * 0.1)}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

/** Spray thrown up where the capsule hit the water, and settling back. */
function writeSplash(
  sinceSplashMs: number,
  plume: Parameters<typeof put>[0],
  spray: Parameters<typeof put>[0],
) {
  for (let index = 0; index < plumeCount; index++) hide(plume, index);
  for (let index = 0; index < dustCount; index++) {
    const share =
      (sinceSplashMs - shareFor(index, 0) * 300) /
      (900 + shareFor(index, 1) * 700);
    if (share < 0 || share >= 1) {
      hide(spray, index);
      continue;
    }
    const angle = shareFor(index, 2) * Math.PI * 2;
    const reach = (0.2 + shareFor(index, 3) * 1.1) * share;
    const height = (0.6 + shareFor(index, 4) * 1.6) * 4 * share * (1 - share);
    put(
      spray,
      index,
      splashAt[0] + Math.cos(angle) * reach,
      splashAt[1] + 0.05 + height,
      splashAt[2] + Math.sin(angle) * reach,
      0.92,
      0.96,
      1,
      (1 - share) * 0.75,
    );
  }
}

/**
 * Earth entry, in a patch of ocean of its own: the capsule streaking down in the glow of entry, slowing under its
 * parachutes and splashing down beside a recovery ship, or breaking up in the glow. Simple models and generated
 * effects, so it uses no art file (ADR 0005), and it only reads the Timeline, so it can't change anything.
 */
export function SplashdownScene({ now }: { now: EarthEntryNow | null }) {
  if (!now) return null;
  const capsule = capsuleAt(now);
  const scale = now.crewed ? 1 : 0.6;
  const sinceSplashMs = now.sinceMs - splashMs;
  return (
    <group position={splashdownCentre}>
      <Sky />
      <Sea />
      <Ship />
      {capsule.shown && (
        <group position={capsule.place}>
          {capsule.chutes > 0 && (
            <Parachutes
              open={capsule.chutes}
              count={now.crewed ? 3 : 1}
              scale={scale}
            />
          )}
          <group rotation={[0, 0, capsule.lean]}>
            <Capsule scale={scale} />
          </group>
          {capsule.glow > 0 && <EntryGlow glow={capsule.glow} scale={scale} />}
        </group>
      )}
      {piecesAt(now).map(({ place, heat }, index) => (
        <group key={index} position={place}>
          <mesh rotation={[index, index * 2, 0]}>
            <boxGeometry args={[0.18 * scale, 0.1 * scale, 0.14 * scale]} />
            <Unlit color="#3a332e" />
          </mesh>
          <EntryGlow glow={heat * 0.6} scale={scale * 0.4} />
        </group>
      ))}
      {sinceSplashMs >= 0 && (
        <>
          <mesh
            position={[splashAt[0], 0.02, splashAt[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry
              args={[0.5 + sinceSplashMs / 900, 0.62 + sinceSplashMs / 900, 32]}
            />
            <meshBasicMaterial
              color="#e8f2fb"
              transparent
              opacity={Math.max(0.7 - sinceSplashMs / 2500, 0)}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <ParticleLayers
            elapsedMs={now.sinceMs}
            write={(pools) => {
              writeSplash(sinceSplashMs, pools.plume, pools.dust);
            }}
          />
        </>
      )}
    </group>
  );
}

/** How far above the capsule its label sits. */
const labelHeight = 1.1;

export function splashdownLabels(now: EarthEntryNow | null): SceneLabel[] {
  if (!now) return [];
  const capsule = capsuleAt(now);
  const pieces = piecesAt(now);
  const at = capsule.shown
    ? capsule.place
    : (pieces[0]?.place ?? capsule.place);
  const aboard = now.crewed ? "Crew" : "Samples";
  const lost = now.stage === "brokenUp";
  return [
    {
      text: lost ? `${aboard}: lost` : aboard,
      position: [
        splashdownCentre[0] + at[0],
        // Above the parachutes while they're open, or above the capsule.
        splashdownCentre[1] +
          at[1] +
          (capsule.chutes > 0.3 ? 3.2 : labelHeight) * (now.crewed ? 1 : 0.6),
        splashdownCentre[2] + at[2],
      ],
      testId: lost ? "spacecraft-lost" : "spacecraft-asset",
      className: lost
        ? "crashed-label"
        : now.crewed
          ? "crew-label"
          : "spacecraft-label",
    },
  ];
}
