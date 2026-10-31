import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import type { Timeline } from "../simulation/simulation";
import { advanceMove, headFor, poseDuring, settledAt } from "./cameraMove";
import {
  marsOrbitLabels,
  MarsOrbitScene,
  marsOrbitShot,
} from "./marsOrbit/MarsOrbitView";
import type { MissionViewId } from "./missionViews";
import type { CameraPose, SceneLabel } from "./sceneParts";
import {
  surfaceLabels,
  SurfaceScene,
  surfaceShot,
} from "./surface/SurfaceView";
import {
  solarSystemLabels,
  SolarSystemScene,
  solarSystemShot,
} from "./solarSystem/SolarSystemView";

interface MissionSceneProps {
  timeline: Timeline;
  day: number;
  view: MissionViewId;
  /** The Landing Site the surface view shows, or null if there is none to show. */
  site: string | null;
  /** How many Assets are operating at Mars right now. */
  operatingAssetCount: number;
}

/** Where the one camera goes for each view, and the labels that go with it. */
const viewSettings: Record<
  MissionViewId,
  {
    shot: CameraPose;
    labels: (
      timeline: Timeline,
      day: number,
      site: string | null,
    ) => SceneLabel[];
  }
> = {
  solarSystem: { shot: solarSystemShot, labels: solarSystemLabels },
  marsOrbit: { shot: marsOrbitShot, labels: marsOrbitLabels },
  surface: { shot: surfaceShot, labels: surfaceLabels },
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

/**
 * Eases the camera to the view's shot. It counts real time, not game time, so that a move carries
 * on at the same pace at every speed and while paused.
 */
function CameraRig({ shot }: { shot: CameraPose }) {
  const move = useRef(settledAt(shot));
  useFrame(({ camera, gl }, seconds) => {
    if (move.current.to !== shot) move.current = headFor(move.current, shot);
    move.current = advanceMove(move.current, seconds * 1000);
    const { position, target } = poseDuring(move.current);
    camera.position.set(...position);
    camera.lookAt(...target);
    // The labels are placed from this camera in the same frame, so they mustn't wait for the render.
    camera.updateMatrixWorld();
    // The browser tests can't see into the scene, so this is how they check a move is smooth.
    gl.domElement.dataset.cameraPosition = position
      .map((value) => value.toFixed(3))
      .join(" ");
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
  const toCamera = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    labels.forEach(({ position, facing }, index) => {
      const element = layer.current?.children[index];
      if (!(element instanceof HTMLElement)) return;
      projected.set(...position).project(camera);
      const left = ((projected.x + 1) / 2) * size.width;
      const top = ((1 - projected.y) / 2) * size.height;
      element.style.transform = `translate(${left}px, ${top}px)`;
      // Beyond 1 is behind the camera, where the sums would otherwise put it back on screen.
      const behindCamera = projected.z > 1;
      const onFarSide =
        facing !== undefined &&
        toCamera
          .copy(camera.position)
          .sub(projected.set(...position))
          .dot(projected.set(...facing)) <= 0;
      element.style.visibility =
        behindCamera || onFarSide ? "hidden" : "visible";
    });
  });
  return null;
}

/** Mission Mode's 3D scene: one Canvas and one camera, holding every view. */
export default function MissionScene({
  timeline,
  day,
  view,
  site,
  operatingAssetCount,
}: MissionSceneProps) {
  const labelLayer = useRef<HTMLDivElement>(null);
  const { shot, labels: labelsOnDay } = viewSettings[view];
  const labels = labelsOnDay(timeline, day, site);

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
        {site !== null && (
          <SurfaceScene timeline={timeline} day={day} siteName={site} />
        )}
        <CameraRig shot={shot} />
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
