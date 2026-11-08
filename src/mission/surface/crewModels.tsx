import { memo } from "react";
import { Quaternion, Vector3 } from "three";
import type { Point } from "../sceneParts";
import { Antenna, blanketSeams } from "./modelDetails";
import {
  Batched,
  Box,
  Drum,
  PartSet,
  Shape,
  type SetPiece,
} from "./modelParts";

/**
 * The Crew on the surface: the lander they come down in, what's left of it after a crash, and each Crew member in a
 * spacesuit. Simple models made here from three.js shapes, so they use no art file (ADR 0005).
 */

const hullWhite = "#eceef2";
const stageGrey = "#a9adb6";
const windowDark = "#1b2433";
const legGrey = "#c9cdd6";
const thrusterGrey = "#8f939c";

/** Each of the Crew lander's legs, from its foot on the ground up to the descent stage, wider set than a robot's. */
const crewLanderLegs = (
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const
).map(([x, z]) => {
  const foot = new Vector3(x * 0.62, 0.03, z * 0.62);
  const top = new Vector3(x * 0.34, 0.6, z * 0.34);
  const along = top.clone().sub(foot);
  return {
    key: `${x},${z}`,
    foot: foot.toArray(),
    middle: foot.clone().add(top).multiplyScalar(0.5).toArray(),
    length: along.length(),
    turn: new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      along.normalize(),
    ),
  };
});

/** The ladder's rails and rungs, leaning out from the stage to the ground in front, towards the camera. */
const ladder: SetPiece[] = [
  ...[-0.07, 0.07].map((x): SetPiece => ({
    size: [0.02, 0.68, 0.02],
    position: [x, 0.5, -0.67],
    rotation: [-0.35, 0, 0],
  })),
  ...[0.22, 0.36, 0.5, 0.64, 0.78].map((y): SetPiece => ({
    size: [0.14, 0.014, 0.014],
    position: [0, y, -0.67 + (y - 0.5) * Math.tan(0.35)],
  })),
];

/** The Crew lander's descent stage: four legs, the engines between them, the stage itself and the ladder. It stays on the ground when the cabin lifts off. */
export const CrewDescentStage = memo(function CrewDescentStage() {
  return (
    <Batched>
      {crewLanderLegs.map(({ key, foot, middle, length, turn }) => (
        <group key={key}>
          <group position={middle} quaternion={turn}>
            <Shape position={[0, 0, 0]} color={legGrey} finish="metal">
              <cylinderGeometry args={[0.04, 0.04, length, 6]} />
            </Shape>
          </group>
          <Drum
            radii={[0.13, 0.15]}
            height={0.05}
            position={foot}
            sides={12}
            color={thrusterGrey}
            finish="metal"
          />
        </group>
      ))}
      {/* The descent stage's engines, opening downward between the legs. */}
      <PartSet
        pieces={crewLanderLegs.map(({ foot }) => ({
          radii: [0.05, 0.1],
          height: 0.14,
          sides: 14,
          position: [foot[0] * 0.3, 0.48, foot[2] * 0.3],
        }))}
        color="#55585f"
        finish="metal"
      />
      <Drum
        radii={[0.6, 0.6]}
        height={0.36}
        position={[0, 0.72, 0]}
        sides={8}
        color={stageGrey}
        finish="foil"
      />
      <PartSet
        pieces={blanketSeams({
          radius: 0.6,
          height: 0.34,
          centre: [0, 0.72, 0],
          count: 8,
          bands: [0.78],
        })}
        color="#8a8e97"
        finish="foil"
      />
      {/* A darker band at the stage's foot and a lighter rim at its top. */}
      <Drum
        radii={[0.61, 0.61]}
        height={0.06}
        position={[0, 0.57, 0]}
        sides={8}
        color="#8a8e97"
      />
      <Drum
        radii={[0.62, 0.62]}
        height={0.03}
        position={[0, 0.89, 0]}
        sides={8}
        color="#c2c6ce"
        finish="metal"
      />
      {/* Propellant tanks showing between the stage's sides, and the ladder. */}
      <PartSet
        pieces={[0.55, -0.55].map((x) => ({
          radii: [0.12, 0.12],
          height: 0.26,
          sides: 14,
          position: [x, 0.72, 0.28],
        }))}
        color="#d7dae0"
      />
      <PartSet pieces={ladder} color={legGrey} finish="metal" />
    </Batched>
  );
});

