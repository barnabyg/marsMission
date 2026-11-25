// Renders the game's launch at native desktop resolutions. --shots writes stills as well as timing the ignition shot.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createServer } from "vite";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "5390" },
    runs: { type: "string", default: "3" },
    seconds: { type: "string", default: "5" },
    shots: { type: "string" },
  },
});
const server = await createServer({
  logLevel: "warn",
  server: { port: Number(values.port), strictPort: true },
});
const modes = [
  ["native", process.platform === "win32" ? ["--use-angle=d3d11"] : []],
  ["software", ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]],
];
const frames = [
  ["a", "vehicle=meridian-heavy&ms=600"],
  ["b", "vehicle=meridian-colossus&ms=600"],
  ["c", "vehicle=meridian-medium&ms=600"],
  ["ignition", "ms=3300"],
  ["cloud", "ms=8650"],
  ["breakup", "vehicle=meridian-medium&ms=7700&failed"],
];

try {
  await server.listen();
  const base = new URL(
    "src/mission/launch/review.html",
    server.resolvedUrls.local[0],
  );
  for (const [mode, args] of modes) {
    const browser = await chromium.launch({ args });
    try {
      for (const height of [1080, 2160]) {
        const width = (height * 16) / 9;
        const page = await browser.newPage({
          viewport: { width, height },
          deviceScaleFactor: 1,
        });
        const open = async (search) => {
          const url = new URL(base);
          url.search = search;
          await page.goto(url.href);
          await page
            .locator("html[data-drawn]")
            .waitFor({ state: "attached", timeout: 120_000 });
        };
        await open("loop");
        const renderer = await page.locator("canvas").evaluate((canvas) => {
          const gl = canvas.getContext("webgl2");
          const ext = gl.getExtension("WEBGL_debug_renderer_info");
          return ext
            ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER);
        });
        const draws = await page.locator("html").getAttribute("data-drawn");
        console.log(
          `${mode}, ${width}x${height}, ${renderer}, ${draws} draw calls`,
        );
        for (let run = 1; run <= Number(values.runs); run++) {
          const times = await page.evaluate(async (seconds) => {
            // Let the renderer warm up before each sample, including after the first shader compilation.
            await new Promise((resolve) => setTimeout(resolve, 1500));
            return await new Promise((resolve) => {
              const times = [];
              const tick = (start, previous) =>
                globalThis.requestAnimationFrame((now) => {
                  times.push(now - previous);
                  if (now - start < seconds * 1000) tick(start, now);
                  else resolve(times);
                });
              globalThis.requestAnimationFrame((start) => tick(start, start));
            });
          }, Number(values.seconds));
          times.sort((a, b) => a - b);
          const median = times[Math.floor(times.length / 2)];
          const p95 = times[Math.floor(times.length * 0.95)];
          console.log(
            `Run ${run}: ${times.length} frames, median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`,
          );
        }
        if (values.shots && mode === "native") {
          mkdirSync(values.shots, { recursive: true });
          for (const [name, search] of frames) {
            await open(search);
            // Preserve the original blind comparison's filenames so existing playtest links still work.
            const original = height === 1080 && ["a", "b", "c"].includes(name);
            const file = original
              ? `launch-${name}.png`
              : `launch-${name}-${height}.jpg`;
            await page.screenshot({
              path: join(values.shots, file),
              ...(original ? {} : { quality: 89 }),
              timeout: 120_000,
            });
          }
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
