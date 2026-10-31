import type { Timeline } from "../../simulation/simulation";
import {
  degreesToRadians,
  useTexture,
  type CameraPose,
  type Point,
  type SceneLabel,
} from "../sceneParts";
import { orbiterPosition, orbitersOn, orbitRadius } from "./marsOrbit";

/**
 * A separate large Mars, well away from the solar system and inside its stars, because the small
 * one moves every day and is lit from the side. The solar system's Sun lights this one too, from
 * behind the camera.
 */
const marsCentre: Point = [0, 0, -20];

/** The camera looks down on the orbit from high enough that the globe never hides an orbiter. */
export const marsOrbitShot: CameraPose = {
  position: [0, 4, -16.9],
  target: marsCentre,
};

const orbiterRadius = 0.035;

function fromMarsCentre([x, y, z]: Point): Point {
  return [marsCentre[0] + x, marsCentre[1] + y, marsCentre[2] + z];
}

function aboveOrbiter([x, y, z]: Point): Point {
  return [x, y + orbiterRadius + 0.02, z];
}

export function MarsOrbitScene({
  timeline,
  day,
}: {
  timeline: Timeline;
  day: number;
}) {
  const texture = useTexture("mars.jpg");
  return (
    <group position={marsCentre}>
      {/* Mars's true tilt, leaning away from the camera so that the equator faces it. */}
      <group rotation={[-25.2 * degreesToRadians, 0, 0]}>
        {/* The spin is deliberately slow, because the true rate would be a blur at these speeds. */}
        <mesh rotation={[0, day * 0.02, 0]}>
          <sphereGeometry args={[1, 96, 96]} />
          <meshStandardMaterial map={texture} roughness={1} metalness={0} />
        </mesh>
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[orbitRadius, 0.004, 8, 240]} />
        <meshBasicMaterial color="#7fe7ff" transparent opacity={0.35} />
      </mesh>
      {orbitersOn(timeline, day).map(({ slot }) => (
        <mesh key={slot} position={orbiterPosition(slot, day)}>
          <sphereGeometry args={[orbiterRadius, 24, 24]} />
          <meshBasicMaterial color="#7fe7ff" />
        </mesh>
      ))}
    </group>
  );
}

export function marsOrbitLabels(timeline: Timeline, day: number): SceneLabel[] {
  return orbitersOn(timeline, day).map(({ name, slot }) => ({
    text: name,
    position: fromMarsCentre(aboveOrbiter(orbiterPosition(slot, day))),
    testId: "mars-orbit-asset",
  }));
}
