// A separate local origin gives the playtest its own automatic save. Use the same
// seeded Programs as the browser tests so setup takes one Turn even for late-game flights.
import { createServer } from "vite";

const selector = "/scripts/journey-playtest.html";
let data;
const server = await createServer({
  server: { host: "127.0.0.1", port: 5381, strictPort: true, open: selector },
  plugins: [
    {
      name: "journey-playtest",
      configureServer(vite) {
        vite.middlewares.use(
          "/journey-scenarios.json",
          (_request, response) => {
            response.setHeader("Content-Type", "application/json");
            response.end(data);
          },
        );
      },
    },
  ],
});
try {
  const { journeyPlaytest } = await server.ssrLoadModule(
    "/e2e/journeyScenarios.ts",
  );
  data = JSON.stringify(journeyPlaytest);
  await server.listen();
  const url = new URL(selector, server.resolvedUrls.local[0]);
  console.log(`Open ${url.href} to choose a flight. Press Ctrl+C to stop.`);
} catch (error) {
  await server.close();
  throw error;
}
