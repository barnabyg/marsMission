import { memo } from "react";
import type { Point } from "../sceneParts";
import { Box, Dish, Drum, Rod, splayedLegs } from "./modelParts";

/**
 * The Assets that make a base at a Landing Site: the fuel plant, the habitat and the Mars lab. Simple models made here
 * from three.js shapes, so they use no art file (ADR 0005). Like everything at the surface they're unlit, with their
 * light worked into their colours, and their front, towards the camera, is along -z.
 */

const white = "#eef0f4";
const shade = "#c2c6ce";
const frameGrey = "#a9adb6";
const footGrey = "#8f939c";
const dark = "#1b2433";
const panelBlue = "#24365e";
const panelLine = "#3d5a92";

/** A flat solar panel, its cells drawn as lines across it, tilted back towards the sky. */
function FlatPanel({
  position,
  size,
  tilt,
}: {
  position: Point;
  size: [width: number, depth: number];
  tilt: number;
}) {
  const [width, depth] = size;
  return (
    <group position={position} rotation={[tilt, 0, 0]}>
      <Box
        size={[width + 0.04, 0.02, depth + 0.04]}
        position={[0, -0.012, 0]}
        color={frameGrey}
      />
      <Box size={[width, 0.02, depth]} position={[0, 0, 0]} color={panelBlue} />
      {[-1, 0, 1].map((line) => (
        <Box
          key={line}
          size={[width, 0.022, 0.008]}
          position={[0, 0, (line * depth) / 4]}
          color={panelLine}
        />
      ))}
    </group>
  );
}

/** Four short legs under a platform, with pads on the ground. */
function PlatformLegs({
  x,
  z,
  height,
}: {
  x: number;
  z: number;
  height: number;
}) {
  return (
    <>
      {[
        [-x, -z],
        [x, -z],
        [-x, z],
        [x, z],
      ].map(([legX = 0, legZ = 0]) => (
        <group key={`${legX},${legZ}`}>
          <Rod
            from={[legX, 0.03, legZ]}
            to={[legX, height, legZ]}
            radius={0.03}
            color={frameGrey}
          />
          <Drum
            radii={[0.07, 0.08]}
            height={0.04}
            position={[legX, 0.02, legZ]}
            sides={10}
            color={footGrey}
          />
        </group>
      ))}
    </>
  );
}

const tankOrange = "#e0904a";
const tankShade = "#b86e33";

/** One of the fuel plant's upright propellant tanks, rounded at both ends, with a band around its middle. */
function Tank({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Drum
        radii={[0.16, 0.16]}
        height={0.42}
        position={[0, 0.55, 0]}
        color={tankOrange}
      />
      {[0.76, 0.34].map((y) => (
        <mesh key={y} position={[0, y, 0]} scale={[1, 0.55, 1]}>
          <sphereGeometry args={[0.16, 16, 10]} />
          <meshBasicMaterial
            color={y > 0.5 ? "#f0a862" : tankShade}
            toneMapped={false}
          />
        </mesh>
      ))}
      <Drum
        radii={[0.165, 0.165]}
        height={0.04}
        position={[0, 0.55, 0]}
        color={tankShade}
      />
    </group>
  );
}

/**
 * A fuel plant makes ascent propellant from the air: a white processing unit on a platform, with an intake on its roof,
 * two orange propellant tanks beside it piped to it, a radiator standing at the back and a flat solar panel on a mast.
 */
