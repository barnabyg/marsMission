import { memo, useEffect, useMemo } from "react";
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import type { Timeline } from "../../simulation/simulation";
import type { CameraPose, Point, SceneLabel } from "../sceneParts";
import { placeOf, surfaceAssetsAt, type SurfaceModel } from "./surface";
import { buildTerrain, groundHeight, horizonColor } from "./terrain";

/**
 * A patch of ground of its own, with its own sky, behind both other views' cameras. Everything is
 * unlit with its light worked into its colours, because a light here would fall on the other views too.
 */
const surfaceCentre: Point = [0, 0, 20];

/** Looks away from the other views, so that they cost nothing to draw from here. */
export const surfaceShot: CameraPose = {
  position: [0, 2.2, 12.5],
  target: [0, 0.75, 20],
};

/** Big enough to reach past the land's fade, and small enough to stay clear of the solar system's camera and the stars. */
const skyRadius = 14.5;
const zenithColor = [0.2, 0.09, 0.06] as const;

const landerGold = "#f2c14e";
const roverTeal = "#37c9b5";

/** How far above the ground each model's label sits. */
const labelHeights: Record<SurfaceModel, number> = { lander: 1.5, rover: 1.05 };

/** Frees a geometry made here when it's replaced or no longer needed. */
function useDisposal(geometry: BufferGeometry) {
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
}

function Terrain({ siteName }: { siteName: string }) {
  const geometry = useMemo(() => {
    const { positions, colors, indices } = buildTerrain(siteName);
    return new BufferGeometry()
      .setAttribute("position", new BufferAttribute(positions, 3))
      .setAttribute("color", new BufferAttribute(colors, 3))
      .setIndex(new BufferAttribute(indices, 1));
  }, [siteName]);
  useDisposal(geometry);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </mesh>
  );
}

const Sky = memo(function Sky() {
  const geometry = useMemo(() => {
    const sphere = new SphereGeometry(skyRadius, 24, 16);
    const { position } = sphere.attributes;
    const colors = new Float32Array((position?.count ?? 0) * 3);
    for (let vertex = 0; vertex < colors.length / 3; vertex++) {
      const height = Math.max((position?.getY(vertex) ?? 0) / skyRadius, 0);
      const share = Math.min(height * 1.6, 1);
      for (let channel = 0; channel < 3; channel++) {
        colors[vertex * 3 + channel] =
          (horizonColor[channel] ?? 0) * (1 - share) +
          (zenithColor[channel] ?? 0) * share;
      }
    }
    return sphere.setAttribute("color", new BufferAttribute(colors, 3));
  }, []);
  useDisposal(geometry);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors side={BackSide} toneMapped={false} />
    </mesh>
  );
});

function Part({
  size,
  position,
  color,
}: {
  size: [width: number, height: number, depth: number];
  position: Point;
  color: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

/** A low shadow to stand the model on, leaning away from the Sun. */
function Shadow({ radius }: { radius: number }) {
  return (
    <mesh
      position={[radius * 0.5, 0.04, -radius * 0.2]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <circleGeometry args={[radius, 20]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.35} />
    </mesh>
  );
}

/** Each leg of a lander, from its foot on the ground up to the body. */
const landerLegs = (
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const
).map(([x, z]) => {
  const foot = new Vector3(x * 0.46, 0.03, z * 0.46);
  const top = new Vector3(x * 0.22, 0.6, z * 0.22);
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

/** A lander is tall and gold, and stands still on four spread legs. */
const Lander = memo(function Lander() {
  return (
    <group>
      <Shadow radius={0.7} />
      {landerLegs.map(({ key, foot, middle, length, turn }) => (
        <group key={key}>
          <mesh position={middle} quaternion={turn}>
            <cylinderGeometry args={[0.03, 0.03, length, 6]} />
            <meshBasicMaterial color="#c9cdd6" toneMapped={false} />
          </mesh>
          <mesh position={foot}>
            <cylinderGeometry args={[0.1, 0.12, 0.05, 10]} />
            <meshBasicMaterial color="#8f939c" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.32, 0.46, 0.5, 8]} />
        <meshBasicMaterial color={landerGold} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.03, 0]}>
        <cylinderGeometry args={[0.12, 0.32, 0.14, 8]} />
        <meshBasicMaterial color="#b98a2e" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.28, 0]} rotation={[0.5, 0, 0.3]}>
        <coneGeometry args={[0.24, 0.12, 14, 1, true]} />
        <meshBasicMaterial color="#f5f1e3" toneMapped={false} side={2} />
      </mesh>
      <Part size={[0.04, 0.2, 0.04]} position={[0, 1.17, 0]} color="#c9cdd6" />
    </group>
  );
});

/** A rover is low and teal, on six dark wheels, with a mast. */
const Rover = memo(function Rover() {
  const wheels: [x: number, z: number][] = [-0.38, 0, 0.38].flatMap((x) => [
    [x, -0.32] as [number, number],
    [x, 0.32] as [number, number],
  ]);
  return (
    <group>
      <Shadow radius={0.62} />
      {wheels.map(([x, z]) => (
        <mesh
          key={`${x},${z}`}
          position={[x, 0.11, z]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.11, 0.11, 0.09, 12]} />
          <meshBasicMaterial color="#1c1e24" toneMapped={false} />
        </mesh>
      ))}
      <Part size={[0.95, 0.2, 0.5]} position={[0, 0.3, 0]} color={roverTeal} />
      <Part size={[1.05, 0.03, 0.62]} position={[0, 0.42, 0]} color="#23324f" />
      <Part
        size={[0.05, 0.36, 0.05]}
        position={[0.34, 0.6, 0]}
        color="#d8dbe2"
      />
      <Part
        size={[0.18, 0.1, 0.12]}
        position={[0.34, 0.82, 0]}
        color="#d8dbe2"
      />
    </group>
  );
});

const models: Record<SurfaceModel, typeof Lander> = {
  lander: Lander,
  rover: Rover,
};

/** A Landing Site with the Assets operating there. It can't change anything, because it only reads the Timeline. */
export function SurfaceScene({
  timeline,
  day,
  siteName,
}: {
  timeline: Pick<Timeline, "assetsAtMars">;
  day: number;
  siteName: string;
}) {
  return (
    <group position={surfaceCentre}>
      <Sky />
      <Terrain siteName={siteName} />
      {surfaceAssetsAt(timeline, day, siteName).map(({ model, place }) => {
        const Model = models[model];
        const { x, z } = placeOf(place);
        return (
          <group key={place} position={[x, groundHeight(siteName, x, z), z]}>
            <Model />
          </group>
        );
      })}
    </group>
  );
}

export function surfaceLabels(
  timeline: Timeline,
  day: number,
  siteName: string | null,
): SceneLabel[] {
  if (siteName === null) return [];
  return surfaceAssetsAt(timeline, day, siteName).map(
    ({ name, model, place }) => {
      const { x, z } = placeOf(place);
      return {
        text: name,
        position: [
          surfaceCentre[0] + x,
          surfaceCentre[1] + groundHeight(siteName, x, z) + labelHeights[model],
          surfaceCentre[2] + z,
        ],
        testId: "surface-asset",
        className: `on-surface ${model}-label`,
      };
    },
  );
}
