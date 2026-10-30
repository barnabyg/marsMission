import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  SRGBColorSpace,
  TextureLoader,
  TubeGeometry,
  Vector3,
} from "three";
import { addDays, type Timeline } from "../../simulation/simulation";
import {
  orbits,
  planetPosition,
  routePosition,
  spacecraftPosition,
  type Planet,
} from "./orbits";

interface SolarSystemViewProps {
  timeline: Timeline;
  day: number;
  /** How many Assets are operating at Mars right now. */
  operatingAssetCount: number;
}

// Planets are drawn far larger than life, so that they can be seen at this scale.
const sunRadius = 0.13;
const planetRadii: Record<Planet, number> = { earth: 0.09, mars: 0.075 };
const assetOrbitRadius = 0.125;
const degreesToRadians = Math.PI / 180;

function useTexture(fileName: string) {
  return useMemo(() => {
    const texture = new TextureLoader().load(
      `${import.meta.env.BASE_URL}art/${fileName}`,
    );
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 16;
    return texture;
  }, [fileName]);
}

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

function Route({ timeline }: { timeline: Timeline }) {
  const { mission, startDate } = timeline;
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

function Spacecraft({ timeline, day }: { timeline: Timeline; day: number }) {
  const { x, z } = spacecraftPosition(
    timeline.startDate,
    timeline.mission,
    day,
  );
  return (
    <mesh position={[x, 0, z]}>
      <sphereGeometry args={[0.022, 24, 24]} />
      <meshBasicMaterial color="#ffffff" />
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

function Stars() {
  const geometry = useMemo(() => {
    // A fixed sequence rather than Math.random, so the sky looks the same every Turn.
    const positions = new Float32Array(3000 * 3);
    let value = 12345;
    const next = () => {
      value = (value * 16807) % 2147483647;
      return value / 2147483647;
    };
    for (let index = 0; index < positions.length; index += 3) {
      const longitude = next() * Math.PI * 2;
      const height = next() * 2 - 1;
      const across = Math.sqrt(1 - height * height);
      positions[index] = 40 * across * Math.cos(longitude);
      positions[index + 1] = 40 * height;
      positions[index + 2] = 40 * across * Math.sin(longitude);
    }
    return new BufferGeometry().setAttribute(
      "position",
      new BufferAttribute(positions, 3),
    );
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#c9d4ff" size={2.2} sizeAttenuation={false} />
    </points>
  );
}

interface LabelTarget {
  element: RefObject<HTMLDivElement | null>;
  position: Vector3;
}

function placeLabel(element: HTMLDivElement | null, left: number, top: number) {
  if (element) element.style.transform = `translate(${left}px, ${top}px)`;
}

/** Keeps the HTML labels over their objects, which stops them being blurred or thin at 4K. */
function LabelTracker({ targets }: { targets: LabelTarget[] }) {
  const projected = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const { element, position } of targets) {
      projected.copy(position).project(camera);
      const left = ((projected.x + 1) / 2) * size.width;
      const top = ((1 - projected.y) / 2) * size.height;
      placeLabel(element.current, left, top);
    }
  });
  return null;
}

export default function SolarSystemView({
  timeline,
  day,
  operatingAssetCount,
}: SolarSystemViewProps) {
  const date = addDays(timeline.startDate, Math.floor(day));
  const earth = planetPosition("earth", date);
  const mars = planetPosition("mars", date);
  const spacecraft = spacecraftPosition(
    timeline.startDate,
    timeline.mission,
    day,
  );
  const inFlight = day < timeline.mission.arrivalDay;

  const earthLabel = useRef<HTMLDivElement>(null);
  const marsLabel = useRef<HTMLDivElement>(null);
  const spacecraftLabel = useRef<HTMLDivElement>(null);

  const labelTargets: LabelTarget[] = [
    {
      element: earthLabel,
      position: new Vector3(earth.x, planetRadii.earth + 0.05, earth.z),
    },
    {
      element: marsLabel,
      position: new Vector3(mars.x, planetRadii.mars + 0.05, mars.z),
    },
    {
      element: spacecraftLabel,
      position: new Vector3(spacecraft.x, 0.05, spacecraft.z),
    },
  ];

  return (
    <div className="solar-system" data-testid="solar-system-view">
      <Canvas camera={{ position: [0, 3.5, 2.1], fov: 45 }}>
        <color attach="background" args={["#05060c"]} />
        <Stars />
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
        <Route timeline={timeline} />
        {inFlight && <Spacecraft timeline={timeline} day={day} />}
        <OperatingAssetMarkers
          date={date}
          day={day}
          count={operatingAssetCount}
        />
        <LabelTracker targets={labelTargets} />
      </Canvas>
      <div ref={earthLabel} className="view-label">
        <span>Earth</span>
      </div>
      <div ref={marsLabel} className="view-label">
        <span>Mars</span>
      </div>
      <div
        ref={spacecraftLabel}
        className="view-label spacecraft-label"
        hidden={!inFlight}
      >
        <span>{timeline.mission.assetNames.join(", ")}</span>
      </div>
    </div>
  );
}
