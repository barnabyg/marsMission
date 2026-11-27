// Blind play: a live model plays the game in a browser as a first-time player and keeps a journal.
// See "Blind play" in docs/develop/blind-play.md. It runs only when asked for, never in a test suite or CI.
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const usage = `Usage: npm run blind-play -- --model <model-id> --live [options]
       npm run blind-play -- --replay <trace.json> [--headed]

A live model plays Mars Mission once as a player who has never seen it, and
keeps a journal. It calls OpenAI, so it needs --live and OPENAI_API_KEY.

  --model <id>            The OpenAI model that plays
  --reasoning-effort <e>  Sent as reasoning.effort
  --seed <n>              The Program's seed (default 1)
  --turns <n>             Stop once the game reaches a later Turn (default 3)
  --max-actions <n>       Stop after this many steps (default 60 a Turn, at least 150)
  --tutorial <mode>       off (default), on, or choose: offered as to any new player
  --time-scale <n>        How many times faster Mission Mode plays (default 10)
  --wait-ms <n>           The longest one Wait lets a Mission play (default 30000)
  --output <dir>          Where the journal, report and trace go
  --headed                Show the browser
  --replay <trace.json>   Take the actions of an earlier run's trace instead of asking a model`;

const { values } = parseArgs({
  options: {
    model: { type: "string" },
    live: { type: "boolean" },
    "reasoning-effort": { type: "string" },
    seed: { type: "string" },
    turns: { type: "string" },
    "max-actions": { type: "string" },
    tutorial: { type: "string" },
    "time-scale": { type: "string" },
    "wait-ms": { type: "string" },
    output: { type: "string" },
    headed: { type: "boolean" },
    replay: { type: "string" },
    port: { type: "string" },
    help: { type: "boolean" },
  },
});

function fail(message) {
  console.error(`${message}\n\n${usage}`);
  process.exit(1);
}

function whole(name, fallback, least = 1) {
  const value = values[name] === undefined ? fallback : Number(values[name]);
  if (!Number.isInteger(value) || value < least) {
    fail(`--${name} must be a whole number of at least ${String(least)}.`);
  }
  return value;
}

if (values.help) {
  console.log(usage);
  process.exit(0);
}
let replay = null;
if (values.replay !== undefined) {
  const trace = JSON.parse(readFileSync(values.replay, "utf8"));
  replay = { trace: trace.actions, seed: trace.seed, tutorial: trace.tutorial };
} else {
  if (values.model === undefined) fail("--model is required.");
  if (!values.live)
    fail("--live is required, as a run calls OpenAI and costs money.");
  if (!process.env.OPENAI_API_KEY) fail("OPENAI_API_KEY is not set.");
}
const tutorial = replay?.tutorial ?? values.tutorial ?? "off";
if (!["off", "on", "choose"].includes(tutorial)) {
  fail("--tutorial must be off, on or choose.");
}
const seed = replay?.seed ?? whole("seed", 1, 0);
const turns = whole("turns", 3);
const timeScale = whole("time-scale", 10);
const waitMs = whole("wait-ms", 30_000, 1_000);
const port = whole("port", 5391, 1024);

// Mission Mode's speed-ups are read on the development server only (src/mission/devSettings.ts).
process.env.VITE_MISSION_TIME_SCALE = String(timeScale);
process.env.VITE_SEQUENCE_TIME_SCALE = "1";
const server = await createServer({
  server: { port, strictPort: true },
  logLevel: "warn",
});
let browser;
try {
  await server.listen();
  const { runBlindPlay, defaultMaxActions } = await server.ssrLoadModule(
    "/src/blindPlay/run.ts",
  );
  const maxActions = whole("max-actions", defaultMaxActions(turns));
  const output =
    values.output ??
    join(
      ".scratch",
      "blind-play",
      `seed${String(seed)}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    );

  // As the browser tests do: the GPU on Windows, software rendering elsewhere.
  browser = await chromium.launch({
    headless: !values.headed,
    args:
      process.platform === "win32"
        ? ["--use-angle=d3d11"]
        : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await page.goto(`http://localhost:${String(port)}/?seed=${String(seed)}`);
  await page.locator("h1").first().waitFor();

  // Each step is kept as it is played, so that a run cut short still leaves its journal so far in steps.jsonl.
  mkdirSync(output, { recursive: true });
  const stepsFile = join(output, "steps.jsonl");
  writeFileSync(stepsFile, "");
  // Ctrl+C stops the run after the step it is on, and still asks for the debrief and writes the report.
  let interrupted = false;
  process.on("SIGINT", () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    console.log(
      "\nStopping after this step. Press Ctrl+C again to quit at once.",
    );
  });

  console.log(
    `Blind play: seed ${String(seed)}, Tutorial mode ${tutorial}, ${replay ? "replaying a trace" : `player ${values.model}`}, at most ${String(turns)} Turns and ${String(maxActions)} steps.`,
  );
  const { report, journal } = await runBlindPlay({
    page,
    seed,
    tutorial,
    maxTurns: turns,
    maxActions,
    waitMs,
    player: replay
      ? { kind: "replay", actions: replay.trace }
      : {
          kind: "openai",
          apiKey: process.env.OPENAI_API_KEY,
          model: values.model,
          ...(values["reasoning-effort"] === undefined
            ? {}
            : { reasoningEffort: values["reasoning-effort"] }),
        },
    interrupted: () => interrupted,
    onStep: (step) => {
      appendFileSync(stepsFile, `${JSON.stringify(step)}\n`);
      console.log(
        `${String(step.number).padStart(3)}. [Turn ${String(step.turn ?? "?")}, ${step.screen}] ${step.action}${step.puzzled ? "  (puzzled)" : ""}`,
      );
    },
  });

  writeFileSync(join(output, "journal.md"), journal);
  writeFileSync(
    join(output, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(
    join(output, "trace.json"),
    `${JSON.stringify({ seed, tutorial, actions: report.trace }, null, 2)}\n`,
  );
  console.log(
    `\nStopped: ${report.stopped}${report.error ? ` (${report.error})` : ""}. ${String(report.usage.calls)} calls, ${String(report.usage.inputTokens)} tokens in, ${String(report.usage.outputTokens)} out.`,
  );
  console.log(`Journal: ${join(output, "journal.md")}`);
  if (values.headed && replay) {
    console.log(
      "The browser stays open at the end of the replay. Press Ctrl+C to stop.",
    );
    await new Promise(() => undefined);
  }
  if (report.stopped === "model-error" && !replay) process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
