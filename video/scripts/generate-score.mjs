import { mkdir, writeFile } from "node:fs/promises";
const sr = 48000,
  duration = 45,
  count = sr * duration;
const samples = new Float64Array(count * 2);
const TAU = 2 * Math.PI;
const chords = [
  [130.8128, 164.8138, 195.9977, 246.9417],
  [110, 130.8128, 164.8138, 195.9977],
  [87.3071, 130.8128, 174.6141, 220],
  [97.9989, 146.8324, 195.9977, 246.9417],
];
const starts = [0, 6, 15, 25, 35, 41];
const harmonics = [1, 0.24, 0.11];
const pad = (t, notes, channel) =>
  notes.reduce((sum, hz, j) => {
    const stereo = channel === 0 ? -0.0006 : 0.0006;
    return (
      sum +
      harmonics.reduce(
        (s, h, k) =>
          s + Math.sin(TAU * hz * (k + 1) * (1 + stereo) * t + j * 0.63) * h,
        0,
      ) *
        (0.036 + 0.006 * Math.sin(t * 0.5 + j))
    );
  }, 0);
for (let n = 0; n < count; n++) {
  const t = n / sr,
    phase = t / 7.5,
    ci = Math.floor(phase) % 4,
    blend = Math.min(1, (phase % 1) / 0.22);
  const env =
    Math.sin((Math.min(1, t / 2) * Math.PI) / 2) *
    Math.sin((Math.min(1, (duration - t) / 2.8) * Math.PI) / 2);
  for (let ch = 0; ch < 2; ch++) {
    let v =
      pad(t, chords[ci], ch) * blend +
      pad(t, chords[(ci + 3) % 4], ch) * (1 - blend);
    // A restrained 80 bpm pulse and glass-like arpeggio, softer than the chord bed.
    const beat = Math.floor(t / 0.75),
      bt = t - beat * 0.75,
      note = chords[ci][beat % 4] * 4;
    const release = Math.min(1, (0.75 - bt) / 0.04);
    const hit = (1 - Math.exp(-bt * 70)) * Math.exp(-bt * 5) * release;
    v +=
      Math.sin(TAU * note * t) * hit * 0.031 +
      Math.sin(TAU * note * 2.003 * t) * hit * 0.006;
    v += Math.sin(TAU * chords[ci][0] * 0.5 * bt) *
      (1 - Math.exp(-bt * 100)) * Math.exp(-bt * 7) * release * 0.045;
    for (let j = 1; j < starts.length; j++) {
      const dt = t - starts[j];
      if (dt >= 0 && dt < 2.5) {
        v +=
          (Math.sin(TAU * 523.251 * dt) + 0.3 * Math.sin(TAU * 1046.5 * dt)) *
          Math.exp(-dt * 3) *
          (1 - Math.exp(-dt * 85)) *
          0.035;
      }
      const pre = t - (starts[j] - 0.7);
      if (pre >= 0 && pre < 0.9) {
        const shape = Math.sin((pre / 0.9) * Math.PI) ** 2;
        v += Math.sin(TAU * (220 * pre + 430 * pre * pre)) * shape * 0.009;
      }
    }
    samples[n * 2 + ch] = v * env;
  }
}
let peak = 0;
for (const x of samples) peak = Math.max(peak, Math.abs(x));
const gain = Math.min(1.8, 0.72 / peak);
const out = Buffer.alloc(44 + samples.length * 2);
out.write("RIFF");
out.writeUInt32LE(out.length - 8, 4);
out.write("WAVE", 8);
out.write("fmt ", 12);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(sr, 24);
out.writeUInt32LE(sr * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write("data", 36);
out.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++)
  out.writeInt16LE(Math.round(samples[i] * gain * 32767), 44 + i * 2);
await mkdir(new URL("../public/audio/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/audio/score.wav", import.meta.url), out);
console.log(
  `Original score: ${duration}s, stereo ${sr} Hz, peak ${(peak * gain).toFixed(3)}`,
);
