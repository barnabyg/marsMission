import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  type Group,
  type MeshBasicMaterial,
} from "three";
import type { Timeline } from "../../simulation/simulation";
import { useDisposal, type Point, type SceneLabel } from "../sceneParts";
import { markChanged, softDot } from "../surface/SequenceParticles";
import { particleCount, writeParticleStream } from "./particleStream";
import { assetsOnBoard, spacecraftCentre, stackLayout } from "./spacecraft";
import { MissionStack } from "./spacecraftModels";

/** How far above the middle of the stack the Assets' labels sit. */
const labelHeight = 0.62;

/** A place along the stack and a height above it, in the scene. The stack runs across the shot, which is along z. */
function inTheShot(along: number, height: number): Point {
  return [
    spacecraftCentre[0],
    spacecraftCentre[1] + height,
    spacecraftCentre[2] - along,
  ];
}

/** A solar particle event: a stream of particles sweeping past, and a glow that flickers over the whole shot. */
function SolarParticleEffect() {
  const positions = useMemo(() => new Float32Array(particleCount * 3), []);
  const geometry = useMemo(
    () =>
      new BufferGeometry().setAttribute(
        "position",
        new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage),
      ),
    [positions],
  );
  const dot = useMemo(() => softDot(), []);
  const glow = useRef<MeshBasicMaterial>(null);
  useDisposal(geometry);
  useDisposal(dot);
  useFrame(({ clock }) => {
    const seconds = clock.elapsedTime;
    writeParticleStream(positions, seconds);
    markChanged(geometry);
    if (glow.current) {
      glow.current.opacity =
        0.14 + 0.08 * Math.sin(seconds * 7) * Math.sin(seconds * 2.3);
    }
  });
  return (
    <>
      <mesh>
        {/* Big enough to take in the camera, so it tints the whole shot. */}
        <sphereGeometry args={[9, 16, 12]} />
        <meshBasicMaterial
          ref={glow}
          color="#ffd36b"
          transparent
          opacity={0.14}
          side={BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <points geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          color="#fff4c2"
          size={0.13}
          alphaMap={dot}
          transparent
          opacity={0.85}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </>
  );
}

/** Turns what's inside over slowly about the stack, while `turning`. It only reads the clock, so it can't change a result. */
function Tumble({
  turning,
  children,
}: {
  turning: boolean;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  useFrame((_, seconds) => {
    if (!group.current) return;
    group.current.rotation.x = turning
      ? group.current.rotation.x + seconds * 0.35
      : 0;
  });
  return <group ref={group}>{children}</group>;
}

/**
 * The Mission close up on its way to Mars, with the Assets it carries in the order it carries them. Simple models and
 * generated effects, so it uses no art file (ADR 0005), and it only reads the Timeline, so it can't change anything.
 */
export function SpacecraftScene({
  timeline,
  day,
  particles,
}: {
  timeline: Pick<Timeline, "mission">;
  day: number;
  /** Whether a solar particle event is sweeping past. */
  particles: boolean;
}) {
  const onBoard = assetsOnBoard(timeline.mission, day);
  if (!timeline.mission) return null;
  const lost = onBoard.some((asset) => asset.lost);
  return (
    <group position={spacecraftCentre}>
      {/* Along the stack is across the shot. */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <Tumble turning={lost}>
          <MissionStack onBoard={onBoard} lost={lost} />
        </Tumble>
        {particles && <SolarParticleEffect />}
      </group>
    </group>
  );
}

export function spacecraftLabels(
  timeline: Pick<Timeline, "mission">,
  day: number,
): SceneLabel[] {
  const onBoard = assetsOnBoard(timeline.mission, day);
  const layout = stackLayout(onBoard.length);
  return onBoard.map(({ name, lost }, index) => ({
    text: lost ? `${name}: lost` : name,
    position: inTheShot(layout.assets[index] ?? 0, labelHeight),
    testId: lost ? "spacecraft-lost" : "spacecraft-asset",
    className: lost ? "crashed-label" : "spacecraft-label",
  }));
}
