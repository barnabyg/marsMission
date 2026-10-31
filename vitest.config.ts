import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // One failure is enough to stop and look. A direct local run still reports every failure.
    bail: process.env.CI ? 1 : 0,
  },
});