/** How high the cabin sits on the descent stage, where its ascent engine fires from. */
export const crewCabinBase = 0.9;

/** A block of four small thrusters, as each corner of the cabin has, pointing out from it. */
function thrusterQuad(angle: number, y: number): SetPiece[] {
  const [x, z] = [Math.cos(angle) * 0.5, Math.sin(angle) * 0.5];
  const out: Point = [Math.cos(angle) * 0.04, 0, Math.sin(angle) * 0.04];
  return [
    { size: [0.08, 0.1, 0.08], position: [x, y, z], rotation: [0, -angle, 0] },
    {
      radii: [0.012, 0.02],
      height: 0.04,
      sides: 8,
      position: [x, y + 0.07, z],
    },
    {
      radii: [0.02, 0.012],
      height: 0.04,
      sides: 8,
      position: [x, y - 0.07, z],
    },
    {
      radii: [0.012, 0.02],
      height: 0.04,
      sides: 8,
      position: [x + out[0], y, z + out[2]],
      rotation: [0, -angle, -Math.PI / 2],
    },
  ];
}

/** The crew cabin, which lifts off from the descent stage through Mars ascent: windows, a hatch, thrusters and a docking ring. */
export const CrewCabin = memo(function CrewCabin() {
  return (
    <Batched>
      <Drum
        radii={[0.42, 0.46]}
        height={0.64}
        position={[0, 1.22, 0]}
        color={hullWhite}
      />
      <Drum
        radii={[0.16, 0.42]}
        height={0.28}
        position={[0, 1.68, 0]}
        color="#d7dae0"
      />
      {/* Seams around the cabin, a docking ring on top, and a block of thrusters at each corner. */}
      <PartSet
        pieces={[
          {
            radii: [0.455, 0.46],
            height: 0.03,
            position: [0, 0.95, 0],
            sides: 16,
          },
          {
            radii: [0.425, 0.43],
            height: 0.03,
            position: [0, 1.5, 0],
            sides: 16,
          },
          {
            radii: [0.44, 0.445],
            height: 0.012,
            position: [0, 1.23, 0],
            sides: 16,
          },
        ]}
        color="#c2c6ce"
      />
      <Drum
        radii={[0.15, 0.15]}
        height={0.05}
        position={[0, 1.84, 0]}
        color={stageGrey}
        finish="metal"
      />
      <Drum
        radii={[0.12, 0.12]}
        height={0.03}
        position={[0, 1.88, 0]}
        color="#55585f"
        finish="metal"
      />
      <PartSet
        pieces={[1, 3, 5, 7].flatMap((eighth) =>
          thrusterQuad((eighth * Math.PI) / 4, 1.3),
        )}
        color={thrusterGrey}
        finish="metal"
      />
      {/* Two windows in their frames, and the hatch with its handle, on the side facing the camera. */}
      <PartSet
        pieces={[-0.17, 0.17].map((x) => ({
          size: [0.16, 0.13, 0.03],
          position: [x, 1.4, -0.425],
        }))}
        color={stageGrey}
        finish="metal"
      />
      {[-0.17, 0.17].map((x) => (
        <Box
          key={x}
          size={[0.13, 0.1, 0.04]}
          position={[x, 1.4, -0.43]}
          color={windowDark}
          finish="glass"
        />
      ))}
      <Box
        size={[0.26, 0.36, 0.04]}
        position={[0, 1.08, -0.45]}
        color="#c2c6ce"
      />
      <Box
        size={[0.08, 0.02, 0.03]}
        position={[0.07, 1.08, -0.475]}
        color="#55585f"
        finish="metal"
      />
      <Box
        size={[0.06, 0.24, 0.06]}
        position={[0.2, 1.92, 0]}
        color={legGrey}
      />
      <Antenna base={[-0.2, 1.75, 0.1]} height={0.26} />
    </Batched>
  );
});

