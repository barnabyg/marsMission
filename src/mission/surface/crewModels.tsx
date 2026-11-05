import { memo } from "react";
import { Quaternion, Vector3 } from "three";
import { Box, Drum } from "./modelParts";

/**
 * The Crew on the surface: the lander they come down in, what's left of it after a crash, and each Crew member in a
 * spacesuit. Simple models made here from three.js shapes, so they use no art file (ADR 0005). Like everything at the
 * surface, they're unlit, with their light worked into their colours.
 */

const hullWhite = "#eceef2";
const stageGrey = "#a9adb6";
const windowDark = "#1b2433";
const legGrey = "#c9cdd6";

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

/**
 * The Crew's lander is taller and wider than a robot's and white: a grey descent stage on four legs, and a crew cabin
 * on top with windows, a hatch facing the camera and a ladder down to the ground.
 */
export const CrewLander = memo(function CrewLander() {
  return (
    <group>
      {crewLanderLegs.map(({ key, foot, middle, length, turn }) => (
        <group key={key}>
          <mesh position={middle} quaternion={turn}>
            <cylinderGeometry args={[0.04, 0.04, length, 6]} />
            <meshBasicMaterial color={legGrey} toneMapped={false} />
          </mesh>
          <mesh position={foot}>
            <cylinderGeometry args={[0.13, 0.15, 0.05, 10]} />
            <meshBasicMaterial color="#8f939c" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* The descent stage's engines, opening downward between the legs. */}
      {crewLanderLegs.map(({ key, foot }) => (
        <Drum
          key={key}
          radii={[0.05, 0.1]}
          height={0.14}
          position={[foot[0] * 0.3, 0.48, foot[2] * 0.3]}
          sides={14}
          color="#55585f"
        />
      ))}
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.36, 8]} />
        <meshBasicMaterial color={stageGrey} toneMapped={false} />
      </mesh>
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
      />
      <mesh position={[0, 1.22, 0]}>
        <cylinderGeometry args={[0.42, 0.46, 0.64, 16]} />
        <meshBasicMaterial color={hullWhite} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.68, 0]}>
        <cylinderGeometry args={[0.16, 0.42, 0.28, 16]} />
        <meshBasicMaterial color="#d7dae0" toneMapped={false} />
      </mesh>
      {/* Seams around the cabin, a docking ring on top, and a block of thrusters at each corner. */}
      <Drum
        radii={[0.455, 0.46]}
        height={0.03}
        position={[0, 0.95, 0]}
        color="#c2c6ce"
      />
      <Drum
        radii={[0.425, 0.43]}
        height={0.03}
        position={[0, 1.5, 0]}
        color="#c2c6ce"
      />
      <Drum
        radii={[0.15, 0.15]}
        height={0.05}
        position={[0, 1.84, 0]}
        color={stageGrey}
      />
      {[1, 3, 5, 7].map((eighth) => {
        const angle = (eighth * Math.PI) / 4;
        return (
          <Box
            key={eighth}
            size={[0.08, 0.1, 0.08]}
            position={[Math.cos(angle) * 0.46, 1.3, Math.sin(angle) * 0.46]}
            rotation={[0, -angle, 0]}
            color="#8f939c"
          />
        );
      })}
      {/* Two windows and the hatch, on the side facing the camera. */}
      {[-0.17, 0.17].map((x) => (
        <Box
          key={x}
          size={[0.13, 0.1, 0.04]}
          position={[x, 1.4, -0.43]}
          color={windowDark}
        />
      ))}
      <Box
        size={[0.26, 0.36, 0.04]}
        position={[0, 1.08, -0.45]}
        color="#c2c6ce"
      />
      <Box
        size={[0.16, 0.66, 0.03]}
        position={[0, 0.5, -0.66]}
        rotation={[-0.35, 0, 0]}
        color={legGrey}
      />
      <Box
        size={[0.06, 0.24, 0.06]}
        position={[0.2, 1.92, 0]}
        color={legGrey}
      />
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
      <mesh position={[0.15, 0.32, 0.2]} rotation={[0.4, 0.5, 1.4]}>
        <cylinderGeometry args={[0.38, 0.44, 0.6, 16]} />
        <meshBasicMaterial color="#8d8a86" toneMapped={false} />
      </mesh>
      <mesh position={[-0.55, 0.2, -0.1]} rotation={[0.2, 0.3, 0.5]}>
        <cylinderGeometry args={[0.55, 0.55, 0.3, 8]} />
        <meshBasicMaterial color="#5f5a55" toneMapped={false} />
      </mesh>
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

/** A Crew member in a white spacesuit with a gold visor and a pack on their back. Their front is along x. */
export const CrewFigure = memo(function CrewFigure() {
  return (
    <group>
      {[-0.045, 0.045].map((z) => (
        <Box
          key={z}
          size={[0.06, 0.16, 0.06]}
          position={[0, 0.08, z]}
          color="#dfe2e8"
        />
      ))}
      <Box size={[0.1, 0.17, 0.17]} position={[0, 0.245, 0]} color="#f4f5f7" />
      <Box
        size={[0.07, 0.15, 0.13]}
        position={[-0.085, 0.26, 0]}
        color="#b4b8c0"
      />
      <mesh position={[0, 0.39, 0]}>
        <sphereGeometry args={[0.065, 14, 10]} />
        <meshBasicMaterial color="#f4f5f7" toneMapped={false} />
      </mesh>
      <mesh position={[0.035, 0.39, 0]} scale={[0.6, 0.8, 1]}>
        <sphereGeometry args={[0.055, 14, 10]} />
        <meshBasicMaterial color="#d9a531" toneMapped={false} />
      </mesh>
    </group>
  );
});
