import { AdditiveBlending, BackSide } from "three";
import type { Timeline } from "../../simulation/simulation";
import { useTexture, type Point, type SceneLabel } from "../sceneParts";
import {
  approachMs,
  lossFlash,
  msSinceLoss,
  tankerAt,
  type EarthOrbitNow,
} from "./refuelling";
import {
  earthOrbitCentre,
  earthOrbitLayout,
  onBoardLabelClass,
  stackLayout,
  tankerLength,
  upperStageLength,
} from "./spacecraft";
import { MissionStack, Part } from "./spacecraftModels";

/** How far above the middle of the Mission the labels sit. */
const labelHeight = 0.62;

/** Earth, far larger than the Mission and close below it, so that its curve fills the bottom of the shot. */
const earthRadius = 14;
const earthCentre: Point = [1.5, -earthRadius - 2.3, -7];

/** A place in Earth orbit's own frame, in the scene. Along the Mission, x, is across the shot, and z is towards the camera. */
function inTheShot([x, y, z]: Point): Point {
  return [
    earthOrbitCentre[0] + z,
    earthOrbitCentre[1] + y,
    earthOrbitCentre[2] - x,
  ];
}

function Earth() {
  const texture = useTexture("earth.jpg");
  return (
    <group position={earthCentre}>
      {/* Turned with the equator up, over ocean and islands. */}
      <mesh rotation={[-Math.PI / 2, Math.PI / 2, 0]}>
        <sphereGeometry args={[earthRadius, 96, 64]} />
        {/* Glowing a little by itself, as the photo is of the day side, which the Sun alone lights too dimly from here. */}
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={0.8}
          roughness={0.9}
          metalness={0}
        />
      </mesh>
      {/* A thin blue haze of atmosphere at the edge. */}
      <mesh>
        <sphereGeometry args={[earthRadius * 1.015, 96, 64]} />
        <meshBasicMaterial
          color="#6fa8ff"
          transparent
          opacity={0.18}
          side={BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Cylinder({
  x,
  radius,
  length,
  color,
  lost,
}: {
  x: number;
  radius: number;
  length: number;
  color: string;
  lost: boolean;
}) {
  return (
    <group position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <Part color={color} lost={lost}>
        <cylinderGeometry args={[radius, radius, length, 28]} />
      </Part>
    </group>
  );
}

/** A rocket engine's flame, pointing back along -x from where it starts. It flickers by real time played, so a pause holds it. */
export function Flame({
  x,
  ms,
  size,
}: {
  x: number;
  ms: number;
  size: number;
}) {
  const length = size * (1 + 0.15 * Math.sin(ms / 37) * Math.sin(ms / 53));
  return (
    <group position={[x - length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <coneGeometry args={[size * 0.3, length, 16]} />
        <meshBasicMaterial
          color="#ffb347"
          transparent
          opacity={0.85}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** The Tanker: a long propellant tank with a docking collar at the front, x, and an engine behind. Made here, so no art file. */
function Tanker({
  lost,
  burning,
  ms,
}: {
  lost: boolean;
  burning: boolean;
  ms: number;
}) {
  const half = tankerLength / 2;
  return (
    <>
      <Cylinder
        x={-0.06}
        radius={0.28}
        length={tankerLength - 0.32}
        color="#e9eaee"
        lost={lost}
      />
      <Cylinder
        x={0.1}
        radius={0.285}
        length={0.22}
        color="#d9792b"
        lost={lost}
      />
      <Cylinder
        x={half - 0.1}
        radius={0.13}
        length={0.2}
        color="#8a8d94"
        lost={lost}
      />
      <group position={[-half + 0.12, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <Part color="#55585f" lost={lost}>
          <coneGeometry args={[0.18, 0.24, 20]} />
        </Part>
      </group>
      {[1, -1].map((side) => (
        <group key={side} position={[-0.2, side * 0.62, 0]}>
          <Part color="#20345e" lost={lost}>
            <boxGeometry args={[0.36, 0.62, 0.03]} />
          </Part>
        </group>
      ))}
      {burning && <Flame x={-half} ms={ms} size={0.55} />}
    </>
  );
}

/** The upper stage that refuels and then makes the Mars transfer burn, with its docking collar at the back. */
function UpperStage({ lost }: { lost: boolean }) {
  return (
    <>
      <Cylinder
        x={0.04}
        radius={0.36}
        length={upperStageLength - 0.08}
        color="#d4d7dd"
        lost={lost}
      />
      <Cylinder
        x={-upperStageLength / 2}
        radius={0.13}
        length={0.08}
        color="#8a8d94"
        lost={lost}
      />
    </>
  );
}

/** Propellant flowing across the docking port: a glow that swells and fades by real time played, so a pause holds it. */
function TransferGlow({ x, ms }: { x: number; ms: number }) {
  return (
    <mesh position={[x, 0, 0]}>
      <sphereGeometry args={[0.24, 20, 14]} />
      <meshBasicMaterial
        color="#9fd8ff"
        transparent
        opacity={0.35 + 0.3 * Math.sin(ms / 160)}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** A burst of light where the Mission was lost, growing and fading. */
export function Flash({ place, share }: { place: Point; share: number }) {
  return (
    <mesh position={place}>
      <sphereGeometry args={[0.25 + share * 1.3, 24, 16]} />
      <meshBasicMaterial
        color="#ffd9a0"
        transparent
        opacity={0.9 * (1 - share)}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * The Mission in Earth orbit for Orbital refuelling: the Tanker climbing from Earth, holding nearby, docking, then
 * leaving, or colliding. Simple models and generated effects over the same photo of Earth as the solar system view
 * (ADR 0005). It goes by real time played since each entry, so it plays the same at every speed and holds while paused,
 * and it only reads the Timeline, so it can't change anything.
 */
export function EarthOrbitScene({
  timeline,
  now,
}: {
  timeline: Pick<Timeline, "mission">;
  now: EarthOrbitNow | null;
}) {
  if (!now || !timeline.mission) return null;
  const assets = timeline.mission.assets;
  const layout = earthOrbitLayout(assets.length);
  const lost = now.missionLost;
  const onBoard = assets.map(({ name, kind }) => ({ name, kind, lost }));
  const tanker = tankerAt(now);
  const flash = lossFlash(now);
  const sinceLoss = msSinceLoss(now) ?? 0;
  // Only a collision sets the wreck turning. A Mission stranded by a lost Tanker stays steady.
  const turned = now.stage === "collided" ? sinceLoss * 0.0005 : 0;
  const sinceRendezvous = now.sinceRendezvousMs ?? 0;
  return (
    <group position={earthOrbitCentre}>
      <Earth />
      {/* Along the Mission is across the shot. */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <group rotation={[turned, 0, turned * 0.3]}>
          <group position={[layout.upperStage, 0, 0]}>
            <UpperStage lost={lost} />
          </group>
          <group position={[layout.stack, 0, 0]}>
            <MissionStack onBoard={onBoard} lost={lost} />
          </group>
        </group>
        {tanker && (
          <group
            position={[
              layout.tanker + tanker.place[0],
              tanker.place[1],
              tanker.place[2],
            ]}
            rotation={[
              tanker.lost ? -turned * 1.6 : 0,
              0,
              tanker.lost ? turned : 0,
            ]}
          >
            <Tanker
              lost={tanker.lost}
              burning={tanker.burning}
              ms={now.sinceTankerMs ?? 0}
            />
          </group>
        )}
        {now.stage === "refuelling" && (
          <TransferGlow x={layout.dock} ms={sinceRendezvous - approachMs} />
        )}
        {flash && (
          <Flash
            place={[
              layout.dock + flash.place[0],
              flash.place[1],
              flash.place[2],
            ]}
            share={flash.share}
          />
        )}
      </group>
    </group>
  );
}

export function earthOrbitLabels(
  timeline: Pick<Timeline, "mission">,
  now: EarthOrbitNow | null,
): SceneLabel[] {
  const assets = timeline.mission?.assets ?? [];
  if (!now) return [];
  const layout = earthOrbitLayout(assets.length);
  const along = stackLayout(assets.length).assets;
  const lost = now.missionLost;
  const tanker = tankerAt(now);
  return [
    ...assets.map(({ name, kind }, index) => ({
      text: lost ? `${name}: lost` : name,
      position: inTheShot([layout.stack + (along[index] ?? 0), labelHeight, 0]),
      testId: lost ? "spacecraft-lost" : "spacecraft-asset",
      className: onBoardLabelClass(kind, lost),
    })),
    ...(tanker
      ? [
          {
            text: tanker.lost ? "Tanker: wrecked" : "Tanker",
            position: inTheShot([
              layout.tanker + tanker.place[0],
              tanker.place[1] + labelHeight + 0.2,
              tanker.place[2],
            ]),
            testId: "spacecraft-tanker",
            className: tanker.lost ? "crashed-label" : "spacecraft-label",
          },
        ]
      : []),
  ];
}
