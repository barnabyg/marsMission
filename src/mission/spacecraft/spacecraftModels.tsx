import type { ReactNode } from "react";
import { stackLayout } from "./spacecraft";

/** What's lost is drawn darkened. */
const lostColor = "#5b3c36";

export function Part({
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
export function Orbiter({ lost }: { lost: boolean }) {
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

/**
 * The Crew's ship: a white habitat drum with a band of windows, a capsule at its front for the descent, and a radiator
 * above and below, so that it reads apart from any robot on board.
 */
function CrewVehicle({ lost }: { lost: boolean }) {
  return (
    <>
      <group rotation={[0, 0, Math.PI / 2]}>
        <Part color="#eceef2" lost={lost}>
          <cylinderGeometry args={[0.3, 0.3, 0.5, 24]} />
        </Part>
        <group position={[0, 0.02, 0]}>
          <Part color="#26324a" lost={lost}>
            <cylinderGeometry args={[0.305, 0.305, 0.07, 24]} />
          </Part>
        </group>
        {/* The capsule, narrowing ahead of the drum. */}
        <group position={[0, -0.36, 0]} rotation={[Math.PI, 0, 0]}>
          <Part color="#d7dae0" lost={lost}>
            <cylinderGeometry args={[0.12, 0.27, 0.22, 24]} />
          </Part>
        </group>
      </group>
      {[1, -1].map((side) => (
        <group key={side} position={[-0.05, side * 0.46, 0]}>
          <Part color="#f4f5f7" lost={lost}>
            <boxGeometry args={[0.34, 0.3, 0.03]} />
          </Part>
        </group>
      ))}
    </>
  );
}

function AssetModel({ kind, lost }: { kind: string; lost: boolean }) {
  if (kind === "crew") return <CrewVehicle lost={lost} />;
  if (kind === "lander") return <Aeroshell lost={lost} color="#d9d6cf" />;
  if (kind === "rover") return <Aeroshell lost={lost} color="#eef0f4" />;
  return <Orbiter lost={lost} />;
}

/**
 * The Mission on its way: the cruise stage with the Assets after it in the order it carries them, on a boom along x.
 * Simple models made here, so they use no art file (ADR 0005).
 */
export function MissionStack({
  onBoard,
  lost,
}: {
  onBoard: readonly { name: string; kind: string; lost: boolean }[];
  /** Whether the whole Mission is lost, which darkens the cruise stage too. */
  lost: boolean;
}) {
  const layout = stackLayout(onBoard.length);
  const last = layout.assets.at(-1);
  return (
    <>
      {last !== undefined && (
        <group
          position={[(layout.cruise + last) / 2, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <Part color="#8a8d94" lost={lost}>
            <cylinderGeometry args={[0.05, 0.05, last - layout.cruise, 8]} />
          </Part>
        </group>
      )}
      <group position={[layout.cruise, 0, 0]}>
        <CruiseStage lost={lost} />
      </group>
      {onBoard.map((asset, index) => (
        <group key={asset.name} position={[layout.assets[index] ?? 0, 0, 0]}>
          <AssetModel kind={asset.kind} lost={asset.lost} />
        </group>
      ))}
    </>
  );
}
