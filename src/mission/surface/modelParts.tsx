import { Quaternion, Vector3 } from "three";
import type { Point } from "../sceneParts";

/**
 * The shapes the surface models are built from. Like everything at the surface they're unlit, with their light worked
 * into their colours: a part's top is a lighter shade than its side when that's what makes it read.
 */

function Unlit({ color, double }: { color: string; double?: boolean }) {
  return (
    <meshBasicMaterial
      color={color}
      toneMapped={false}
      side={double === true ? 2 : 0}
    />
  );
}

export function Box({
  size,
  position,
  rotation,
  color,
}: {
  size: [width: number, height: number, depth: number];
  position: Point;
  rotation?: Point;
  color: string;
}) {
  return (
    <mesh position={position} rotation={rotation ?? [0, 0, 0]}>
      <boxGeometry args={size} />
      <Unlit color={color} />
    </mesh>
  );
}

/** A cylinder standing along y, or turned by `rotation`. Different radii make a frustum, and few sides a prism. */
export function Drum({
  radii,
  height,
  position,
  rotation,
  sides = 16,
  color,
}: {
  radii: [top: number, bottom: number];
  height: number;
  position: Point;
  rotation?: Point;
  sides?: number;
  color: string;
}) {
  return (
    <mesh position={position} rotation={rotation ?? [0, 0, 0]}>
      <cylinderGeometry args={[radii[0], radii[1], height, sides]} />
      <Unlit color={color} />
    </mesh>
  );
}

/** A dish opening towards +y, or turned by `rotation`, seen from either side. */
export function Dish({
  radius,
  depth,
  position,
  rotation,
  color,
}: {
  radius: number;
  depth: number;
  position: Point;
  rotation?: Point;
  color: string;
}) {
  return (
    <group position={position} rotation={rotation ?? [0, 0, 0]}>
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius, depth, 20, 1, true]} />
        <Unlit color={color} double />
      </mesh>
    </group>
  );
}

/** A thin round strut from one point to another, such as a leg, a mast or a link of the rover's suspension. */
export function Rod({
  from,
  to,
  radius,
  color,
}: {
  from: Point;
  to: Point;
  radius: number;
  color: string;
}) {
  const start = new Vector3(...from);
  const along = new Vector3(...to).sub(start);
  const middle = start.clone().addScaledVector(along, 0.5);
  const length = along.length();
  const turn = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    along.normalize(),
  );
  return (
    <mesh position={middle.toArray()} quaternion={turn}>
      <cylinderGeometry args={[radius, radius, length, 6]} />
      <Unlit color={color} />
    </mesh>
  );
}

/** Each of four legs splayed from a body, from a foot on the ground at `footAt` out from the middle to `topAt`. */
export function splayedLegs(
  footAt: number,
  topAt: number,
  topHeight: number,
): { key: string; foot: Point; top: Point }[] {
  return (
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const
  ).map(([x, z]) => ({
    key: `${x},${z}`,
    foot: [x * footAt, 0.03, z * footAt],
    top: [x * topAt, topHeight, z * topAt],
  }));
}
