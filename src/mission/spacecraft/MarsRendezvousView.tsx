import { BackSide } from "three";
import { useTexture, type Point, type SceneLabel } from "../sceneParts";
import { Flame, Flash } from "./EarthOrbitView";
import {
  AscentCabin,
  EarthReturnStage,
  ReturnOrbiter,
  SampleStage,
} from "./homewardModels";
import {
  ascentCraftAt,
  hitFlash,
  marsRendezvousCentre,
  waitingAt,
  type MarsRendezvousNow,
} from "./marsRendezvous";

/** Mars, far larger than the craft and close below them, so that its curve fills the bottom of the shot. */
const marsRadius = 14;
const marsCentre: Point = [-1.5, -marsRadius - 2.3, 7];

/** How far above each craft its label sits. */
const labelHeight = 0.62;

/** A place in the rendezvous's own frame, in the scene. Along the craft, x, is across the shot, and z is towards the camera. */
function inTheShot([x, y, z]: Point): Point {
  return [
    marsRendezvousCentre[0] - z,
    marsRendezvousCentre[1] + y,
    marsRendezvousCentre[2] + x,
  ];
}

function Mars() {
  const texture = useTexture("mars.jpg");
  return (
    <group position={marsCentre}>
      <mesh rotation={[0.3, 2.2, 0]}>
        <sphereGeometry args={[marsRadius, 96, 64]} />
        {/* Glowing a little by itself, as the Sun alone lights it too dimly from here. */}
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={0.7}
          roughness={1}
          metalness={0}
        />
      </mesh>
      {/* A thin dusty haze of atmosphere at the edge. */}
      <mesh>
        <sphereGeometry args={[marsRadius * 1.01, 96, 64]} />
        <meshBasicMaterial
          color="#ffb48a"
          transparent
          opacity={0.14}
          side={BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * The rendezvous in Mars orbit: what lifted off through Mars ascent climbing up from Mars and docking, nose to nose, with
 * what waits to bring it home, or coming in too fast, hitting it and tumbling away. Simple models and generated effects
 * over the same picture of Mars as the Mars orbit view (ADR 0005). It goes by real time played, so it plays the same at
 * every speed and holds while paused, and it only reads the Timeline, so it can't change anything.
 */
export function MarsRendezvousScene({
  now,
}: {
  now: MarsRendezvousNow | null;
}) {
  if (!now) return null;
  const craft = ascentCraftAt(now);
  const flash = hitFlash(now);
  return (
    <group position={marsRendezvousCentre}>
      <Mars />
      {/* Along the craft is across the shot. */}
      <group rotation={[0, -Math.PI / 2, 0]}>
        <group position={waitingAt}>
          {now.crewed ? (
            <EarthReturnStage lost={false} />
          ) : (
            // Its solar arrays spread up and down, so that they don't hide it.
            <group rotation={[Math.PI / 2, 0, 0]}>
              <ReturnOrbiter lost={false} deployed />
            </group>
          )}
        </group>
        {/* Turned to face what waits, nose to nose, and tumbling once it has hit. */}
        <group
          position={craft.place}
          rotation={[craft.tumble, Math.PI, craft.tumble * 0.4]}
        >
          {now.crewed ? (
            <AscentCabin lost={craft.lost} />
          ) : (
            <SampleStage lost={craft.lost} />
          )}
          {craft.burning && (
            <Flame
              x={now.crewed ? -0.26 : -0.35}
              ms={now.sinceMs}
              size={now.crewed ? 0.4 : 0.3}
            />
          )}
        </group>
        {flash && <Flash place={flash.place} share={flash.share} />}
      </group>
    </group>
  );
}

export function marsRendezvousLabels(
  now: MarsRendezvousNow | null,
): SceneLabel[] {
  if (!now) return [];
  const craft = ascentCraftAt(now);
  const aboard = now.crewed ? "Crew" : "Samples";
  return [
    {
      text: now.vehicleName,
      position: inTheShot([waitingAt[0], labelHeight, 0]),
      testId: "spacecraft-asset",
      className: "spacecraft-label",
    },
    {
      text: craft.lost ? `${aboard}: stranded` : aboard,
      position: inTheShot([
        craft.place[0],
        craft.place[1] + labelHeight,
        craft.place[2],
      ]),
      testId: craft.lost ? "spacecraft-lost" : "spacecraft-asset",
      className: craft.lost
        ? "crashed-label"
        : now.crewed
          ? "crew-label"
          : "spacecraft-label",
    },
  ];
}
