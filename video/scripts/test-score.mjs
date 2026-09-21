import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const b = await readFile(new URL("../public/audio/score.wav", import.meta.url));
assert.equal(b.toString("ascii", 0, 4), "RIFF");
assert.equal(b.readUInt32LE(24), 48000);
assert.equal(b.readUInt16LE(22), 2);
assert.equal(b.length, 44 + 45 * 48000 * 4);
let peak = 0,
  energy = 0;
for (let i = 44; i < b.length; i += 2) {
  const x = b.readInt16LE(i) / 32768;
  peak = Math.max(peak, Math.abs(x));
  energy += x * x;
}
assert(peak <= 0.8 && peak > 0.05, `peak ${peak}`);
assert.equal(b.readInt16LE(44), 0);
assert(Math.abs(b.readInt16LE(b.length - 2)) < 3);
assert(energy > 100, "soundtrack must not be silent");
// Every beat must start continuously; amplitude-only tests miss periodic clicks.
let maxBeatJump = 0;
for (let beat = 1; beat < 60; beat++) {
  const sample = Math.round(beat * 0.75 * 48000);
  for (let channel = 0; channel < 2; channel++) {
    const a = b.readInt16LE(44 + ((sample - 1) * 2 + channel) * 2);
    const z = b.readInt16LE(44 + (sample * 2 + channel) * 2);
    maxBeatJump = Math.max(maxBeatJump, Math.abs(z - a) / 32768);
  }
}
assert(maxBeatJump < 0.025, `Audible beat discontinuity: ${maxBeatJump}`);
console.log(
  JSON.stringify({
    duration: 45,
    sampleRate: 48000,
    channels: 2,
    peak,
    maxBeatJump,
    rms: Math.sqrt(energy / ((b.length - 44) / 2)),
  }),
);