export const FuelPlant = memo(function FuelPlant() {
  return (
    <group>
      <PlatformLegs x={0.48} z={0.3} height={0.26} />
      <Box
        size={[1.12, 0.06, 0.74]}
        position={[0, 0.27, 0]}
        color={frameGrey}
      />
      {/* The processing unit, with a darker seam and a vent on its front. */}
      <Box
        size={[0.48, 0.4, 0.5]}
        position={[-0.22, 0.5, 0.02]}
        color={white}
      />
      <Box
        size={[0.49, 0.03, 0.51]}
        position={[-0.22, 0.56, 0.02]}
        color={shade}
      />
      <Box
        size={[0.26, 0.12, 0.02]}
        position={[-0.22, 0.44, -0.235]}
        color={dark}
      />
      {/* The intake, drawing in the thin air. */}
      <Drum
        radii={[0.09, 0.07]}
        height={0.16}
        position={[-0.32, 0.78, 0.05]}
        color={shade}
      />
      <Drum
        radii={[0.1, 0.1]}
        height={0.03}
        position={[-0.32, 0.87, 0.05]}
        color={footGrey}
      />
      <Tank x={0.28} z={-0.14} />
      <Tank x={0.28} z={0.2} />
      {/* Pipes from the unit to each tank. */}
      <Rod
        from={[0.02, 0.58, -0.14]}
        to={[0.13, 0.58, -0.14]}
        radius={0.025}
        color={shade}
      />
      <Rod
        from={[0.02, 0.62, 0.2]}
        to={[0.13, 0.62, 0.2]}
        radius={0.025}
        color={shade}
      />
      {/* The radiator, standing at the back. */}
      <Rod
        from={[-0.4, 0.3, 0.33]}
        to={[-0.4, 1.05, 0.33]}
        radius={0.02}
        color={frameGrey}
      />
      <Box
        size={[0.42, 0.5, 0.025]}
        position={[-0.18, 0.88, 0.36]}
        color="#dfe3ea"
      />
      {/* A solar panel on a mast, facing the Sun. */}
      <Rod
        from={[0.45, 0.3, 0.3]}
        to={[0.45, 1.2, 0.3]}
        radius={0.022}
        color={frameGrey}
      />
      <FlatPanel
        position={[0.45, 1.22, 0.3]}
        size={[0.62, 0.42]}
        tilt={-0.45}
      />
    </group>
  );
});

const hullWhite = "#f1f1ee";
const ribShade = "#cfd2d4";

/**
 * The habitat is a long white module lying on its side on a frame, ribbed like an inflated hull, with an airlock towards
 * the camera, a row of windows along its side and solar panels on its back.
 */
export const Habitat = memo(function Habitat() {
  return (
    <group>
      <PlatformLegs x={0.5} z={0.22} height={0.3} />
      <Box size={[1.2, 0.05, 0.56]} position={[0, 0.3, 0]} color={frameGrey} />
      {/* The hull, lying along x. */}
      <Drum
        radii={[0.4, 0.4]}
        height={1.3}
        position={[0, 0.72, 0]}
        rotation={[0, 0, Math.PI / 2]}
        sides={20}
        color={hullWhite}
      />
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.72, 0]} scale={[0.45, 1, 1]}>
          <sphereGeometry args={[0.4, 20, 12]} />
          <meshBasicMaterial color={ribShade} toneMapped={false} />
        </mesh>
      ))}
      {[-0.4, -0.13, 0.13, 0.4].map((x) => (
        <Drum
          key={x}
          radii={[0.41, 0.41]}
          height={0.035}
          position={[x, 0.72, 0]}
          rotation={[0, 0, Math.PI / 2]}
          sides={20}
          color={ribShade}
        />
      ))}
      {/* Windows along the side towards the camera. */}
      {[-0.27, 0, 0.27].map((x) => (
        <Box
          key={x}
          size={[0.12, 0.09, 0.02]}
          position={[x, 0.86, -0.36]}
          rotation={[0.45, 0, 0]}
          color={dark}
        />
      ))}
      {/* The airlock, towards the camera, with its hatch. */}
      <Drum
        radii={[0.2, 0.2]}
        height={0.32}
        position={[0.38, 0.62, -0.42]}
        rotation={[Math.PI / 2, 0, 0]}
        color={white}
      />
      <Drum
        radii={[0.14, 0.14]}
        height={0.02}
        position={[0.38, 0.62, -0.585]}
        rotation={[Math.PI / 2, 0, 0]}
        color={shade}
      />
      <Box
        size={[0.03, 0.12, 0.02]}
        position={[0.46, 0.62, -0.6]}
        color={footGrey}
      />
      {/* Solar panels on the back. */}
      <FlatPanel
        position={[-0.32, 1.17, 0.18]}
        size={[0.5, 0.36]}
        tilt={-0.35}
      />
      <FlatPanel
        position={[0.32, 1.17, 0.18]}
        size={[0.5, 0.36]}
        tilt={-0.35}
      />
      <Rod
        from={[-0.32, 1.08, 0.18]}
        to={[-0.32, 1.17, 0.18]}
        radius={0.02}
        color={frameGrey}
      />
      <Rod
        from={[0.32, 1.08, 0.18]}
        to={[0.32, 1.17, 0.18]}
        radius={0.02}
        color={frameGrey}
      />
    </group>
  );
});

