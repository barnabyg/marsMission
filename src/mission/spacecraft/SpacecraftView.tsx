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

/** How far above the middle of the stack the Assets' labels sit. */
const labelHeight = 0.62;

/** What's lost on the way is drawn darkened, and turns over slowly with nothing to steady it. */
const lostColor = "#5b3c36";

/** A place along the stack and a height above it, in the scene. The stack runs across the shot, which is along z. */
function inTheShot(along: number, height: number): Point {
  return [
    spacecraftCentre[0],
    spacecraftCentre[1] + height,
    spacecraftCentre[2] - along,
  ];
}

function Part({
  color,
  lost,
  children,
}: {
  color: string;
  lost: boolean;
  children: ReactNode;
}) {
  return (
    <mesh>
      {children}
      <meshStandardMaterial
        color={lost ? lostColor : color}
        roughness={0.55}
        metalness={0.35}
      />
    </mesh>
  );
}

/** The cruise stage that carries everything to Mars: a drum with an engine behind it and a solar panel either side. */
function CruiseStage({ lost }: { lost: boolean }) {
  return (
    <>
      <group rotation={[0, 0, Math.PI / 2]}>
        <Part color="#c9ccd4" lost={lost}>
          <cylinderGeometry args={[0.3, 0.3, 0.6, 24]} />
        </Part>
        {/* The engine's bell, opening out behind. */}
        <group position={[0, 0.42, 0]} rotation={[Math.PI, 0, 0]}>
          <Part color="#55585f" lost={lost}>
            <coneGeometry args={[0.16, 0.26, 20]} />
          </Part>
        </group>
      </group>
      {[1, -1].map((side) => (
        <group key={side} position={[0, side * 0.85, 0]}>
          <Part color="#20345e" lost={lost}>
            <boxGeometry args={[0.5, 1.1, 0.03]} />
          </Part>
        </group>
      ))}
    </>
  );
}

/** An orbiter folded up for the journey: a gold-wrapped body with its dish on top. */
function Orbiter({ lost }: { lost: boolean }) {
  return (
    <>
      <Part color="#d6a640" lost={lost}>
        <boxGeometry args={[0.6, 0.5, 0.5]} />
      </Part>
      <group position={[0, 0.3, 0]}>
        <Part color="#e8e8ec" lost={lost}>
          <cylinderGeometry args={[0.22, 0.12, 0.06, 24]} />
        </Part>
      </group>
    </>
  );
}

/** A lander or rover, packed inside its aeroshell: a cone narrowing towards the cruise stage, and the heat shield ahead. */
function Aeroshell({ lost, color }: { lost: boolean; color: string }) {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <Part color={color} lost={lost}>
        <coneGeometry args={[0.4, 0.5, 28]} />
      </Part>
      <group position={[0, -0.28, 0]}>
        <Part color="#7a4a2c" lost={lost}>
          <cylinderGeometry args={[0.44, 0.44, 0.08, 28]} />
        </Part>
      </group>
    </group>
  );
}

function AssetModel({ kind, lost }: { kind: string; lost: boolean }) {
  if (kind === "lander") return <Aeroshell lost={lost} color="#d9d6cf" />;
  if (kind === "rover") return <Aeroshell lost={lost} color="#eef0f4" />;
  return <Orbiter lost={lost} />;
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
  const layout = stackLayout(onBoard.length);
  const lost = onBoard.some((asset) => asset.lost);
  const last = layout.assets.at(-1);
  return (
    <group position={spacecraftCentre}>
      {/* Along the stack is across the shot. */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <Tumble turning={lost}>
          {last !== undefined && (
            <group
              position={[(layout.cruise + last) / 2, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <Part color="#8a8d94" lost={lost}>
                <cylinderGeometry
                  args={[0.05, 0.05, last - layout.cruise, 8]}
                />
              </Part>
            </group>
          )}
          <group position={[layout.cruise, 0, 0]}>
            <CruiseStage lost={lost} />
          </group>
          {onBoard.map((asset, index) => (
            <group
              key={asset.name}
              position={[layout.assets[index] ?? 0, 0, 0]}
            >
              <AssetModel kind={asset.kind} lost={asset.lost} />
            </group>
          ))}
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
