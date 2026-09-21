import { useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { Title } from "../components/Title";
import { ProductScreen } from "../components/ProductScreen";
import { GlassPanel, Pill } from "../components/GlassPanel";
import { ease } from "../design";
export const Research = () => {
  const f = useCurrentFrame(),
    card = ease(f, 65, 105),
    verified = ease(f, 158, 179),
    shared = ease(f, 218, 239);
  return (
    <Stage index={3}>
      <Title eyebrow="03 / TRACE">每一个结论，都有来处。</Title>
      <ProductScreen
        src="research"
        style={{
          left: 130,
          top: 348,
          width: 1220,
          transform: `perspective(2100px) rotateY(${8 - card * 4}deg) rotateX(4deg)`,
          opacity: 0.9 - card * 0.32,
        }}
      />
      <GlassPanel
        style={{
          left: 1005 + (1 - card) * 70,
          top: 388,
          width: 720,
          opacity: card,
          transform: `perspective(1500px) rotateY(${(1 - card) * -10}deg)`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Pill>文献卡片</Pill>
          <span
            style={{ fontSize: 26, color: verified ? "#b6e3da" : "#b1bed1" }}
          >
            {verified > 0.5 ? "✓ 来源已核验" : "来源待核验"}
          </span>
        </div>
        <div style={{ fontSize: 42, fontWeight: 600, marginTop: 30 }}>
          Mip-Splatting
        </div>
        <div style={{ fontSize: 23, color: "#a0b1c9", marginTop: 10 }}>
          Alias-free 3D Gaussian Splatting
        </div>
        <div style={{ height: 1, background: "#6682a43f", margin: "25px 0" }} />
        <div style={{ fontSize: 29, lineHeight: 1.7 }}>
          3D 平滑滤波与 2D Mip 滤波，
          <br />
          分别对应两条独立的因果链。
        </div>
        <div style={{ marginTop: 18, color: "#839bb9", fontSize: 22 }}>
          arXiv · 2311.16493 · 精读笔记
        </div>
        <div
          style={{
            marginTop: 25,
            borderRadius: 12,
            padding: "16px 22px",
            fontSize: 26,
            background: shared > 0.5 ? "#244260" : "#182438",
            color: "#c5e3ff",
            border: "1px solid #76a5db55",
            opacity: verified,
          }}
        >
          {shared > 0.5 ? "已晋升共享记忆 ✓" : "证据已核验 · 可以共享 ↗"}
        </div>
      </GlassPanel>
      <div
        style={{
          position: "absolute",
          left: 170,
          top: 909,
          display: "flex",
          gap: 26,
          alignItems: "center",
        }}
      >
        {["检索", "精读", "核验", "共享"].map((s, i) => (
          <div
            key={s}
            style={{ display: "flex", gap: 26, alignItems: "center" }}
          >
            <span
              style={{
                fontSize: 29,
                color: f > [0, 65, 158, 218][i] ? "#d5e7ff" : "#566379",
              }}
            >
              {s}
            </span>
            {i < 3 ? (
              <span style={{ color: "#506986", fontSize: 24 }}>→</span>
            ) : null}
          </div>
        ))}
      </div>
    </Stage>
  );
};