const labSilver = "#d9dde4";
const labTeal = "#4fb7c8";

/**
 * The Mars lab is a low silver building on short legs, with a teal band, a glovebox window in its front, an arm reaching
 * out to take in samples, a roof of solar panels, an instrument mast and a dish.
 */
export const MarsLab = memo(function MarsLab() {
  const legs = splayedLegs(0.5, 0.42, 0.3);
  return (
    <group>
      {legs.map(({ key, foot, top }) => (
        <group key={key}>
          <Rod from={foot} to={top} radius={0.03} color={frameGrey} />
          <Drum
            radii={[0.08, 0.1]}
            height={0.05}
            position={foot}
            sides={10}
            color={footGrey}
          />
        </group>
      ))}
      <Box size={[1.0, 0.44, 0.74]} position={[0, 0.52, 0]} color={labSilver} />
      <Box size={[1.01, 0.06, 0.75]} position={[0, 0.4, 0]} color={labTeal} />
      <Box size={[1.04, 0.04, 0.78]} position={[0, 0.75, 0]} color={shade} />
      {/* The glovebox window and the hatch beside it. */}
      <Box
        size={[0.36, 0.16, 0.02]}
        position={[-0.18, 0.58, -0.375]}
        color="#2d4b63"
      />
      <Box
        size={[0.38, 0.02, 0.025]}
        position={[-0.18, 0.67, -0.38]}
        color={frameGrey}
      />
      <Box
        size={[0.2, 0.3, 0.02]}
        position={[0.3, 0.55, -0.375]}
        color={shade}
      />
      {/* The roof of solar panels, sloping back. */}
      <FlatPanel position={[0, 0.86, 0.06]} size={[0.92, 0.56]} tilt={-0.3} />
      {/* The sample arm, out in front. */}
      <Rod
        from={[-0.45, 0.6, -0.3]}
        to={[-0.62, 0.78, -0.55]}
        radius={0.022}
        color={white}
      />
      <Rod
        from={[-0.62, 0.78, -0.55]}
        to={[-0.66, 0.4, -0.7]}
        radius={0.02}
        color={white}
      />
      <Box
        size={[0.1, 0.06, 0.08]}
        position={[-0.66, 0.37, -0.72]}
        color={labTeal}
      />
      {/* The instrument mast and the dish. */}
      <Rod
        from={[0.42, 0.75, -0.25]}
        to={[0.42, 1.25, -0.25]}
        radius={0.02}
        color={frameGrey}
      />
      <Box
        size={[0.1, 0.1, 0.1]}
        position={[0.42, 1.29, -0.25]}
        color={labTeal}
      />
      <Rod
        from={[-0.38, 0.75, 0.3]}
        to={[-0.38, 1.05, 0.3]}
        radius={0.02}
        color={frameGrey}
      />
      <Dish
        radius={0.18}
        depth={0.06}
        position={[-0.38, 1.09, 0.3]}
        rotation={[-0.5, 0, 0.3]}
        color="#f5f1e3"
      />
    </group>
  );
});
