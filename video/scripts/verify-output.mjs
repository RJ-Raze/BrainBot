import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getVideoMetadata } from "@remotion/renderer";
const file = new URL("../out/brainbot-demo.mp4", import.meta.url);
const info = await stat(file);
assert(info.size > 100000, "MP4 is unexpectedly small");
const meta = await getVideoMetadata(fileURLToPath(file));
assert.equal(meta.width, 1920);
assert.equal(meta.height, 1080);
assert.equal(meta.fps, 30);
assert(Math.abs(meta.durationInSeconds - 45) < 0.1);
assert.equal(meta.codec, "h264");
assert(meta.audioCodec, "Missing audio");
assert(meta.supportsSeeking, "MP4 is not seekable");
const html = await readFile(
  new URL("../out/index.html", import.meta.url),
  "utf8",
);
assert(html.includes("./brainbot-demo.mp4"));
const report = {
  ...meta,
  bytes: info.size,
  verifiedAt: new Date().toISOString(),
  checks: [
    "dimensions",
    "fps",
    "duration",
    "h264",
    "audio",
    "seeking",
    "relative HTML source",
  ],
};
await writeFile(
  new URL("../out/verification.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
