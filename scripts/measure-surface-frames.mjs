// Times the surface view as the browser tests draw it, in software at 4K, so that a change to the terrain or the
// models can be checked against the frame time before it (issue #220). It isn't part of `npm run verify`:
//   node scripts/measure-surface-frames.mjs [--runs 3] [--seconds 10] [--port 5290] [--shots <directory>]
// It starts the development server, opens src/mission/surfaceBench/surfaceBench.html, which stands one of every surface
// model at a Landing Site, lets it settle, and then counts frames for the given seconds, printing the median frame
// time of each run. Runs on a busy machine are slower, so compare runs made one after another. With --shots it also
// saves a 4K picture of the whole view and one close up on each model to that directory.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { createServer } from "vite";

const { values } = parseArgs({
  options: {
    runs: { type: "string", default: "3" },
    seconds: { type: "string", default: "10" },
    port: { type: "string", default: "5290" },
    shots: { type: "string" },
  },
});
const runs = Number(values.runs);
const seconds = Number(values.seconds);
const page4K = { width: 3840, height: 2160 };
const focuses = [
  "lander",
  "rover",
  "fuel-plant",
  "habitat",
  "lab",
  "ascent-vehicle",
  "crew",
];

const server = await createServer({
  logLevel: "warn",
  server: { port: Number(values.port), strictPort: true },
});
let browser;
try {
  await server.listen();
  const baseUrl = server.resolvedUrls?.local[0];
  if (!baseUrl) throw new Error("The development server gave no address.");
  const bench = `${baseUrl}src/mission/surfaceBench/surfaceBench.html`;
  browser = await chromium.launch({
    // The same software renderer as the browser tests.
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const open = async (url) => {
    const page = await browser.newPage({
      viewport: page4K,
      deviceScaleFactor: 1,
    });
    await page.goto(url);
    await page.waitForSelector("html[data-ready]", {
      state: "attached",
      timeout: 120_000,
    });
    return page;
  };

  if (values.shots !== undefined) {
    mkdirSync(values.shots, { recursive: true });
    for (const focus of ["", ...focuses]) {
      const page = await open(focus === "" ? bench : `${bench}?focus=${focus}`);
      const file = `${values.shots}/${focus === "" ? "surface" : focus}.png`;
      await page.screenshot({ path: file });
      console.log(`Wrote ${file}`);
      await page.close();
    }
  }

  const medians = [];
  const means = [];
  for (let run = 1; run <= runs; run++) {
    const page = await open(bench);
    const frameTimes = await page.evaluate(async (milliseconds) => {
      // Let shaders compile and the first frames pass before counting.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const times = [];
      let last = performance.now();
      const end = last + milliseconds;
      await new Promise((resolve) => {
        const tick = (now) => {
          times.push(now - last);
          last = now;
          if (now < end) globalThis.requestAnimationFrame(tick);
          else resolve();
        };
        globalThis.requestAnimationFrame(tick);
      });
      return times.slice(1);
    }, seconds * 1000);
    // Frames land on the display's refresh, so the median moves in steps of a refresh; the mean doesn't.
    const mean =
      frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    frameTimes.sort((first, second) => first - second);
    const median = frameTimes[Math.floor(frameTimes.length / 2)];
    medians.push(median);
    means.push(mean);
    console.log(
      `Run ${run}: median frame ${median.toFixed(1)} ms, mean ${mean.toFixed(1)} ms, over ${frameTimes.length} frames`,
    );
    await page.close();
  }
  if (runs > 0) {
    medians.sort((first, second) => first - second);
    means.sort((first, second) => first - second);
    console.log(
      `Median of runs: median frame ${medians[Math.floor(medians.length / 2)].toFixed(1)} ms, mean ${means[Math.floor(means.length / 2)].toFixed(1)} ms`,
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
