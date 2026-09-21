import { useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { KnowledgeNodes } from "../components/KnowledgeNodes";
import { ease } from "../design";
export const Outro = () => {
  const f = useCurrentFrame();
  return (
    <Stage index={5}>
      <div
        style={{
          position: "absolute",
          left: 460,
          top: -150,
          opacity: 0.52,
          transform: `scale(${0.72 - ease(f, 0, 55) * 0.09})`,
        }}
      >
        <KnowledgeNodes progress={1} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 331,
          left: 0,
          width: "100%",
          textAlign: "center",
          fontSize: 124,
          fontWeight: 600,
          letterSpacing: 16,
          opacity: 0.4 + 0.6 * ease(f, 0, 25),
        }}
      >
        BRAINBOT
      </div>
      <div
        style={{
          position: "absolute",
          top: 573,
          left: 0,
          width: "100%",
          textAlign: "center",
          fontSize: 64,
          lineHeight: 1.6,
          fontWeight: 500,
          opacity: ease(f, 6, 33),
        }}
      >
        让每一次思考，
        <br />
        <span style={{ color: "#bad9ff" }}>成为团队的积累。</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          top: 827,
          textAlign: "center",
          fontSize: 23,
          color: "#8d9cb5",
          letterSpacing: 8,
          opacity: ease(f, 25, 48),
        }}
      >
        讨论 · 记忆 · 证据 · 行动
      </div>
    </Stage>
  );
};
