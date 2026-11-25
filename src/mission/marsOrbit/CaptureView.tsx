import type { SceneLabel } from "../sceneParts";
import { MissionStack } from "../spacecraft/spacecraftModels";
import { stackLayout } from "../spacecraft/spacecraft";
import type { MarsCapture } from "./capture";
import { marsCentre } from "./MarsOrbitView";

export function CaptureVehicle({ capture }: { capture: MarsCapture }) {
  const { x, y, pitch, stage, onBoard } = capture;
  const scale = 0.34 / Math.sqrt(1 + onBoard.length);
  const engine = stackLayout(onBoard.length).cruise - 0.52;
  return (
    <group position={marsCentre}>
      <group
        position={[x, y, 0.16]}
        rotation={[0.22, -0.12, pitch]}
        scale={scale}
      >
        <MissionStack onBoard={onBoard} lost={false} />
        {stage === "burn" && (
          <group position={[engine, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh position={[0, 0.39, 0]}>
              <coneGeometry args={[0.15, 0.8, 24]} />
              <meshBasicMaterial
                color="#77bbff"
                transparent
                opacity={0.69}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[0, 0.19, 0]}>
              <coneGeometry args={[0.1, 0.4, 20]} />
              <meshBasicMaterial color="#fff6d4" />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

export function captureLabels({ onBoard, x, y }: MarsCapture): SceneLabel[] {
  return [
    {
      text: onBoard.map(({ name }) => name).join(", "),
      position: [
        marsCentre[0] + x,
        marsCentre[1] + y + 0.36,
        marsCentre[2] + 0.16,
      ],
      testId: "capture-payload",
    },
  ];
}
