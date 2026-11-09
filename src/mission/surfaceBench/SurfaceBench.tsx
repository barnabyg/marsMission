// Development only: the surface view at a Landing Site with one of every surface model on it, as Mission Mode draws it,
// for scripts/measure-surface-frames.mjs to time and picture. The page is opened as surfaceBench.html, or with
// ?focus=rover (any surface model) to look closely at one model where it stands.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { StrictMode, useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { AssetAtMars } from "../../simulation/timeline";
import type { CameraPose } from "../sceneParts";
import { placeOf, surfaceCentre, surfaceShot } from "../surface/surface";
import { SurfaceScene } from "../surface/SurfaceView";
import { groundHeight } from "../surface/terrain";

const siteName = "Jezero Crater";
const day = 40;

/** One of every surface model, in the order they take their places. */
const kinds = [
  "lander",
  "rover",
  "fuel-plant",
  "habitat",
  "lab",
  "ascent-vehicle",
  "crew",
] as const;

const assetsAtMars: AssetAtMars[] = kinds.map((kind) => ({
  key: `bench-${kind}`,
  name: kind,
  label: kind,
  kind,
  landingSiteName: siteName,
  activityName: "Working",
  surfaceMotion: "still",
  arrivedOnDay: -100,
  fromDay: 0,
  untilDay: null,
  ...(kind === "crew" && {
    crew: [
      { name: "A", arrivedOnDay: -100, fromDay: 0, untilDay: null },
      { name: "B", arrivedOnDay: -100, fromDay: 0, untilDay: null },
    ],
  }),
}));

const query = new URLSearchParams(location.search);
const focus = query.get("focus");
const focusPlace = kinds.findIndex((kind) => kind === focus);

/** The surface view's own shot, or close in on one model from in front, a little to the right and above. */
function shotOf(place: number): CameraPose {
  if (place < 0) return surfaceShot;
  const { x, z } = placeOf(place);
  const ground = groundHeight(siteName, x, z);
  const [cx, cy, cz] = surfaceCentre;
  return {
    position: [cx + x + 1.3, cy + ground + 1.3, cz + z - 2.4],
    target: [cx + x, cy + ground + 0.55, cz + z],
  };
}

/** Puts the camera on its shot, then marks the page ready once a few frames have been drawn. */
function Camera() {
  const camera = useThree((state) => state.camera);
  const frames = useRef(0);
  useLayoutEffect(() => {
    const { position, target } = shotOf(focusPlace);
    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateMatrixWorld();
  }, [camera]);
  useFrame(({ gl }) => {
    frames.current += 1;
    // What the last frame drew, for the script to print beside the times.
    const { calls, triangles } = gl.info.render;
    document.documentElement.dataset.drawn = `${calls} draw calls, ${triangles} triangles`;
    if (frames.current === 5) document.documentElement.dataset.ready = "";
    // For the script, which takes a close-up of each.
    document.documentElement.dataset.kinds = kinds.join(" ");
  });
  return null;
}

const root = document.getElementById("root");
if (!root) throw new Error("The page has no root element.");
createRoot(root).render(
  <StrictMode>
    <Canvas camera={{ fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
      <color attach="background" args={["#05060c"]} />
      <SurfaceScene
        timeline={{ assetsAtMars, dustStorms: [] }}
        day={day}
        siteName={siteName}
        sequence={null}
        ascent={null}
      />
      <Camera />
    </Canvas>
  </StrictMode>,
);
