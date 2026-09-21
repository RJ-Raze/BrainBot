import { useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { Title } from "../components/Title";
import { ProductScreen } from "../components/ProductScreen";
import { GlassPanel, Pill } from "../components/GlassPanel";
import { ease } from "../design";
export const Memory = () => {
  const f = useCurrentFrame(),
    e = ease(f, 0, 45);
  return (
    <Stage index={2}>
      <Title eyebrow="02 / REMEMBER">
        不止记录。<span style={{ color: "#a3ccff" }}>形成记忆。</span>
      </Title>
      <ProductScreen
        src="memory"
        style={{
          width: 1090,
          left: 715,
          top: 410,
          opacity: 0.42,
          transform: "perspective(1900px) rotateY(-12deg) rotateX(5deg)",
        }}
      />
      <GlassPanel
        style={{
          left: 145 + e * 45,
          top: 455 - e * 65,
          width: 790,
          transform: `perspective(1600px) rotateY(${-4 * e}deg)`,
          zIndex: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Pill active>共享记忆</Pill>
          <span style={{ fontSize: 26, color: "#a7b6c9" }}>结论 · 已晋升</span>
        </div>
        <div
          style={{
            fontSize: 41,
            lineHeight: 1.5,
            marginTop: 27,
            fontWeight: 500,
          }}
        >
          两条因果链。
          <br />
          成为全队的共同上下文。
        </div>
        <div
          style={{
            fontSize: 25,
            color: "#a0afc6",
            lineHeight: 1.6,
            marginTop: 22,
          }}
        >
          跨尺度走样归因 · 首轮共识
          <br />
          3D 频率约束 / 2D Mip 滤波
        </div>
        <div style={{ marginTop: 24, fontSize: 23, color: "#b7d8ff" }}>
          下一轮对话，接着已有的思考。
        </div>
      </GlassPanel>
      {[
        { label: "01 / 来源角色", value: "表示建模 · 云天明", x: 1050, y: 368 },
        { label: "02 / 源会话", value: "跨尺度走样归因", x: 1100, y: 548 },
        {
          label: "03 / 原始消息",
          value: "AI 回复与讨论上下文",
          x: 1050,
          y: 728,
        },
      ].map((item, i) => {
        const a = ease(f, 55 + i * 27, 90 + i * 27);
        return (
          <GlassPanel
            key={item.label}
            style={{
              left: item.x + (1 - a) * 75,
              top: item.y,
              width: 610,
              padding: "24px 30px",
              opacity: a,
              zIndex: 4,
              transform: `perspective(1800px) rotateY(${-8 * (1 - a)}deg)`,
            }}
          >
            <div
              style={{
                fontFamily: "Consolas, Microsoft YaHei",
                fontSize: 26,
                letterSpacing: 2,
                color: "#7f9ec5",
                marginBottom: 12,
              }}
            >
              {item.label}
            </div>
            <div style={{ fontSize: 31 }}>{item.value}</div>
          </GlassPanel>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 205,
          top: 894,
          fontSize: 25,
          color: "#9daec6",
          opacity: ease(f, 155, 185),
        }}
      >
        每一条记忆，都能回到它的起点。
      </div>
    </Stage>
  );
};
