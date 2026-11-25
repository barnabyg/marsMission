import { Drum } from "./modelParts";
import { entryMs } from "./sequence";

/** The angled backshell and ablative shield. The luminous bow wave and wake cool as entry ends. */
export function EntryShell({
  crewed,
  elapsedMs,
}: {
  crewed: boolean;
  elapsedMs: number;
}) {
  const heat = 1 - elapsedMs / entryMs;
  return (
    <group scale={crewed ? 1.25 : 1} rotation={[0.28, 0.1, -0.36 * heat]}>
      <Drum
        position={[0, 0.34, 0]}
        height={0.68}
        radii={[0.24, 0.76]}
        color={crewed ? "#e8e7e2" : "#beac82"}
        finish="paint"
        sides={40}
      />
      <Drum
        position={[0, -0.1, 0]}
        height={0.2}
        radii={[0.78, 0.52]}
        color="#6d4131"
        finish="matte"
        sides={40}
      />
      <mesh position={[0, -0.13, 0]} scale={[0.81, 0.16, 0.81]}>
        <sphereGeometry args={[1, 40, 16]} />
        <meshBasicMaterial
          color="#ffd278"
          transparent
          opacity={0.9 * heat}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.94, 0]} scale={[0.8, 1.5, 0.8]}>
        <coneGeometry args={[1, 1.6, 40, 1, true]} />
        <meshBasicMaterial
          color="#ff6a27"
          transparent
          opacity={0.35 * heat}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
