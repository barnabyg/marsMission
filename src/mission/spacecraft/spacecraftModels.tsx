import type { ReactNode } from "react";
import type { Point } from "../sceneParts";
import { EarthReturnStage, ReturnOrbiter } from "./homewardModels";
import { stackLayout } from "./spacecraft";

/** What's lost is drawn darkened. */
const lostColor = "#5b3c36";

export function Part({
  color,
  lost,
  double = false,
  children,
}: {
  color: string;
  lost: boolean;
  /** Whether it's seen from inside too, as an open dish is. */
  double?: boolean;
  children: ReactNode;
}) {
  return (
    <mesh>
      {children}
      <meshStandardMaterial
        color={lost ? lostColor : color}
        roughness={0.55}
        metalness={0.35}
        side={double ? 2 : 0}
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

/** Places a part of a model, which takes its position and turn from here. */
export function At({
  position,
  rotation,
  children,
}: {
  position: Point;
  rotation?: Point;
  children: ReactNode;
}) {
  return (
    <group position={position} rotation={rotation ?? [0, 0, 0]}>
      {children}
    </group>
  );
}

const foilGold = "#e0b04a";
const deckSilver = "#c9ccd4";
const panelBlue = "#20345e";

/** One of the orbiter's two solar arrays, on a yoke out along z, in two panels tilted to face the Sun. */
export function SolarArray({ side, lost }: { side: 1 | -1; lost: boolean }) {
  return (
    <>
      <At position={[0, 0, side * 0.33]} rotation={[Math.PI / 2, 0, 0]}>
        <Part color="#8a8d94" lost={lost}>
          <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
        </Part>
      </At>
      {[0.58, 0.9].map((along) => (
        <At
          key={along}
          position={[0, 0, side * along]}
          rotation={[0, 0, -0.75]}
        >
          <Part color={deckSilver} lost={lost}>
            <boxGeometry args={[0.46, 0.012, 0.3]} />
          </Part>
          <At position={[0, 0.008, 0]}>
            <Part color={panelBlue} lost={lost}>
              <boxGeometry args={[0.42, 0.012, 0.26]} />
            </Part>
          </At>
        </At>
      ))}
    </>
  );
}

/**
 * An orbiter: a bus wrapped in gold foil between silver decks, its high-gain dish on a mast above, its engine below
 * and a solar array either side. Folded up for the journey, the arrays lie flat against the bus.
 */
export function Orbiter({
  lost,
  deployed = false,
}: {
  lost: boolean;
  deployed?: boolean;
}) {
  return (
    <>
      <Part color={foilGold} lost={lost}>
        <boxGeometry args={[0.5, 0.46, 0.46]} />
      </Part>
      {[0.24, -0.24].map((y) => (
        <At key={y} position={[0, y, 0]}>
          <Part color={deckSilver} lost={lost}>
            <boxGeometry args={[0.52, 0.03, 0.48]} />
          </Part>
        </At>
      ))}
      <At position={[0, 0.32, 0]}>
        <Part color={deckSilver} lost={lost}>
          <cylinderGeometry args={[0.025, 0.025, 0.14, 8]} />
        </Part>
      </At>
      {/* The dish, opening upward, with its feed standing in the middle. */}
      <At position={[0, 0.42, 0]} rotation={[Math.PI, 0, 0]}>
        <Part color="#eef0f4" lost={lost} double>
          <coneGeometry args={[0.26, 0.09, 28, 1, true]} />
        </Part>
      </At>
      <At position={[0, 0.47, 0]}>
        <Part color={deckSilver} lost={lost}>
          <cylinderGeometry args={[0.012, 0.012, 0.12, 6]} />
        </Part>
      </At>
      <At position={[0.17, 0.33, 0.15]}>
        <Part color={deckSilver} lost={lost}>
          <cylinderGeometry args={[0.018, 0.018, 0.14, 6]} />
        </Part>
      </At>
      <At position={[0, -0.33, 0]}>
        <Part color="#55585f" lost={lost}>
          <coneGeometry args={[0.1, 0.14, 20, 1, true]} />
        </Part>
      </At>
      {deployed ? (
        <>
          <SolarArray side={1} lost={lost} />
          <SolarArray side={-1} lost={lost} />
        </>
      ) : (
        [1, -1].map((side) => (
          <At key={side} position={[0, 0, side * 0.25]}>
            <Part color={panelBlue} lost={lost}>
              <boxGeometry args={[0.44, 0.42, 0.02]} />
            </Part>
          </At>
        ))
      )}
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
  // A return vehicle is an Earth return stage flying to Mars orbit on its own.
  if (kind === "return vehicle") return <EarthReturnStage lost={lost} />;
  if (kind === "return-orbiter") return <ReturnOrbiter lost={lost} />;
  // Whatever lands travels in an aeroshell, each kind its own colour.
  const aeroshell = aeroshellColors[kind];
  if (aeroshell) return <Aeroshell lost={lost} color={aeroshell} />;
  return <Orbiter lost={lost} />;
}

const aeroshellColors: Partial<Record<string, string>> = {
  lander: "#d9d6cf",
  rover: "#eef0f4",
  "fuel-plant": "#e4ddd0",
  habitat: "#dfe3d6",
  lab: "#d6dce6",
  "ascent-vehicle": "#e6d8cf",
};

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
