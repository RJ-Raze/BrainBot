import { useCurrentFrame } from "remotion";
// Fibonacci sphere, projected by a rotating camera: deterministic at any frame.
const points = Array.from({ length: 82 }, (_, i) => {
  const y = 1 - (2 * i) / 81;
  const r = Math.sqrt(1 - y * y);
  const a = i * 2.3999632297;
  return { x: Math.cos(a) * r, y, z: Math.sin(a) * r };
});
export const KnowledgeNodes = ({ progress }: { progress: number }) => {
  const f = useCurrentFrame();
  const angle = f * 0.0035;
  const p = points.map((v, i) => {
    const x = v.x * Math.cos(angle) + v.z * Math.sin(angle);
    const z = v.z * Math.cos(angle) - v.x * Math.sin(angle);
    const scale = 1 + z * 0.22;
    const spread = 1 + (1 - progress) * 1.6;
    return {
      x: 500 + x * 305 * scale * spread,
      y: 440 + v.y * 305 * scale * spread,
      z,
      i,
    };
  });
  return (
    <svg
      width="1000"
      height="880"
      viewBox="0 0 1000 880"
      style={{ overflow: "visible" }}
    >
      <defs>
        <radialGradient id="sphere-glow">
          <stop stopColor="#6fa8fa" stopOpacity=".19" />
          <stop offset=".65" stopColor="#578acf" stopOpacity=".06" />
          <stop offset="1" stopColor="#578acf" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ring">
          <stop stopColor="#2e5a91" />
          <stop offset=".45" stopColor="#d9ebff" />
          <stop offset="1" stopColor="#274b7d" />
        </linearGradient>
      </defs>
      <circle cx="500" cy="440" r="390" fill="url(#sphere-glow)" />
      <ellipse
        cx="500"
        cy="440"
        rx="365"
        ry="120"
        fill="none"
        stroke="url(#ring)"
        strokeWidth="1.4"
        opacity=".55"
        transform={`rotate(${-25 + f * 0.018} 500 440)`}
      />
      <ellipse
        cx="500"
        cy="440"
        rx="350"
        ry="140"
        fill="none"
        stroke="#6195d9"
        strokeWidth=".7"
        opacity=".24"
        transform={`rotate(${55 - f * 0.018} 500 440)`}
      />
      {p.flatMap((a, i) =>
        p.slice(i + 1).map((b) => {
          const d = Math.hypot(
            points[i].x - points[b.i].x,
            points[i].y - points[b.i].y,
            points[i].z - points[b.i].z,
          );
          return d < 0.48 ? (
            <line
              key={`${i}-${b.i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#a4ceff"
              strokeWidth={0.55 + (a.z + 1) * 0.35}
              opacity={0.08 + (a.z + 1) * 0.12}
            />
          ) : null;
        }),
      )}
      {[...p]
        .sort((a, b) => a.z - b.z)
        .map((a) => (
          <g key={a.i}>
            <circle
              cx={a.x}
              cy={a.y}
              r={5 + (a.z + 1) * 3}
              fill="#7eb5ff"
              opacity={0.025 + (a.z + 1) * 0.025}
            />
            <circle
              cx={a.x}
              cy={a.y}
              r={1.6 + (a.z + 1) * 1.5}
              fill={a.z > 0.2 ? "#d8edff" : "#659bd7"}
              opacity={0.35 + (a.z + 1) * 0.3}
            />
          </g>
        ))}
    </svg>
  );
};
