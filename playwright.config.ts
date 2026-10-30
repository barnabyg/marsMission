import { defineConfig, devices } from "@playwright/test";

const port = 5199;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: "list",
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${port}`,
    viewport: { width: 3840, height: 2160 },
    deviceScaleFactor: 1,
    launchOptions: {
      // Lets the 3D view render on machines without a GPU, such as CI.
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    stdout: "ignore",
    // Development-only: runs Mission Mode fast enough for browser tests.
    env: { VITE_MISSION_TIME_SCALE: "300" },
  },
});
