import type { Point } from "../sceneParts";
import { Box, PartSet, Rod, Shape, type SetPiece } from "./modelParts";

/**
 * Details the surface models share, built from the parts in `modelParts`: solar panels with their cells, whip
 * antennas, thermal blankets' seams, louvres and the like. Where a detail repeats, its pieces are merged into one
 * shape, so a model gains detail without many more draws.
 */

export const cellBlue = "#22345c";
const cellBacking = "#121a2c";
const frameGrey = "#a9adb6";

/**
 * A flat solar panel of `rows` by `columns` cells, with a thin gap between them, on a metal frame. It lies flat on
 * its middle at y = 0 unless turned.
 */
export function SolarCells({
  width,
  depth,
  rows,
  columns,
  position,
  rotation,
  frame = frameGrey,
}: {
  width: number;
  depth: number;
  rows: number;
  columns: number;
  position: Point;
  rotation?: Point;
  frame?: string;
}) {
  const gap = Math.min(width / columns, depth / rows) * 0.1;
  const cell: [number, number, number] = [
    width / columns - gap,
    0.006,
    depth / rows - gap,
  ];
  const cells: SetPiece[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      cells.push({
        size: cell,
        position: [
          ((column + 0.5) / columns - 0.5) * width,
          0.012,
          ((row + 0.5) / rows - 0.5) * depth,
        ],
      });
    }
  }
  return (
    <group position={position} rotation={rotation ?? [0, 0, 0]}>
      <Box
        size={[width + 0.04, 0.016, depth + 0.04]}
        position={[0, -0.006, 0]}
        color={frame}
        finish="metal"
      />
      <Box
        size={[width, 0.012, depth]}
        position={[0, 0.004, 0]}
        color={cellBacking}
        finish="matte"
      />
      <PartSet pieces={cells} color={cellBlue} finish="glass" />
    </group>
  );
}

/**
 * A round solar panel of wedge-shaped gores, as some landers unfold, seen as rings of cells between its ribs. It lies
 * flat on its middle at y = 0.
 */
export function RoundSolarCells({
  radius,
  gores,
  position,
}: {
  radius: number;
  gores: number;
  position: Point;
}) {
  const cells: SetPiece[] = [];
  const ribs: SetPiece[] = [];
  for (let gore = 0; gore < gores; gore++) {
    const middle = ((gore + 0.5) / gores) * Math.PI * 2;
    for (const [from, to] of [
      [0.12, 0.42],
      [0.46, 0.7],
      [0.74, 0.95],
    ] as const) {
      const along = ((from + to) / 2) * radius;
      const wide = 2 * along * Math.tan(Math.PI / gores) * 0.82;
      cells.push({
        size: [(to - from) * radius, 0.006, wide],
        position: [Math.cos(middle) * along, 0.012, -Math.sin(middle) * along],
        rotation: [0, middle, 0],
      });
    }
    const edge = (gore / gores) * Math.PI * 2;
    ribs.push({
      size: [radius * 0.98, 0.008, 0.006],
      position: [
        Math.cos(edge) * radius * 0.49,
        0.013,
        -Math.sin(edge) * radius * 0.49,
      ],
      rotation: [0, edge, 0],
    });
  }
  return (
    <group position={position}>
      <Shape position={[0, -0.004, 0]} color={frameGrey} finish="metal">
        <cylinderGeometry args={[radius + 0.02, radius + 0.02, 0.014, gores]} />
      </Shape>
      <Shape position={[0, 0.004, 0]} color={cellBacking} finish="matte">
        <cylinderGeometry args={[radius, radius, 0.012, gores]} />
      </Shape>
      <PartSet pieces={cells} color={cellBlue} finish="glass" />
      <PartSet pieces={ribs} color="#8f939c" finish="metal" />
    </group>
  );
}

/** A thin whip antenna standing up from `base`, with a small knob at its tip. */
export function Antenna({
  base,
  height,
  color = "#d8dbe2",
}: {
  base: Point;
  height: number;
  color?: string;
}) {
  const tip: Point = [base[0], base[1] + height, base[2]];
  return (
    <group>
      <Rod from={base} to={tip} radius={0.006} color={color} />
      <Shape position={tip} color="#3a3d44" finish="paint">
        <sphereGeometry args={[0.014, 8, 6]} />
      </Shape>
    </group>
  );
}

/**
 * The seams of a thermal blanket wrapped around a drum standing along y: an upright seam on each of `count` sides,
 * and a stitched band around it at each height in `bands`. Give them to a `PartSet` a shade darker than the blanket.
 */
export function blanketSeams({
  radius,
  height,
  centre,
  count,
  bands = [],
}: {
  radius: number;
  height: number;
  centre: Point;
  count: number;
  bands?: readonly number[];
}): SetPiece[] {
  const [x, y, z] = centre;
  const upright = Array.from({ length: count }, (_, side): SetPiece => {
    const angle = ((side + 0.5) / count) * Math.PI * 2;
    return {
      size: [0.008, height * 0.96, 0.012],
      position: [x + Math.cos(angle) * radius, y, z - Math.sin(angle) * radius],
      rotation: [0, angle, 0],
    };
  });
  const around = bands.map((band): SetPiece => ({
    radii: [radius + 0.004, radius + 0.004],
    height: 0.01,
    sides: count,
    position: [x, band, z],
  }));
  return [...upright, ...around];
}

/** Slats of a louvre or radiator, `count` of them across a face `width` wide and `height` high, facing -z. */
export function louvrePieces({
  width,
  height,
  count,
  centre,
}: {
  width: number;
  height: number;
  count: number;
  centre: Point;
}): SetPiece[] {
  const [x, y, z] = centre;
  return Array.from({ length: count }, (_, slat) => ({
    size: [width, (height / count) * 0.45, 0.012] as [number, number, number],
    position: [x, y + ((slat + 0.5) / count - 0.5) * height, z] as Point,
    rotation: [0.5, 0, 0] as Point,
  }));
}

/** Small boxes of instruments or electronics standing on a deck, each given as its size and where its foot is. */
export function deckBoxes(
  boxes: readonly { size: [number, number, number]; foot: Point }[],
): SetPiece[] {
  return boxes.map(({ size, foot }) => ({
    size,
    position: [foot[0], foot[1] + size[1] / 2, foot[2]],
  }));
}
