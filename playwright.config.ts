import { defineConfig, devices } from "@playwright/test";

// Fixed by default. A second worktree testing at the same time sets E2E_PORT to keep clear of the first.
const port = Number(process.env.E2E_PORT ?? 5199);
const productionPort = port - 1;
const productionOutDir = "node_modules/.cache/e2e-build";

export const productionBaseURL = `http://localhost:${productionPort}`;

/**
 * How many times faster than in play a landing, a rendezvous and the like run on the development server, which cuts
 * the seconds a test waits on one. Tests that wait on purpose for one to be over divide by it. Above 3, a test that
 * switches views during a landing can find it already over.
 */
export const sequenceTimeScale = 3;

/**
 * A local run on Windows draws the 3D view on the machine's GPU, through Direct3D 11, rather than in software. On a
 * 20-core machine with a GPU, that took the suite from 3.4 to 2.0 minutes, and its slowest test from 11.5 to 6 s.
 * Without a GPU, Windows draws Direct3D in software itself. CI keeps SwiftShader, the software renderer, so it still
 * tests the slow path some players' machines take; E2E_SOFTWARE_RENDERING=1 does the same locally, to repeat a CI run.
 */
const localGpu =
  !process.env.CI &&
  !process.env.E2E_SOFTWARE_RENDERING &&
  process.platform === "win32";

export default defineConfig({
  testDir: "e2e",
  // Every test opens its own browser context, so its saves and routes stay its own, and the workers can share the two servers.
  // Each worker renders 4K in software, and playback moves at most 250 ms a frame, so a starved worker falls behind real time.
  // Two workers on one of CI's 4-core runners did, and a 1x Turn timed out, so CI runs one per shard and the shards run side by side.
  // Locally, a worker for every 5 cores: four on 20 cores ran the suite in about 3.5 minutes in software, with the CPU
  // 80-98% busy, and six took longer. On the GPU, four take about 2 minutes.
  fullyParallel: true,
  workers: process.env.CI ? 1 : "20%",
  forbidOnly: true,
  // One failure is enough to stop and look. A direct local run still reports every failure.
  maxFailures: process.env.CI ? 1 : 0,
  reporter: "list",
  timeout: 180_000,
  // Software rendering at 4K is slow, so Mission Mode can take a while on machines without a GPU.
  expect: { timeout: 30_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${port}`,
    viewport: { width: 3840, height: 2160 },
    deviceScaleFactor: 1,
    launchOptions: {
      args: localGpu
        ? ["--use-angle=d3d11"]
        : // Lets the 3D view render on machines without a GPU, such as CI.
          ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: [
    {
      command: `npx vite --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: false,
      stdout: "ignore",
      // Development-only: runs a Turn in 12 s at 1x, quick enough for browser tests but slow enough to pause.
      env: {
        VITE_MISSION_TIME_SCALE: "100",
        VITE_SEQUENCE_TIME_SCALE: String(sequenceTimeScale),
      },
    },
    {
      // The same kind of build the playtest command runs.
      command: `npx vite build --logLevel warn --outDir ${productionOutDir} --emptyOutDir && npx vite preview --outDir ${productionOutDir} --port ${productionPort} --strictPort`,
      url: productionBaseURL,
      reuseExistingServer: false,
      stdout: "ignore",
      timeout: 120_000,
    },
  ],
});
