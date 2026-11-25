// Development-only view of the production launch at an exact time. The bench loops the busiest part of ignition.
import { Canvas, useFrame } from "@react-three/fiber";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { LaunchScene } from "./LaunchScene";

const query = new URLSearchParams(location.search);
const vehicleId = query.get("vehicle") ?? "meridian-colossus";
const failed = query.has("failed");
const startMs = Number(query.get("ms") ?? 3200);

function Review() {
  const [elapsedMs, setElapsedMs] = useState(startMs);
  useFrame(({ gl }, seconds) => {
    if (query.has("loop"))
      setElapsedMs((ms) => startMs + ((ms - startMs + seconds * 1000) % 650));
    if (!document.documentElement.dataset.drawn && gl.info.render.frame > 4) {
      document.documentElement.dataset.drawn = String(gl.info.render.calls);
    }
  });
  return <LaunchScene launch={{ elapsedMs, vehicleId, failed }} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing launch review root");
createRoot(root).render(
  <Canvas camera={{ fov: 45 }}>
    <Review />
  </Canvas>,
);