/**
 * The Crew's lander is taller and wider than a robot's and white: a grey descent stage on four legs, wrapped in a
 * seamed blanket, and a crew cabin on top with windows, a hatch facing the camera, thrusters and a ladder down to the
 * ground.
 */
export const CrewLander = memo(function CrewLander() {
  return (
    <group>
      <CrewDescentStage />
      <CrewCabin />
    </group>
  );
});

/** What's left of the Crew's lander: its cabin on its side, the descent stage tipped up beside it, and a leg thrown clear. */
export const CrewLanderWreck = memo(function CrewLanderWreck() {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.6, 24]} />
        <meshBasicMaterial color="#0c0705" transparent opacity={0.7} />
      </mesh>
      <Shape
        position={[0.15, 0.32, 0.2]}
        rotation={[0.4, 0.5, 1.4]}
        color="#8d8a86"
      >
        <cylinderGeometry args={[0.38, 0.44, 0.6, 16]} />
      </Shape>
      <Shape
        position={[-0.55, 0.2, -0.1]}
        rotation={[0.2, 0.3, 0.5]}
        color="#5f5a55"
      >
        <cylinderGeometry args={[0.55, 0.55, 0.3, 8]} />
      </Shape>
      <Box
        size={[0.06, 0.85, 0.06]}
        position={[0.95, 0.1, -0.45]}
        rotation={[0.3, 0, 1.4]}
        color="#8f939c"
      />
      <Box
        size={[0.06, 0.7, 0.06]}
        position={[-1.1, 0.1, 0.45]}
        rotation={[-0.4, 0, 1.7]}
        color="#6d7078"
      />
      <Box
        size={[0.3, 0.05, 0.22]}
        position={[0.6, 0.05, 0.75]}
        rotation={[0.1, 0.9, 0.1]}
        color="#b7b9bd"
      />
    </group>
  );
});

/** A Crew member in a white spacesuit with a gold visor, a pack on their back and a lamp on their helmet. Their front is along x. */
export const CrewFigure = memo(function CrewFigure() {
  return (
    <Batched>
      <PartSet
        pieces={[-0.045, 0.045].flatMap((z): SetPiece[] => [
          { size: [0.06, 0.16, 0.06], position: [0, 0.08, z] },
          { size: [0.08, 0.03, 0.065], position: [0.01, 0.015, z] },
        ])}
        color="#dfe2e8"
        finish="matte"
      />
      <Box
        size={[0.1, 0.17, 0.17]}
        position={[0, 0.245, 0]}
        color="#f4f5f7"
        finish="matte"
      />
      {/* Arms, and the panel of controls on the chest. */}
      <PartSet
        pieces={[-0.1, 0.1].map((z) => ({
          size: [0.045, 0.15, 0.045],
          position: [0.01, 0.235, z],
          rotation: [z * 1.2, 0, 0],
        }))}
        color="#e6e8ec"
        finish="matte"
      />
      <Box
        size={[0.02, 0.05, 0.08]}
        position={[0.055, 0.27, 0]}
        color="#8f939c"
      />
      <Box
        size={[0.07, 0.15, 0.13]}
        position={[-0.085, 0.26, 0]}
        color="#b4b8c0"
      />
      <Shape position={[0, 0.39, 0]} color="#f4f5f7">
        <sphereGeometry args={[0.065, 14, 10]} />
      </Shape>
      <Shape
        position={[0.035, 0.39, 0]}
        scale={[0.6, 0.8, 1]}
        color="#d9a531"
        finish="glass"
      >
        <sphereGeometry args={[0.055, 14, 10]} />
      </Shape>
      <Box
        size={[0.02, 0.02, 0.03]}
        position={[0.03, 0.455, 0.035]}
        color="#fff4d6"
        finish="glass"
      />
    </Batched>
  );
});
