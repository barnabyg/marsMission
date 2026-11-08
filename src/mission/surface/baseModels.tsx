import { memo } from "react";
import {
  dark,
  FlatPanel,
  footGrey,
  frameGrey,
  PlatformLegs,
  shade,
  white,
  WorkLight,
} from "./baseParts";
import { Antenna, louvrePieces } from "./modelDetails";
import {
  Batched,
  Box,
  Drum,
  PartSet,
  Rod,
  Shape,
  type SetPiece,
} from "./modelParts";

/**
 * Two of the Assets that make a base at a Landing Site: the fuel plant and the habitat. The Mars lab is in
 * `labModel.tsx`, and what they share in `baseParts.tsx`.
 */

const tankOrange = "#e0904a";
const tankShade = "#b86e33";

/** One of the fuel plant's upright propellant tanks, rounded at both ends, with bands around it and a valve on top. */
function Tank({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Drum
        radii={[0.16, 0.16]}
        height={0.42}
        position={[0, 0.55, 0]}
        sides={20}
        color={tankOrange}
      />
      {[0.76, 0.34].map((y) => (
        <Shape
          key={y}
          position={[0, y, 0]}
          scale={[1, 0.55, 1]}
          color={y > 0.5 ? "#f0a862" : tankShade}
        >
          <sphereGeometry args={[0.16, 20, 10]} />
        </Shape>
      ))}
      <PartSet
        pieces={[0.42, 0.55, 0.68].map((y) => ({
          radii: [0.165, 0.165],
          height: y === 0.55 ? 0.04 : 0.015,
          sides: 20,
          position: [0, y, 0],
        }))}
        color={tankShade}
      />
      <Drum
        radii={[0.025, 0.025]}
        height={0.06}
        position={[0, 0.86, 0]}
        sides={8}
        color={footGrey}
        finish="metal"
      />
      <Box size={[0.07, 0.025, 0.025]} position={[0, 0.9, 0]} color="#c0392b" />
    </group>
  );
}

/** The fuel plant's radiator, standing at the back: a panel with the tubes that carry the heat across it. */
function Radiator() {
  const tubes: SetPiece[] = Array.from({ length: 7 }, (_, tube) => ({
    radii: [0.008, 0.008],
    height: 0.48,
    sides: 6,
    position: [-0.36 + tube * 0.06, 0.88, 0.345],
  }));
  return (
    <>
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
        finish="metal"
      />
      <PartSet pieces={tubes} color="#b9bec8" finish="metal" />
    </>
  );
}

/**
 * A fuel plant makes ascent propellant from the air: a white processing unit on a platform, with an intake on its roof,
 * two orange propellant tanks beside it piped to it, a radiator standing at the back and a flat solar panel on a mast.
 */
export const FuelPlant = memo(function FuelPlant() {
  return (
    <Batched>
      <PlatformLegs x={0.48} z={0.3} height={0.26} />
      <Box
        size={[1.12, 0.06, 0.74]}
        position={[0, 0.27, 0]}
        color={frameGrey}
        finish="metal"
      />
      {/* The processing unit, with a darker seam, a louvred vent, a panel of dials and a light on its front. */}
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
        position={[-0.22, 0.42, -0.235]}
        color={dark}
        finish="matte"
      />
      <PartSet
        pieces={louvrePieces({
          width: 0.24,
          height: 0.1,
          count: 5,
          centre: [-0.22, 0.42, -0.25],
        })}
        color={shade}
      />
      <PartSet
        pieces={[-0.36, -0.3, -0.24].map((x) => ({
          radii: [0.014, 0.014],
          height: 0.01,
          sides: 10,
          position: [x, 0.64, -0.236],
          rotation: [Math.PI / 2, 0, 0],
        }))}
        color={dark}
        finish="glass"
      />
      <WorkLight position={[-0.06, 0.65, -0.245]} />
      {/* The intake, drawing in the thin air through a filter. */}
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
        finish="metal"
      />
      <Drum
        radii={[0.085, 0.085]}
        height={0.012}
        position={[-0.32, 0.89, 0.05]}
        color="#55585f"
        finish="matte"
      />
      <Tank x={0.28} z={-0.14} />
      <Tank x={0.28} z={0.2} />
      {/* Pipes from the unit to each tank, with a valve on each. */}
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
      <PartSet
        pieces={[
          { size: [0.04, 0.06, 0.06], position: [0.075, 0.58, -0.14] },
          { size: [0.04, 0.06, 0.06], position: [0.075, 0.62, 0.2] },
        ]}
        color={footGrey}
        finish="metal"
      />
      <Radiator />
      {/* A solar panel on a mast, facing the Sun, and an antenna for orders from Earth. */}
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
      <Antenna base={[0.5, 0.3, -0.32]} height={0.36} />
    </Batched>
  );
});

