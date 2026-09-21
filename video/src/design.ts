import { Easing, interpolate } from "remotion";
export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 1350,
};
export const COLORS = {
  bg: "#05070b",
  text: "#f4f6fc",
  muted: "#99a5b9",
  blue: "#96c8ff",
  line: "rgba(175,199,237,.2)",
};
export const FONT = '"Segoe UI", "Microsoft YaHei", "Noto Sans SC", sans-serif';
export const ease = (f: number, a = 0, b = 30) =>
  interpolate(f, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
