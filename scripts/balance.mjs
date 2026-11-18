// Plays the strategies in src/balance with the real data files.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createServer } from "vite";

const { values } = parseArgs({
  options: { programs: { type: "string" }, metrics: { type: "boolean" } },
});
const programs = Number(values.programs ?? "1000");
if (values.metrics && values.programs !== undefined) {
  console.error("GameBench metrics use a fixed set of seeds.");
  process.exit(1);
}
if (!Number.isInteger(programs) || programs < 1) {
  console.error("--programs must be a whole number above 0.");
  process.exit(1);
}

let commit;
if (values.metrics) {
  const changes = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    { encoding: "utf8" },
  );
  if (changes) {
    console.error(
      "Commit or stash tracked changes before generating GameBench metrics.",
    );
    process.exit(1);
  }
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
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
  const { realCatalogueFiles } = await server.ssrLoadModule(
    "/src/testing/realCatalogue.ts",
  );
  const files = realCatalogueFiles();
  if (commit) {
    const { gamebenchBalanceSuite } = await server.ssrLoadModule(
      "/src/balance/gamebenchMetrics.ts",
    );
    const suite = gamebenchBalanceSuite(files);
    const report = {
      schemaVersion: 1,
      commit,
      generatedAt: new Date().toISOString(),
      suites: [suite],
    };
    writeFileSync("metrics.json", `${JSON.stringify(report, null, 2)}\n`);
  } else {
    const { balanceReport } = await server.ssrLoadModule(
      "/src/balance/report.ts",
    );
    process.stdout.write(balanceReport(files, programs));
  }
} finally {
  await server.close();
}