const hullWhite = "#f1f1ee";
const ribShade = "#cfd2d4";

/** The habitat's airlock, towards the camera, with its hatch, the hatch's handle and a light above it. */
function Airlock() {
  return (
    <>
      <Drum
        radii={[0.2, 0.2]}
        height={0.32}
        position={[0.38, 0.62, -0.42]}
        rotation={[Math.PI / 2, 0, 0]}
        color={white}
      />
      <Drum
        radii={[0.205, 0.205]}
        height={0.02}
        position={[0.38, 0.62, -0.56]}
        rotation={[Math.PI / 2, 0, 0]}
        color={footGrey}
        finish="metal"
      />
      <Drum
        radii={[0.14, 0.14]}
        height={0.02}
        position={[0.38, 0.62, -0.585]}
        rotation={[Math.PI / 2, 0, 0]}
        color={shade}
      />
      <Drum
        radii={[0.03, 0.03]}
        height={0.015}
        position={[0.38, 0.66, -0.6]}
        rotation={[Math.PI / 2, 0, 0]}
        sides={10}
        color="#3a3d44"
        finish="metal"
      />
      <Box
        size={[0.03, 0.12, 0.02]}
        position={[0.46, 0.62, -0.6]}
        color={footGrey}
        finish="metal"
      />
      <WorkLight position={[0.38, 0.86, -0.5]} />
    </>
  );
}

/**
 * The habitat is a long white module lying on its side on a frame, its fabric hull ribbed like an inflated one, with an
 * airlock towards the camera, a row of windows along its side, solar panels and an antenna on its back.
 */
export const Habitat = memo(function Habitat() {
  return (
    <Batched>
      <PlatformLegs x={0.5} z={0.22} height={0.3} />
      <Box
        size={[1.2, 0.05, 0.56]}
        position={[0, 0.3, 0]}
        color={frameGrey}
        finish="metal"
      />
      {/* The hull, lying along x, its soft fabric quilted between the ribs. */}
      <Drum
        radii={[0.4, 0.4]}
        height={1.3}
        position={[0, 0.72, 0]}
        rotation={[0, 0, Math.PI / 2]}
        sides={20}
        color={hullWhite}
        finish="matte"
      />
      {[-0.65, 0.65].map((x) => (
        <Shape
          key={x}
          position={[x, 0.72, 0]}
          scale={[0.45, 1, 1]}
          color={ribShade}
        >
          <sphereGeometry args={[0.4, 20, 12]} />
        </Shape>
      ))}
      <PartSet
        pieces={[-0.4, -0.13, 0.13, 0.4].map((x) => ({
          radii: [0.41, 0.41],
          height: 0.035,
          sides: 20,
          position: [x, 0.72, 0],
          rotation: [0, 0, Math.PI / 2],
        }))}
        color={ribShade}
      />
      <PartSet
        pieces={Array.from({ length: 10 }, (_, line) => {
          const angle = (line / 10) * Math.PI * 2;
          return {
            size: [1.28, 0.006, 0.006] as [number, number, number],
            position: [
              0,
              0.72 + Math.sin(angle) * 0.402,
              Math.cos(angle) * 0.402,
            ] as const,
          };
        })}
        color="#dcdcd6"
        finish="matte"
      />
      {/* Windows along the side towards the camera, each in a frame. */}
      {[-0.27, 0, 0.27].map((x) => (
        <group key={x} position={[x, 0.86, -0.36]} rotation={[0.45, 0, 0]}>
          <Box
            size={[0.15, 0.12, 0.02]}
            position={[0, 0, 0.004]}
            color={footGrey}
            finish="metal"
          />
          <Box
            size={[0.12, 0.09, 0.02]}
            position={[0, 0, 0]}
            color={dark}
            finish="glass"
          />
        </group>
      ))}
      <Airlock />
      {/* Solar panels on the back, and an antenna. */}
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
      <Antenna base={[-0.58, 1.0, 0]} height={0.3} />
    </Batched>
  );
});
