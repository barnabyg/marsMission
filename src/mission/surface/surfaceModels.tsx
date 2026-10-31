import { memo } from "react";
import { Quaternion, Vector3 } from "three";
import type { Point } from "../sceneParts";
import type { SurfaceModel } from "./surface";

const landerGold = "#f2c14e";
const roverTeal = "#37c9b5";

function Part({
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
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

const shadowRadii: Record<SurfaceModel, number> = { lander: 0.7, rover: 0.62 };

/** A low shadow to stand a model on, leaning away from the Sun. It stays on the ground while the model comes down. */
export function Shadow({ model }: { model: SurfaceModel }) {
  const radius = shadowRadii[model];
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

/** A rover is low and teal, on six dark wheels, with a mast. Its front is along x. */
const Rover = memo(function Rover() {
  const wheels: [x: number, z: number][] = [-0.38, 0, 0.38].flatMap((x) => [
    [x, -0.32] as [number, number],
    [x, 0.32] as [number, number],
  ]);
  return (
    <group>
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

export const models: Record<SurfaceModel, typeof Lander> = {
  lander: Lander,
  rover: Rover,
};

function Scorch() {
  return (
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[1.3, 24]} />
      <meshBasicMaterial color="#0c0705" transparent opacity={0.7} />
    </mesh>
  );
}

/** What's left of a lander: its crumpled body on its side, with a leg and the dish thrown clear. */
const LanderWreck = memo(function LanderWreck() {
  return (
    <group>
      <Scorch />
      <mesh
        position={[0, 0.2, 0]}
        rotation={[0.3, 0.6, 1.35]}
        scale={[1, 0.8, 0.7]}
      >
        <cylinderGeometry args={[0.28, 0.46, 0.5, 8]} />
        <meshBasicMaterial color="#a8822f" toneMapped={false} />
      </mesh>
      <Part
        size={[0.05, 0.75, 0.05]}
        position={[0.75, 0.12, 0.25]}
        rotation={[0.4, 0, 1.3]}
        color="#8f939c"
      />
      <Part
        size={[0.05, 0.6, 0.05]}
        position={[-0.65, 0.1, -0.3]}
        rotation={[-0.3, 0, 1.75]}
        color="#6d7078"
      />
      <mesh position={[-0.35, 0.09, 0.65]} rotation={[1.3, 0, 0.3]}>
        <coneGeometry args={[0.24, 0.12, 14, 1, true]} />
        <meshBasicMaterial color="#b9b5a8" toneMapped={false} side={2} />
      </mesh>
      <Part
        size={[0.3, 0.05, 0.22]}
        position={[0.5, 0.05, -0.55]}
        rotation={[0.1, 0.8, 0.1]}
        color={landerGold}
      />
    </group>
  );
});

/** What's left of a rover: its body nose down, with its panel and wheels thrown clear. */
const RoverWreck = memo(function RoverWreck() {
  const wheels: Point[] = [
    [0.85, 0.1, 0.5],
    [-0.8, 0.1, 0.35],
    [0.2, 0.1, -0.8],
  ];
  return (
    <group>
      <Scorch />
      <Part
        size={[0.95, 0.2, 0.5]}
        position={[0, 0.22, 0]}
        rotation={[0.2, 0.5, 0.5]}
        color="#2a9485"
      />
      <Part
        size={[1.05, 0.03, 0.62]}
        position={[-0.55, 0.1, -0.4]}
        rotation={[0.2, 1.1, 0.15]}
        color="#23324f"
      />
      <Part
        size={[0.05, 0.42, 0.05]}
        position={[0.5, 0.08, 0.1]}
        rotation={[0.2, 0, 1.45]}
        color="#a9acb3"
      />
      {wheels.map((position) => (
        <mesh
          key={position.join()}
          position={position}
          rotation={[Math.PI / 2, 0, 0.4]}
        >
          <cylinderGeometry args={[0.11, 0.11, 0.09, 12]} />
          <meshBasicMaterial color="#1c1e24" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
});

export const wrecks: Record<SurfaceModel, typeof LanderWreck> = {
  lander: LanderWreck,
  rover: RoverWreck,
};
