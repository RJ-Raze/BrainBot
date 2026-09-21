import { useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { Title } from "../components/Title";
import { ProductScreen } from "../components/ProductScreen";
import { GlassPanel, Pill } from "../components/GlassPanel";
import { ease } from "../design";
export const Discussion = () => {
  const f = useCurrentFrame();
  const enter = ease(f, 0, 45),
    detail = ease(f, 66, 100);
  return (
    <Stage index={1}>
      <Title eyebrow="01 / DISCUSS" duration={270}>
        从一次讨论开始。
      </Title>
      <ProductScreen
        src="discussion"
        style={{
          left: 560,
          top: 335,
          width: 1230,
          opacity: 0.3 + 0.7 * enter,
          transform: `perspective(2100px) rotateY(${-13 + enter * 7}deg) rotateX(5deg) translateY(${(1 - enter) * 80}px)`,
          transformOrigin: "center",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 130,
          top: 333,
          color: "#98a8bf",
          fontSize: 28,
        }}
      >
        一个问题，多种视角。
        <br />
        AI 与团队，共同推敲。
      </div>
      <GlassPanel
        style={{
          left: 145,
          top: 480,
          width: 845,
          opacity: detail,
          transform: `translateY(${(1 - detail) * 50}px)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "#a6caff",
              color: "#142235",
              textAlign: "center",
              lineHeight: "38px",
              fontSize: 24,
            }}
          >
            ✦
          </span>
          <span style={{ fontSize: 23, color: "#b1c7e6" }}>AI 协作伙伴</span>
          <span style={{ marginLeft: "auto", fontSize: 18, color: "#788da8" }}>
            跨尺度走样归因
          </span>
        </div>
        <div style={{ fontSize: 37, fontWeight: 500, lineHeight: 1.6 }}>
          把问题拆成两条
          <br />
          <span style={{ color: "#b8dbff" }}>独立的因果链。</span>
        </div>
        <div style={{ height: 1, background: "#6682a43f", margin: "26px 0" }} />
        <div style={{ display: "flex", gap: 14 }}>
          <Pill>3D 频率约束</Pill>
          <Pill>2D Mip 滤波</Pill>
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 26,
            color: "#a7cfff",
            opacity: ease(f, 145, 165),
          }}
        >
          结论已晋升为共享记忆 ↗
        </div>
      </GlassPanel>
    </Stage>
  );
};
