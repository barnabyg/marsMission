// Makes the Asset cards' pictures from the 3D models Mission Mode draws, so they need no art of their own (ADR 0005).
// The output is committed. Rerun this only after changing a model or adding a kind of Asset:
//   node scripts/generate-asset-art.mjs
// It starts the development server, opens src/mission/assetArt/assetArt.html in Chromium for each kind of Asset in
// public/data/assets.json and for the Crewed Mission ("crew"), and saves what it draws as public/art/assets/<kind>.png.
// The camera, lights and size are fixed and nothing moves, so rerunning it gives the same files.
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const size = 256;
const outDir = "public/art/assets";

const assets = JSON.parse(readFileSync("public/data/assets.json", "utf8"));
const kinds = [...new Set(assets.map(({ kind }) => kind)), "crew"].sort();

const server = await createServer({
  logLevel: "warn",
  server: { port: 5290, strictPort: false },
});
let browser;
try {
  await server.listen();
  const baseUrl = server.resolvedUrls?.local[0];
  if (!baseUrl) throw new Error("The development server gave no address.");
  browser = await chromium.launch({
    // The same software renderer as the browser tests, so the pictures don't depend on this machine's GPU.
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  mkdirSync(outDir, { recursive: true });
  for (const kind of kinds) {
    await page.goto(
      `${baseUrl}src/mission/assetArt/assetArt.html?kind=${kind}&size=${size}`,
    );
    await page.waitForSelector("html[data-ready], html[data-error]", {
      state: "attached",
      timeout: 60_000,
    });
    const error = await page.locator("html").getAttribute("data-error");
    if (error !== null) {
      throw new Error(
        `${error}. Add one to src/mission/assetArt/AssetArt.tsx.`,
      );
    }
    // The canvas's own pixels, transparent around the model, rather than a screenshot of the page. The page draws
    // them at twice the size, and they're scaled down here so that thin parts come out smooth.
    const dataUrl = await page.locator("canvas").evaluate((canvas, side) => {
      const scaled = canvas.ownerDocument.createElement("canvas");
      scaled.width = side;
      scaled.height = side;
      const context = scaled.getContext("2d");
      if (!context) throw new Error("The browser gave no 2D canvas.");
      context.imageSmoothingQuality = "high";
      context.drawImage(canvas, 0, 0, side, side);
      return scaled.toDataURL("image/png");
    }, size);
    const file = `${outDir}/${kind}.png`;
    writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
    console.log(`Wrote ${file}`);
  }
} finally {
  await browser?.close();
  await server.close();
}
