import { memo } from "react";
import type { Point } from "../sceneParts";
import { CrewLander, CrewLanderWreck } from "./crewModels";
import { Lander, landerGold } from "./landerModel";
import { Box as Part, Drum } from "./modelParts";
import { deckBlue, Rover, wheelDark, wheelRadius } from "./roverModel";
import type { SurfaceModel } from "./surface";

const shadowRadii: Record<SurfaceModel, number> = {
  lander: 0.85,
  rover: 0.66,
  crewLander: 0.9,
};

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

export const models: Record<SurfaceModel, typeof Lander> = {
  lander: Lander,
  rover: Rover,
  crewLander: CrewLander,
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
      {/* A solar panel, torn off and lying cracked on the ground. */}
      <Drum
        radii={[0.28, 0.28]}
        height={0.025}
        position={[-0.7, 0.06, 0.25]}
        rotation={[0.15, 0, -0.1]}
        sides={10}
        color="#1d2a47"
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
        color={deckBlue}
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
          <cylinderGeometry args={[wheelRadius, wheelRadius, 0.09, 16]} />
          <meshBasicMaterial color={wheelDark} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
});

export const wrecks: Record<SurfaceModel, typeof LanderWreck> = {
  lander: LanderWreck,
  rover: RoverWreck,
  crewLander: CrewLanderWreck,
};
