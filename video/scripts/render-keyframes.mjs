import { bundle } from "@remotion/bundler";
import {
  openBrowser,
  selectComposition,
  renderStill,
} from "@remotion/renderer";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
const root = fileURLToPath(new URL("../", import.meta.url));
const frames = process.argv.slice(2).map(Number);
if (frames.some((f) => !Number.isInteger(f) || f < 0 || f > 1349))
  throw new Error("Frame must be 0..1349");
const output = fileURLToPath(new URL("../out/keyframes/", import.meta.url));
await mkdir(output, { recursive: true });
const serveUrl = await bundle({
  entryPoint: root + "src/index.ts",
  publicDir: root + "public",
});
const browser = await openBrowser("chrome");
try {
  const composition = await selectComposition({
    serveUrl,
    id: "BrainBotDemo",
    puppeteerInstance: browser,
  });
  for (const frame of frames) {
    await renderStill({
      serveUrl,
      composition,
      frame,
      output: output + `${frame}.png`,
      puppeteerInstance: browser,
    });
    console.log(`Frame ${frame} saved`);
  }
} finally {
  await browser.close({ silent: true });
}
