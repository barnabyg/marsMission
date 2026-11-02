import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
} from "three";
import { useDisposal } from "../sceneParts";
import { markChanged, softDot } from "./SequenceParticles";
import { dustCountInStorm, writeStormDust } from "./stormDust";

/** A dust storm at the Landing Site: a haze over the ground, and dust blowing across. Generated here, so it's no art file, and it only reads the clock, so it can't change a result. */
export function DustStormEffect() {
  const positions = useMemo(() => new Float32Array(dustCountInStorm * 3), []);
  const geometry = useMemo(
    () =>
      new BufferGeometry().setAttribute(
        "position",
        new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage),
      ),
    [positions],
  );
  const dot = useMemo(() => softDot(), []);
  useDisposal(geometry);
  useDisposal(dot);
  useFrame(({ clock }) => {
    writeStormDust(positions, clock.elapsedTime);
    markChanged(geometry);
  });
  return (
    <>
      <mesh>
        <sphereGeometry args={[9, 16, 12]} />
        <meshBasicMaterial
          color="#b5763f"
          transparent
          opacity={0.45}
          side={BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <points geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          color="#e0a06a"
          size={0.45}
          alphaMap={dot}
          transparent
          opacity={0.5}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </>
  );
}
