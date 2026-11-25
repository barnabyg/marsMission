import { useFrame } from "@react-three/fiber";
import { BackSide } from "three";
import { LaunchPad } from "./LaunchPad";
import { MeridianRocket } from "./MeridianRocket";
import { launchMotion, rocketProfile, type LaunchNow } from "./launch";

import { launchIgnitionMs } from "./launchTiming";

const padScale = 0.15;

/** A pale horizon and high blue sky. Only the angle above the horizon changes their colour. */
function Sky() {
  return (
    <mesh>
      <sphereGeometry args={[90, 32, 24]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        vertexShader={`varying vec3 direction;
        void main() {
          direction = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`}
        fragmentShader={`varying vec3 direction;
        void main() {
          vec3 ray = normalize(direction);
          float above = smoothstep(-0.06, 0.64, ray.y);
          vec3 sky = mix(vec3(0.77, 0.70, 0.60), vec3(0.10, 0.26, 0.46), above);
          float glare = max(dot(ray, normalize(vec3(-0.76,0.15,-0.63))), 0.0);
          sky += vec3(0.65,0.37,0.15)*pow(glare,36.0);
          gl_FragColor = vec4(sky,1.0);
          #include <colorspace_fragment>
        }`}
      />
    </mesh>
  );
}

function Exhaust({ elapsedMs, radius }: { elapsedMs: number; radius: number }) {
  const ignition = Math.min(
    1,
    Math.max(0, (elapsedMs - launchIgnitionMs) / 600),
  );
  if (!ignition) return null;
  const length = ignition * (3.5 + 0.16 * Math.sin(elapsedMs / 55));
  return (
    <group scale={[radius, length, radius]} rotation={[0, 0, Math.PI]}>
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.9, 1, 24]} />
        <meshBasicMaterial
          color="#ff8e39"
          transparent
          opacity={0.8}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <coneGeometry args={[0.62, 0.54, 24]} />
        <meshBasicMaterial color="#fff5c8" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Steam spilling out to either side of the flame trench. All motion uses the pausable launch clock. */
function TrenchSteam({ elapsedMs }: { elapsedMs: number }) {
  const seconds = (elapsedMs - launchIgnitionMs) / 1000;
  if (seconds <= 0 || seconds > 6) return null;
  return (
    <group>
      {Array.from({ length: 18 }, (_, i) => {
        const age = seconds - (i % 9) * 0.18;
        if (age <= 0 || age >= 3.8) return null;
        const side = i < 9 ? -1 : 1;
        const size = 0.25 + age * 0.55;
        return (
          <mesh
            key={i}
            position={[
              side * (0.7 + age * 2),
              0.45 + age * 0.3,
              Math.sin(i * 9) * 0.7 + 0.5,
            ]}
            scale={[size * 1.6, size * 0.8, size]}
          >
            <icosahedronGeometry args={[1, 1]} />
            <meshLambertMaterial
              color="#e5e3dc"
              transparent
              opacity={0.62 * (1 - age / 3.8)}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function LaunchScene({
  launch,
  steadyCamera = false,
}: {
  launch: LaunchNow;
  steadyCamera?: boolean;
}) {
  const { rise, apart } = launchMotion(launch);
  const { radius } = rocketProfile(launch.vehicleId);
  useFrame(({ camera, gl }) => {
    const follow = steadyCamera ? 0 : Math.max(0, rise - 1.8) * padScale;
    camera.position.set(1.5, 0.65 + follow, 3.25);
    camera.lookAt(0, 1.1 + follow, 0);
    camera.updateMatrixWorld();
    gl.domElement.dataset.cameraPosition = camera.position
      .toArray()
      .map((value) => value.toFixed(3))
      .join(" ");
    const frame = apart > 0 ? "breakup" : rise > 0 ? "ascent" : "pad";
    if (gl.domElement.dataset.launchFrame !== frame)
      gl.domElement.dataset.launchFrame = frame;
  });
  return (
    <>
      <Sky />
      <hemisphereLight args={["#f6f5eb", "#93918a", 2]} />
      <directionalLight position={[-2, 5, 3]} intensity={2} />
      <group scale={padScale}>
        <LaunchPad />
        <TrenchSteam elapsedMs={launch.elapsedMs} />
        <group position={[0, 1.26 + rise, 0]}>
          <MeridianRocket vehicleId={launch.vehicleId} apart={apart} />
          {apart === 0 && (
            <Exhaust elapsedMs={launch.elapsedMs} radius={radius} />
          )}
        </group>
      </group>
    </>
  );
}
