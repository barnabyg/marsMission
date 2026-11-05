// Development only: pictures one Asset kind's model, as Mission Mode draws it, for scripts/generate-asset-art.mjs to
// save as the Asset cards' images. The page is opened as assetArt.html?kind=rover&size=256.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { StrictMode, useLayoutEffect, useRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Box3, MathUtils, Sphere, Vector3, type Group } from "three";
import { Orbiter } from "../spacecraft/spacecraftModels";
import { models } from "../surface/surfaceModels";

const fov = 30;

/** Each kind's model, from where Mission Mode shows it best: an orbiter on its way, and the rest on the surface. */
const modelsByKind: Partial<Record<string, ReactNode>> = {
  orbiter: <Orbiter lost={false} />,
  lander: <models.lander />,
  rover: <models.rover />,
  crew: <models.crewLander />,
};

/** The camera looks from in front, a little to the right and above, where a lander's hatch and a rover's front show. */
const viewFrom = new Vector3(0.75, 0.55, -1.3).normalize();

/**
 * Puts the camera where the whole model just fits, then marks the page ready once a frame has been drawn. Nothing
 * moves, so the picture is the same on every run.
 */
function Framed({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const framesDrawn = useRef(0);
  useLayoutEffect(() => {
    if (!group.current) return;
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
          dpr={1}
          camera={{ fov }}
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
        >
          {/* Only the orbiter's materials take light; the surface models carry their light in their colours. */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 3, -2]} intensity={2.4} />
          <Framed>{model}</Framed>
        </Canvas>
      </div>
    </StrictMode>,
  );
}
