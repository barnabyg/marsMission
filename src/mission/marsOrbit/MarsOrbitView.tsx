import type { Timeline } from "../../simulation/simulation";
import {
  useTexture,
  type CameraPose,
  type Point,
  type SceneLabel,
} from "../sceneParts";
import {
  globeSpin,
  landedOn,
  landingMarkersOn,
  marsTiltRadians,
  orbiterPosition,
  orbitersOn,
  orbitRadius,
  surfacePoint,
} from "./marsOrbit";

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

const markerRadius = 0.035;
const landerColor = "#ffe08a";
const crashedColor = "#ff5a44";

function fromMarsCentre([x, y, z]: Point): Point {
  return [marsCentre[0] + x, marsCentre[1] + y, marsCentre[2] + z];
}

function aboveMarker([x, y, z]: Point): Point {
  return [x, y + markerRadius + 0.02, z];
}

function scaled([x, y, z]: Point, factor: number): Point {
  return [x * factor, y * factor, z * factor];
}

/** Everything on or coming down to the surface on a given day, relative to the middle of Mars. */
function surfaceMarkers(timeline: Timeline, day: number) {
  const spin = globeSpin(timeline.mission, day);
  const placesTaken = new Map<string, number>();
  const landed = landedOn(timeline, day).map(({ name, siteName }) => {
    const place = placesTaken.get(siteName) ?? 0;
    placesTaken.set(siteName, place + 1);
    const facing = surfacePoint(siteName, spin, place);
    return {
      text: `${name} at ${siteName}`,
      position: facing,
      facing,
      color: landerColor,
      testId: "mars-surface-asset",
      className: "surface-label",
    };
  });
  const landings = landingMarkersOn(timeline.mission, day).map(
    ({ name, siteName, altitude, crashed }) => {
      const facing = surfacePoint(siteName, spin, 0);
      return {
        text: crashed
          ? `${name}: crashed at ${siteName}`
          : `${name}: landing at ${siteName}`,
        position: scaled(facing, 1 + (orbitRadius - 1) * altitude),
        facing,
        color: crashed ? crashedColor : landerColor,
        testId: "mars-landing",
        className: crashed ? "crashed-label" : "surface-label",
      };
    },
  );
  return [...landed, ...landings];
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
      <group rotation={[marsTiltRadians, 0, 0]}>
        <mesh rotation={[0, globeSpin(timeline.mission, day), 0]}>
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
          <sphereGeometry args={[markerRadius, 24, 24]} />
          <meshBasicMaterial color="#7fe7ff" />
        </mesh>
      ))}
      {surfaceMarkers(timeline, day).map(({ position, color }, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[markerRadius, 24, 24]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

export function marsOrbitLabels(timeline: Timeline, day: number): SceneLabel[] {
  return [
    ...orbitersOn(timeline, day).map(({ name, slot }) => ({
      text: name,
      position: fromMarsCentre(aboveMarker(orbiterPosition(slot, day))),
      testId: "mars-orbit-asset",
    })),
    ...surfaceMarkers(timeline, day).map(
      ({ text, position, facing, testId, className }) => ({
        text,
        position: fromMarsCentre(aboveMarker(position)),
        facing,
        testId,
        className,
      }),
    ),
  ];
}
