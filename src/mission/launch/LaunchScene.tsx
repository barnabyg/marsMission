import { useFrame } from "@react-three/fiber";
import { BackSide, DoubleSide } from "three";
import { LaunchGround } from "./LaunchGround";
import { LaunchPad } from "./LaunchPad";
import { LaunchVapour } from "./LaunchVapour";
import { MeridianRocket } from "./MeridianRocket";
import {
  launchDeckHeight,
  launchMotion,
  rocketProfile,
  type LaunchNow,
} from "./launch";

import { launchIgnitionMs } from "./launchTiming";

const padScale = 0.15;

/** Thin layers of coastal haze soften the horizon below a high blue sky. */
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
          float above = smoothstep(-0.04, 0.74, ray.y);
          vec3 sky = mix(vec3(0.78, 0.73, 0.63), vec3(0.075, 0.20, 0.38), above);
          float glare = max(dot(ray, normalize(vec3(-0.72,0.22,-0.66))), 0.0);
          sky += vec3(0.62,0.32,0.12)*pow(glare,36.0);
          float ridge = .024+.012*sin(ray.x*18.)+.004*sin(ray.z*34.);
          sky = mix(vec3(.44,.48,.47), sky, smoothstep(ridge-.002,ridge+.005,ray.y));
          gl_FragColor = vec4(sky,1.0);
          #include <colorspace_fragment>
        }`}
      />
    </mesh>
  );
}

/** The bright throat stays attached to its engine while the outer plume lengthens at ignition. */
function Exhaust({ elapsedMs, radius }: { elapsedMs: number; radius: number }) {
  const ignition = Math.min(
    1,
    Math.max(0, (elapsedMs - launchIgnitionMs) / 600),
  );
  if (!ignition) return null;
  const length = ignition * (3.5 + 0.13 * Math.sin(elapsedMs / 55));
  return (
    <group scale={[radius, length, radius]} rotation={[0, 0, Math.PI]}>
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.9, 1, 32, 8, true]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
          uniforms={{ time: { value: elapsedMs / 1000 } }}
          vertexShader={`varying vec2 flame;
            void main() {
              flame=uv;
              gl_Position=projectionMatrix * modelViewMatrix * vec4(position,1.);
            }`}
          fragmentShader={`uniform float time; varying vec2 flame;
            void main() {
              float t=flame.y;
              float streak=.5+.5*sin(flame.x*62.83+sin(t*15.-time*22.));
              float diamonds=.5+.5*cos(t*29.-time*3.);
              vec3 colour=mix(vec3(1.,.28,.04),vec3(1.,.97,.76),
                clamp(.78*(1.-t)+streak*.18+diamonds*.13,0.,1.));
              gl_FragColor=vec4(colour,(1.-t*t)*(.7+.3*streak));
              #include <colorspace_fragment>
            }`}
        />
      </mesh>
    </group>
  );
}

function LaunchCamera({
  launch,
  steadyCamera,
  rise,
  apart,
  height,
}: {
  launch: LaunchNow;
  steadyCamera: boolean;
  rise: number;
  apart: number;
  height: number;
}) {
  useFrame(({ camera, gl }) => {
    if (steadyCamera) {
      // A fixed, wider field holds the tower, breakup and cloud shelf without cuts or tracking.
      camera.position.set(3.45, 0.85, 6.8);
      camera.lookAt(0, 2.55, 0);
    } else if (launch.elapsedMs < launchIgnitionMs) {
      camera.position.set(1.5, 0.65, 3.25);
      camera.lookAt(0, 1.1, 0);
    } else if (launch.elapsedMs < 3900) {
      camera.position.set(0.99, 0.215, 1.41);
      camera.lookAt(0, 0.76, 0);
    } else {
      const follow = Math.max(0, rise - 2);
      camera.position.set(1.74, (3.4 + follow * 0.8) * padScale, 2.25);
      camera.lookAt(0, (launchDeckHeight + height * 0.46 + rise) * padScale, 0);
    }
    camera.updateMatrixWorld();
    const frame = apart > 0 ? "breakup" : rise > 0 ? "ascent" : "pad";
    if (gl.domElement.dataset.launchFrame !== frame)
      gl.domElement.dataset.launchFrame = frame;
    gl.domElement.dataset.cameraPosition = camera.position
      .toArray()
      .map((n) => n.toFixed(3))
      .join(" ");
  });
  return null;
}

export function LaunchScene({
  launch,
  steadyCamera = false,
}: {
  launch: LaunchNow;
  steadyCamera?: boolean;
}) {
  const { rise, apart } = launchMotion(launch);
  const { radius, height } = rocketProfile(launch.vehicleId);
  return (
    <>
      <LaunchCamera
        launch={launch}
        steadyCamera={steadyCamera}
        rise={rise}
        apart={apart}
        height={height}
      />
      <Sky />
      <group scale={padScale}>
        <LaunchGround />
        <LaunchPad />
        <LaunchVapour
          elapsedMs={launch.elapsedMs}
          height={height}
          apart={apart}
        />
        <group position={[0, launchDeckHeight + rise, 0]}>
          <MeridianRocket vehicleId={launch.vehicleId} apart={apart} />
          {apart === 0 && (
            <Exhaust elapsedMs={launch.elapsedMs} radius={radius} />
          )}
        </group>
      </group>
    </>
  );
}
