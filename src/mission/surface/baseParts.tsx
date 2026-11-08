import type { Point } from "../sceneParts";
import { SolarCells } from "./modelDetails";
import { Drum, Rod, Shape } from "./modelParts";

/**
 * What the models of a base share: their colours, the legs their platforms stand on, their solar panels and their
 * lights. Simple models made from three.js shapes, so they use no art file (ADR 0005), with their front, towards the
 * camera, along -z.
 */

export const white = "#eef0f4";
export const shade = "#c2c6ce";
export const frameGrey = "#a9adb6";
export const footGrey = "#8f939c";
export const dark = "#1b2433";

/** A flat solar panel of cells, tilted back towards the sky. */
export function FlatPanel({
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
    <SolarCells
      width={width}
      depth={depth}
      rows={Math.max(2, Math.round(depth / 0.1))}
      columns={Math.max(3, Math.round(width / 0.1))}
      position={position}
      rotation={[tilt, 0, 0]}
    />
  );
}

/** Four short legs under a platform, each with a brace, and pads on the ground. */
export function PlatformLegs({
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
          <Rod
            from={[legX, 0.08, legZ]}
            to={[legX * 0.7, height, legZ]}
            radius={0.012}
            color={footGrey}
          />
          <Drum
            radii={[0.07, 0.08]}
            height={0.04}
            position={[legX, 0.02, legZ]}
            sides={10}
            color={footGrey}
            finish="metal"
          />
        </group>
      ))}
    </>
  );
}

/** A small round light in a dark housing, facing -z, as bases have to work by at night. */
export function WorkLight({ position }: { position: Point }) {
  return (
    <group position={position}>
      <Drum
        radii={[0.03, 0.03]}
        height={0.03}
        position={[0, 0, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        sides={10}
        color="#3a3d44"
        finish="metal"
      />
      <Shape
        position={[0, 0, -0.016]}
        rotation={[Math.PI / 2, 0, 0]}
        color="#fff4d6"
        finish="glass"
      >
        <cylinderGeometry args={[0.022, 0.022, 0.004, 10]} />
      </Shape>
    </group>
  );
}
