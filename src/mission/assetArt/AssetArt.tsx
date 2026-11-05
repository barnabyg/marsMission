// Development only: pictures one Asset kind's model, as Mission Mode draws it, for scripts/generate-asset-art.mjs to
// save as the Asset cards' images. The page is opened as assetArt.html?kind=rover&size=256.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { StrictMode, useLayoutEffect, useRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  Box3,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Sphere,
  Vector3,
  type Group,
} from "three";
import { Orbiter } from "../spacecraft/spacecraftModels";
import { models } from "../surface/surfaceModels";

const fov = 30;

/** Each kind's model, from where Mission Mode shows it best: an orbiter with its arrays out, and the rest on the surface. */
const modelsByKind: Partial<Record<string, ReactNode>> = {
  orbiter: <Orbiter lost={false} deployed />,
  lander: <models.lander />,
  rover: <models.rover />,
  crew: <models.crewLander />,
};

/** The camera looks from in front, a little to the right and above, where a lander's hatch and a rover's front show. */
const viewFrom = new Vector3(0.75, 0.55, -1.3).normalize();

/**
 * The surface models are unlit, with their light worked into their colours, which is right beside the ground in
 * Mission Mode but looks flat on a card. Here each of their parts takes the light instead, in the same colour.
 */
function lightUnlitParts(model: Group) {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const material: unknown = object.material;
    if (!(material instanceof MeshBasicMaterial) || material.transparent)
      return;
    object.material = new MeshStandardMaterial({
      color: material.color,
      side: material.side,
      roughness: 0.6,
      metalness: 0.1,
    });
  });
}

/**
 * Lights the surface models' parts, then puts the camera where the whole model just fits, then marks the page ready
 * once a frame has been drawn. Nothing
 * moves, so the picture is the same on every run.
 */
function Framed({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const framesDrawn = useRef(0);
  useLayoutEffect(() => {
    if (!group.current) return;
    lightUnlitParts(group.current);
    const sphere = new Box3()
      .setFromObject(group.current)
      .getBoundingSphere(new Sphere());
    const distance = sphere.radius / Math.sin(MathUtils.degToRad(fov / 2));
    camera.position.copy(viewFrom).multiplyScalar(distance).add(sphere.center);
    camera.lookAt(sphere.center);
    camera.updateMatrixWorld();
  }, [camera]);
  useFrame(() => {
    framesDrawn.current += 1;
    if (framesDrawn.current === 2) document.documentElement.dataset.ready = "";
  });
  return <group ref={group}>{children}</group>;
}

const query = new URLSearchParams(location.search);
const model = modelsByKind[query.get("kind") ?? ""];
const size = Number(query.get("size") ?? 256);
const root = document.getElementById("root");
if (!root) throw new Error("The page has no root element.");

if (model === undefined) {
  // The script stops on this, so a new kind gets a model chosen for it here rather than a wrong picture.
  document.documentElement.dataset.error = `No model for the kind "${query.get("kind") ?? ""}"`;
} else {
  createRoot(root).render(
    <StrictMode>
      <div style={{ width: size, height: size }}>
        <Canvas
          // Drawn at twice the size, which the script scales down, so that thin parts come out smooth.
          dpr={2}
          camera={{ fov }}
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
        >
          {/* A key light from above and in front, a soft fill from the left and a rim of light from behind. */}
          <hemisphereLight args={["#ffffff", "#7a4a2c", 0.9]} />
          <directionalLight position={[2, 3, -2]} intensity={2.4} />
          <directionalLight position={[-3, 1, -1]} intensity={0.7} />
          <directionalLight position={[-1, 2, 3]} intensity={1.2} />
          <Framed>{model}</Framed>
        </Canvas>
      </div>
    </StrictMode>,
  );
}
