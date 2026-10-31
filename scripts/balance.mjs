// Plays the strategies in src/balance over many seeds with the real data files and prints the report.
import { parseArgs } from "node:util";
import { createServer } from "vite";

const { values } = parseArgs({
  options: { programs: { type: "string", default: "1000" } },
});
const programs = Number(values.programs);
if (!Number.isInteger(programs) || programs < 1) {
  console.error("--programs must be a whole number above 0.");
  process.exit(1);
}

// Vite only loads the TypeScript here, so it serves nothing and watches nothing. The game's own config isn't needed.
const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { balanceReport } = await server.ssrLoadModule(
    "/src/balance/report.ts",
  );
  const { realCatalogueFiles } = await server.ssrLoadModule(
    "/src/testing/realCatalogue.ts",
  );
  process.stdout.write(balanceReport(realCatalogueFiles(), programs));
} finally {
  await server.close();
}
