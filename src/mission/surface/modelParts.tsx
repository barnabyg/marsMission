import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  BoxGeometry,
  CylinderGeometry,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
  type Group,
  type Material,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Point } from "../sceneParts";
import { partLookOf, partMaterial, type Finish } from "./surfaceShading";

/**
 * The shapes the surface models are built from. They don't take the scene's lights, which would fall on the other
 * views: each part's material works out its own light from the Sun the land is lit by, with a `finish` that says
 * whether it's matte, painted, foil, bare metal or glass.
 */

interface Placed {
  position: Point;
  rotation?: Point | undefined;
}

/** Any shape of a model, given as its geometry, in a part's material. */
export function Shape({
  position,
  rotation,
  scale,
  color,
  finish,
  double = false,
  children,
}: Placed & {
  scale?: Point;
  color: string;
  finish?: Finish | undefined;
  double?: boolean;
  children: ReactNode;
}) {
  return (
    <mesh
      position={position}
      rotation={rotation ?? [0, 0, 0]}
      scale={scale ?? [1, 1, 1]}
      material={partMaterial(color, finish, double)}
    >
      {children}
    </mesh>
  );
}

export function Box({
  size,
  position,
  rotation,
  color,
  finish,
}: Placed & {
  size: [width: number, height: number, depth: number];
  color: string;
  finish?: Finish | undefined;
}) {
  return (
    <Shape
      position={position}
      rotation={rotation}
      color={color}
      finish={finish}
    >
      <boxGeometry args={size} />
    </Shape>
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
  finish,
}: Placed & {
  radii: [top: number, bottom: number];
  height: number;
  sides?: number;
  color: string;
  finish?: Finish | undefined;
}) {
  return (
    <Shape
      position={position}
      rotation={rotation}
      color={color}
      finish={finish}
    >
      <cylinderGeometry args={[radii[0], radii[1], height, sides]} />
    </Shape>
  );
}

/** A dish opening towards +y, or turned by `rotation`, seen from either side, with its feed standing in the middle. */
export function Dish({
  radius,
  depth,
  position,
  rotation,
  color,
}: Placed & {
  radius: number;
  depth: number;
  color: string;
}) {
  return (
    <group position={position} rotation={rotation ?? [0, 0, 0]}>
      <Shape
        position={[0, 0, 0]}
        rotation={[Math.PI, 0, 0]}
        color={color}
        double
      >
        <coneGeometry args={[radius, depth, 20, 1, true]} />
      </Shape>
      <Rod
        from={[0, -depth / 2, 0]}
        to={[0, radius * 0.45, 0]}
        radius={Math.max(radius * 0.04, 0.006)}
        color="#a9adb6"
        finish="metal"
      />
    </group>
  );
}

/** Turns a strut standing along y to run from one point to another. */
function strutBetween(from: Point, to: Point) {
  const start = new Vector3(...from);
  const along = new Vector3(...to).sub(start);
  const middle = start.clone().addScaledVector(along, 0.5);
  const length = along.length();
  const turn = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    along.normalize(),
  );
  return { middle, length, turn };
}

/** A thin round strut from one point to another, such as a leg, a mast or a link of the rover's suspension. */
export function Rod({
  from,
  to,
  radius,
  color,
  finish = "metal",
}: {
  from: Point;
  to: Point;
  radius: number;
  color: string;
  finish?: Finish | undefined;
}) {
  const { middle, length, turn } = strutBetween(from, to);
  return (
    <mesh
      position={middle.toArray()}
      quaternion={turn}
      material={partMaterial(color, finish)}
    >
      <cylinderGeometry args={[radius, radius, length, 6]} />
    </mesh>
  );
}

/** One of many like pieces that make up a `PartSet`: a box, or a drum given its radii. */
export type SetPiece = Placed &
  (
    | { size: [width: number, height: number, depth: number] }
    | { radii: [top: number, bottom: number]; height: number; sides?: number }
  );

function pieceGeometry(piece: SetPiece): BufferGeometry {
  const geometry =
    "size" in piece
      ? new BoxGeometry(...piece.size)
      : new CylinderGeometry(
          piece.radii[0],
          piece.radii[1],
          piece.height,
          piece.sides ?? 8,
        );
  const [x, y, z] = piece.rotation ?? [0, 0, 0];
  return geometry.applyMatrix4(
    new Matrix4().compose(
      new Vector3(...piece.position),
      new Quaternion().setFromEuler(new Euler(x, y, z)),
      new Vector3(1, 1, 1),
    ),
  );
}

/**
 * Many small pieces of one colour and finish, such as solar cells, a wheel's grousers or the seams of a blanket,
 * merged into one shape so that they cost one draw however many there are.
 */
export function PartSet({
  pieces,
  color,
  finish,
}: {
  pieces: readonly SetPiece[];
  color: string;
  finish?: Finish | undefined;
}) {
  // The pieces are usually written out in place, so they're compared by what they say rather than which array.
  const key = JSON.stringify(pieces);
  const geometry = useMemo(() => {
    const parts = (JSON.parse(key) as SetPiece[]).map(pieceGeometry);
    const merged = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    return merged;
  }, [key]);
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  return <mesh geometry={geometry} material={partMaterial(color, finish)} />;
}

/**
 * Draws a still model with one draw for each of its materials, however many parts it has: once its parts are placed,
 * those that share a part material are merged into one shape, and the parts themselves are hidden. Software rendering
 * pays for each draw, and a detailed model has many parts in few colours. Only what's inside moves together, so a
 * model whose parts move apart is batched part by part.
 */
export function Batched({ children }: { children: ReactNode }) {
  const parts = useRef<Group>(null);
  const merged = useRef<Group>(null);
  useLayoutEffect(() => {
    const root = parts.current;
    const target = merged.current;
    if (!root || !target) return;
    root.updateWorldMatrix(true, true);
    const toRoot = root.matrixWorld.clone().invert();
    const byMaterial = new Map<
      Material,
      { meshes: Mesh[]; shapes: BufferGeometry[] }
    >();
    root.traverse((object) => {
      if (!(object instanceof Mesh) || object instanceof InstancedMesh) return;
      const material: unknown = object.material;
      if (
        !(material instanceof ShaderMaterial) ||
        partLookOf(material) === null
      )
        return;
      const shape = (object.geometry as BufferGeometry)
        .clone()
        .applyMatrix4(toRoot.clone().multiply(object.matrixWorld));
      const batch = byMaterial.get(material) ?? { meshes: [], shapes: [] };
      batch.meshes.push(object as Mesh);
      batch.shapes.push(shape);
      byMaterial.set(material, batch);
    });
    const made: Mesh[] = [];
    for (const [material, { meshes, shapes }] of byMaterial) {
      const indexed = shapes.every((shape) => shape.index !== null);
      const ready = indexed
        ? shapes
        : shapes.map((shape) => (shape.index ? shape.toNonIndexed() : shape));
      // It gives null, despite its type, for shapes it can't merge, which are then left as they are.
      const geometry = mergeGeometries(ready) as BufferGeometry | null;
      for (const shape of [...shapes, ...ready]) shape.dispose();
      if (!geometry) continue;
      for (const mesh of meshes) mesh.visible = false;
      const mesh = new Mesh(geometry, material);
      target.add(mesh);
      made.push(mesh);
    }
    return () => {
      for (const mesh of made) {
        target.remove(mesh);
        mesh.geometry.dispose();
      }
      for (const { meshes } of byMaterial.values())
        for (const mesh of meshes) mesh.visible = true;
    };
  }, []);
  return (
    <group>
      <group ref={parts}>{children}</group>
      <group ref={merged} />
    </group>
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
