import { useMemo } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  CatmullRomCurve3,
  TubeGeometry,
  Vector3,
} from "three";
import { addDays, type Timeline } from "../../simulation/simulation";
import {
  degreesToRadians,
  useTexture,
  type CameraPose,
  type SceneLabel,
} from "../sceneParts";
import {
  journeyHasFailed,
  orbits,
  planetPosition,
  routePosition,
  spacecraftPosition,
  type Planet,
} from "./orbits";

type Journey = NonNullable<Timeline["mission"]>;

interface SolarSystemSceneProps {
  timeline: Timeline;
  day: number;
  /** How many Assets are operating at Mars right now. */
  operatingAssetCount: number;
}

export const solarSystemShot: CameraPose = {
  position: [0, 3.5, 2.1],
  target: [0, 0, 0],
};

// Planets are drawn far larger than life, so that they can be seen at this scale.
const sunRadius = 0.13;
const planetRadii: Record<Planet, number> = { earth: 0.09, mars: 0.075 };
const assetOrbitRadius = 0.125;

function Sun() {
  const glow = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      gradient.addColorStop(0, "rgba(255, 220, 150, 1)");
      gradient.addColorStop(0.25, "rgba(255, 170, 70, 0.55)");
      gradient.addColorStop(1, "rgba(255, 120, 30, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    }
    return new CanvasTexture(canvas);
  }, []);

  return (
    <>
      <mesh>
        <sphereGeometry args={[sunRadius, 48, 48]} />
        <meshBasicMaterial color="#ffe2a8" />
      </mesh>
      <sprite scale={[0.9, 0.9, 1]}>
        <spriteMaterial
          map={glow}
          blending={AdditiveBlending}
          depthWrite={false}
          transparent
        />
      </sprite>
      <pointLight intensity={3.2} decay={0} />
      <ambientLight intensity={0.22} />
    </>
  );
}

function OrbitRing({ planet, color }: { planet: Planet; color: string }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[orbits[planet].radius, 0.0022, 8, 360]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </mesh>
  );
}

function PlanetGlobe({
  planet,
  fileName,
  date,
  day,
  tiltDegrees,
}: {
  planet: Planet;
  fileName: string;
  date: string;
  day: number;
  tiltDegrees: number;
}) {
  const texture = useTexture(fileName);
  const { x, z } = planetPosition(planet, date);
  return (
    <group
      position={[x, 0, z]}
      rotation={[tiltDegrees * degreesToRadians, 0, 0]}
    >
      {/* The spin is deliberately slow, because the true rate would be a blur at these speeds. */}
      <mesh rotation={[0, day * 0.02, 0]}>
        <sphereGeometry args={[planetRadii[planet], 64, 64]} />
        <meshStandardMaterial map={texture} roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

function Route({
  mission,
  startDate,
}: {
  mission: Journey;
  startDate: string;
}) {
  const geometry = useMemo(() => {
    const points: Vector3[] = [];
    for (let step = 0; step <= 120; step++) {
      const { x, z } = routePosition(startDate, mission, step / 120);
      points.push(new Vector3(x, 0, z));
    }
    return new TubeGeometry(new CatmullRomCurve3(points), 480, 0.0045, 8);
  }, [mission, startDate]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color="#ffb37a" />
    </mesh>
  );
}

function Spacecraft({
  mission,
  startDate,
  day,
  lost,
}: {
  mission: Journey;
  startDate: string;
  day: number;
  lost: boolean;
}) {
  const { x, z } = spacecraftPosition(startDate, mission, day);
  return (
    <mesh position={[x, 0, z]}>
      <sphereGeometry args={[0.022, 24, 24]} />
      <meshBasicMaterial color={lost ? "#ff5a44" : "#ffffff"} />
    </mesh>
  );
}

/** One small marker circling Mars for each operating Asset. */
function OperatingAssetMarkers({
  date,
  day,
  count,
}: {
  date: string;
  day: number;
  count: number;
}) {
  const { x, z } = planetPosition("mars", date);
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: count }, (_, index) => {
        const angle = day * 0.05 + (index / count) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * assetOrbitRadius,
              0.02,
              Math.sin(angle) * assetOrbitRadius,
            ]}
          >
            <sphereGeometry args={[0.012, 16, 16]} />
            <meshBasicMaterial color="#7fe7ff" />
          </mesh>
        );
      })}
    </group>
  );
}

export function SolarSystemScene({
  timeline,
  day,
  operatingAssetCount,
}: SolarSystemSceneProps) {
  const date = addDays(timeline.startDate, Math.floor(day));
  const { mission, startDate } = timeline;
  const failed = mission !== null && journeyHasFailed(mission, day);
  const inTransit = mission !== null && !failed && day < mission.arrivalDay;

  return (
    <>
      <Sun />
      <OrbitRing planet="earth" color="#5f8fd0" />
      <OrbitRing planet="mars" color="#c9744a" />
      <PlanetGlobe
        planet="earth"
        fileName="earth.jpg"
        date={date}
        day={day}
        tiltDegrees={23.4}
      />
      <PlanetGlobe
        planet="mars"
        fileName="mars.jpg"
        date={date}
        day={day}
        tiltDegrees={25.2}
      />
      {mission && <Route mission={mission} startDate={startDate} />}
      {mission && (inTransit || failed) && (
        <Spacecraft
          mission={mission}
          startDate={startDate}
          day={day}
          lost={failed}
        />
      )}
      <OperatingAssetMarkers
        date={date}
        day={day}
        count={operatingAssetCount}
      />
    </>
  );
}

export function solarSystemLabels(
  timeline: Timeline,
  day: number,
): SceneLabel[] {
  const date = addDays(timeline.startDate, Math.floor(day));
  const earth = planetPosition("earth", date);
  const mars = planetPosition("mars", date);
  const { mission, startDate } = timeline;
  const labels: SceneLabel[] = [
    {
      text: "Earth",
      position: [earth.x, 0, earth.z - planetRadii.earth - 0.02],
    },
    {
      text: "Mars",
      position: [mars.x, 0, mars.z - planetRadii.mars - 0.02],
    },
  ];
  if (mission && !journeyHasFailed(mission, day) && day < mission.arrivalDay) {
    const spacecraft = spacecraftPosition(startDate, mission, day);
    labels.push({
      text: mission.assetNames.join(", "),
      position: [spacecraft.x, 0, spacecraft.z - 0.04],
      className: "spacecraft-label",
    });
  }
  return labels;
}
