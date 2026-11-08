import { memo, useLayoutEffect, useMemo, useRef } from "react";
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { useDisposal } from "../sceneParts";
import { rocksAt } from "./rocks";
import { latticeValue } from "./siteNoise";
import { detailTexture, rockMaterial, terrainMaterial } from "./surfaceShading";
import { basaltColor, buildTerrain, horizonColor } from "./terrain";

/** The ground at a Landing Site and the sky over it: the terrain, the rocks lying on it and the sky down to the horizon. */

/** Big enough to reach past the land's fade, and small enough to stay clear of the solar system's camera and the stars. */
const skyRadius = 14.5;
const zenithColor = [0.2, 0.09, 0.06] as const;

/** The palest of the rocks, dusty stone, which the darkest, bare basalt, is mixed towards. */
const dustyStone = [0.46, 0.24, 0.14] as const;

export function Terrain({ siteName }: { siteName: string }) {
  const geometry = useMemo(() => {
    const { positions, colors, detail, indices } = buildTerrain(siteName);
    return new BufferGeometry()
      .setAttribute("position", new BufferAttribute(positions, 3))
      .setAttribute("color", new BufferAttribute(colors, 3))
      .setAttribute("detail", new BufferAttribute(detail, 1))
      .setIndex(new BufferAttribute(indices, 1));
  }, [siteName]);
  const grain = useMemo(() => detailTexture(), []);
  const material = useMemo(() => terrainMaterial(grain), [grain]);
  useDisposal(geometry);
  useDisposal(grain);
  useDisposal(material);
  return <mesh geometry={geometry} material={material} />;
}

/** A lumpy stone, faceted, that each rock is a stretched and turned copy of. About 1 unit across. */
function rockGeometry() {
  const stone = new IcosahedronGeometry(0.5, 1);
  const { position } = stone.attributes;
  if (!position) return stone;
  for (let vertex = 0; vertex < position.count; vertex++) {
    const [x, y, z] = [
      position.getX(vertex),
      position.getY(vertex),
      position.getZ(vertex),
    ];
    // Corners shared by several faces move together, so the stone stays closed.
    const bump =
      0.78 +
      0.4 *
        latticeValue(
          0x7f4a7c15,
          Math.round(x * 100) * 7 + Math.round(y * 100),
          Math.round(z * 100),
        );
    position.setXYZ(vertex, x * bump, Math.max(y * bump, -0.3), z * bump);
  }
  stone.computeVertexNormals();
  return stone;
}

/** The site's stones and boulders, all drawn at once as copies of one stone. */
export function Rocks({ siteName }: { siteName: string }) {
  const rocks = useMemo(() => rocksAt(siteName), [siteName]);
  const geometry = useMemo(() => rockGeometry(), []);
  const material = useMemo(() => rockMaterial(), []);
  const mesh = useRef<InstancedMesh>(null);
  useDisposal(geometry);
  useDisposal(material);
  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) return;
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const color = new Color();
    rocks.forEach(({ x, y, z, size, turn: angle, shade }, index) => {
      matrix.compose(
        new Vector3(x, y, z),
        turn.setFromAxisAngle(up, angle),
        new Vector3(...size),
      );
      instances.setMatrixAt(index, matrix);
      color.setRGB(
        ...([0, 1, 2].map(
          (channel) =>
            (basaltColor[channel] ?? 0) * (1 - shade) +
            (dustyStone[channel] ?? 0) * shade,
        ) as [number, number, number]),
      );
      instances.setColorAt(index, color);
    });
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    instances.computeBoundingSphere();
  }, [rocks]);
  return (
    <instancedMesh
      // A new mesh for each site, as the count of rocks is fixed when it's made.
      key={siteName}
      ref={mesh}
      args={[geometry, material, rocks.length]}
    />
  );
}

export const Sky = memo(function Sky() {
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
