import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import { launchDeckHeight, launchMotion, stageJointHeight } from "./launch";
import { launchIgnitionMs, launchBreakupMs } from "./launchTiming";
import { useDisposal } from "../sceneParts";

const riseAtBreakup = launchMotion({
  elapsedMs: launchBreakupMs,
  failed: true,
}).rise;

// Each billboard uses the same soft-edged, sunlit puff. Bake the lobes once so 4K software rendering
// needs a texture lookup per fragment even when several clouds overlap.
function puffTexture() {
  const size = 160;
  const density = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);
  const random = (x: number, y: number) => {
    const hash = Math.imul(x + 191, 1597334677) ^ Math.imul(y + 87, 3812015801);
    return (Math.imul(hash ^ (hash >>> 16), 2246822519) >>> 0) / 4294967296;
  };
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const noise = (x: number, y: number) => {
    const i = Math.floor(x),
      j = Math.floor(y);
    let u = x - i,
      v = y - j;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    return mix(
      mix(random(i, j), random(i + 1, j), u),
      mix(random(i, j + 1), random(i + 1, j + 1), u),
      v,
    );
  };
  for (let i = 0; i < density.length; i++) {
    const x = (i % size) / size,
      y = Math.floor(i / size) / size;
    const billows =
      0.55 * noise(x * 8, y * 8) +
      0.28 * noise(x * 17, y * 17) +
      0.12 * noise(x * 38, y * 38) +
      0.05 * noise(x * 77, y * 77);
    density[i] =
      1 -
      Math.hypot((x - 0.5) * 2.6, (y - 0.5) * 2.95) +
      (billows - 0.55) * 0.94;
  }
  for (let i = 0; i < density.length; i++) {
    const here = density[i] ?? 0;
    const towardsSun = density[i + size * 4 - 3] ?? here;
    const light = Math.max(
      0,
      Math.min(
        1,
        0.58 +
          (here - towardsSun) * 2.7 +
          (Math.floor(i / size) / size - 0.5) * 0.48,
      ),
    );
    rgba[i * 4] = mix(150, 255, light);
    rgba[i * 4 + 1] = mix(161, 248, light);
    rgba[i * 4 + 2] = mix(174, 226, light);
    rgba[i * 4 + 3] = 255 * Math.min(1, Math.max(0, here * 4.1));
  }
  const texture = new DataTexture(rgba, size, size);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function vapourGeometry() {
  const plane = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.setIndex(plane.index);
  geometry.setAttribute("position", plane.getAttribute("position"));
  geometry.setAttribute("uv", plane.getAttribute("uv"));
  const centres = new InstancedBufferAttribute(new Float32Array(64 * 3), 3);
  const shapes = new InstancedBufferAttribute(new Float32Array(64 * 3), 3);
  geometry.setAttribute("centre", centres);
  geometry.setAttribute("shape", shapes);
  return { geometry, centres, shapes };
}

/** The low cloud shelf, venting umbilical and flame trench share one draw call and the pausable Mission clock. */
export function LaunchVapour({
  elapsedMs,
  height,
  apart,
}: {
  elapsedMs: number;
  height: number;
  apart: number;
}) {
  const buffers = useMemo(() => vapourGeometry(), []);
  const animated = useRef(buffers);
  const texture = useMemo(() => puffTexture(), []);
  useDisposal(buffers.geometry);
  useDisposal(texture);
  useFrame(() => {
    const { geometry, centres, shapes } = animated.current;
    let count = 0;
    const puff = (
      x: number,
      y: number,
      z: number,
      width: number,
      tall: number,
      alpha: number,
    ) => {
      centres.setXYZ(count, x, y, z);
      shapes.setXYZ(count, width, tall, alpha);
      count++;
    };
    const seconds = elapsedMs / 1000;
    // The distant bank stays behind the rocket. A closer lip crosses its path on a successful ascent.
    for (let i = 0; i < 12; i++) {
      puff(
        (i - 5) * 5.5 + seconds * 0.06,
        31 + Math.sin(i * 1.7) * 2.5,
        -17 - (i % 3) * 4,
        17,
        7 + (i % 3),
        0.8,
      );
    }
    for (let i = 0; i < 5; i++) {
      puff(
        (i - 2) * 4.8 + seconds * 0.1,
        43 + Math.cos(i) * 1.2,
        2 + (i % 2),
        12,
        7,
        0.82,
      );
    }
    // A continuous, thin stream of cold vapour falls from the upper service arm before liftoff.
    for (let i = 0; i < 9; i++) {
      const age = (seconds + i / 4) % 2.25;
      if (seconds - age > 2.3) continue;
      puff(
        -0.55 - age * 0.62,
        height * 0.68 + launchDeckHeight - age * 0.5,
        0.35,
        0.45 + age * 0.7,
        0.38 + age * 0.42,
        0.42 * (1 - age / 2.25),
      );
    }
    const sinceIgnition = (elapsedMs - launchIgnitionMs) / 1000;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const age = sinceIgnition - i * 0.32;
        if (age < 0 || age >= 4.1) continue;
        const size = 0.58 + age * 1.0;
        puff(
          side * (1.25 + age * 2.5),
          0.42 + age * 0.36,
          Math.sin(i * 2.4) * 0.52,
          size * 1.9,
          size,
          0.94 * (1 - age / 4.1),
        );
      }
    }
    if (apart > 0) {
      // The pressure cloud hangs where the two stages separated as the debris travels away.
      const jointAtBreakup =
        launchDeckHeight + riseAtBreakup + stageJointHeight(height);
      for (let i = 0; i < 7; i++) {
        const spread = 0.45 + apart * 1.6;
        puff(
          Math.cos(i * 2.4) * spread,
          jointAtBreakup + Math.sin(i * 2.4) * spread,
          Math.sin(i) * 0.8,
          2 + apart * 2.8,
          1 + apart * 1.8,
          0.68 * Math.max(0, 1 - apart / 2.5),
        );
      }
    }
    geometry.instanceCount = count;
    centres.needsUpdate = shapes.needsUpdate = true;
  });
  return (
    <mesh geometry={buffers.geometry} frustumCulled={false} renderOrder={1}>
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={{ cloud: { value: texture } }}
        vertexShader={`attribute vec3 centre, shape;
      varying vec2 vUv;
      varying float alpha;
      void main() {
        vec4 eye = modelViewMatrix * vec4(centre, 1.);
        eye.xy += position.xy * shape.xy * length(modelMatrix[0].xyz);
        gl_Position = projectionMatrix * eye;
        vUv=uv; alpha=shape.z;
      }`}
        fragmentShader={`uniform sampler2D cloud; varying vec2 vUv; varying float alpha;
      void main() {
        vec4 puff = texture2D(cloud,vUv);
        gl_FragColor = vec4(puff.rgb,puff.a*alpha);
        #include <colorspace_fragment>
      }`}
      />
    </mesh>
  );
}
