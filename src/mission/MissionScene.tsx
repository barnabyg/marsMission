import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import type { Timeline } from "../simulation/simulation";
import {
  marsOrbitLabels,
  MarsOrbitScene,
  marsOrbitShot,
} from "./marsOrbit/MarsOrbitView";
import type { MissionViewId } from "./missionViews";
import type { CameraPose, SceneLabel } from "./sceneParts";
import {
  solarSystemLabels,
  SolarSystemScene,
  solarSystemShot,
} from "./solarSystem/SolarSystemView";

interface MissionSceneProps {
  timeline: Timeline;
  day: number;
  view: MissionViewId;
  /** How many Assets are operating at Mars right now. */
  operatingAssetCount: number;
}

/** Where the one camera goes for each view. */
const shots: Record<MissionViewId, CameraPose> = {
  solarSystem: solarSystemShot,
  marsOrbit: marsOrbitShot,
};

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

function CameraRig({ pose }: { pose: CameraPose }) {
  useFrame(({ camera }) => {
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    // The labels are placed from this camera in the same frame, so they mustn't wait for the render.
    camera.updateMatrixWorld();
  });
  return null;
}

/** Keeps the HTML labels above their objects. Their elements are the layer's children, in the same order. */
function LabelTracker({
  labels,
  layer,
}: {
  labels: SceneLabel[];
  layer: RefObject<HTMLDivElement | null>;
}) {
  const projected = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    labels.forEach(({ position }, index) => {
      const element = layer.current?.children[index];
      if (!(element instanceof HTMLElement)) return;
      projected.set(...position).project(camera);
      const left = ((projected.x + 1) / 2) * size.width;
      const top = ((1 - projected.y) / 2) * size.height;
      element.style.transform = `translate(${left}px, ${top}px)`;
      // Beyond 1 is behind the camera, where the sums would otherwise put it back on screen.
      element.style.visibility = projected.z > 1 ? "hidden" : "visible";
    });
  });
  return null;
}

/** Mission Mode's 3D scene: one Canvas and one camera, holding every view. */
export default function MissionScene({
  timeline,
  day,
  view,
  operatingAssetCount,
}: MissionSceneProps) {
  const labelLayer = useRef<HTMLDivElement>(null);
  const labels =
    view === "marsOrbit"
      ? marsOrbitLabels(timeline, day)
      : solarSystemLabels(timeline, day);

  return (
    <div className="solar-system" data-testid="solar-system-view">
      <Canvas camera={{ position: [...solarSystemShot.position], fov: 45 }}>
        <color attach="background" args={["#05060c"]} />
        <Stars />
        <SolarSystemScene
          timeline={timeline}
          day={day}
          operatingAssetCount={operatingAssetCount}
        />
        <MarsOrbitScene timeline={timeline} day={day} />
        <CameraRig pose={shots[view]} />
        <LabelTracker labels={labels} layer={labelLayer} />
      </Canvas>
      <div ref={labelLayer}>
        {labels.map(({ text, className, testId }, index) => (
          <div
            key={index}
            className={`view-label ${className ?? ""}`}
            data-testid={testId}
          >
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
