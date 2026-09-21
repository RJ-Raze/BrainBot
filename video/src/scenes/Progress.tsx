import { useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { Title } from "../components/Title";
import { ProductScreen } from "../components/ProductScreen";
import { GlassPanel } from "../components/GlassPanel";
import { ease } from "../design";
export const Progress = () => {
  const f = useCurrentFrame(),
    swap = ease(f, 70, 98);
  return (
    <Stage index={4}>
      <Title eyebrow="04 / MOVE FORWARD" duration={180}>
        让知识，推动下一步。
      </Title>
      <ProductScreen
        src="board"
        style={{
          width: 1270,
          left: 510 - swap * 110,
          top: 330,
          opacity: 1 - swap,
          transform: "perspective(2000px) rotateY(-7deg) rotateX(4deg)",
        }}
      />
      <ProductScreen
        src="document"
        style={{
          width: 1270,
          left: 510 + (1 - swap) * 110,
          top: 330,
          opacity: swap,
          transform: "perspective(2000px) rotateY(-7deg) rotateX(4deg)",
        }}
      />
      <GlassPanel
        style={{ left: 145, top: 454, width: 670, zIndex: 4, padding: 38 }}
      >
        <div style={{ fontSize: 23, color: "#92b7e4", letterSpacing: 3 }}>
          {swap < 0.5 ? "团队进展 / 一眼看全" : "共享记忆 / 自动聚合"}
        </div>
        <div
          style={{
            fontSize: 49,
            lineHeight: 1.35,
            margin: "24px 0 30px",
            fontWeight: 500,
          }}
        >
          {swap < 0.5 ? "从共识，到行动。" : "让文档，生长出来。"}
        </div>
        {(swap < 0.5
          ? ["待开始 → 推进中", "待评审 → 已完成", "任务与负责人，清晰可见"]
          : [
              "决策记录与研究结论",
              "文献证据与实验下一步",
              "同一份记忆，同一份上下文",
            ]
        ).map((s, i) => (
          <div
            key={i}
            style={{
              padding: "16px 0",
              borderTop: "1px solid #7189a530",
              fontSize: 27,
              color: "#bdcbe0",
              display: "flex",
              gap: 20,
            }}
          >
            <span style={{ color: "#75a7dc" }}>0{i + 1}</span>
            {s}
          </div>
        ))}
      </GlassPanel>
    </Stage>
  );
};
