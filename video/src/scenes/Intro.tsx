import { useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { KnowledgeNodes } from "../components/KnowledgeNodes";
import { ease } from "../design";
export const Intro = () => {
  const f = useCurrentFrame();
  return (
    <Stage index={0}>
      <div
        style={{
          position: "absolute",
          left: 460,
          top: -75,
          transform: `scale(${0.9 + ease(f, 0, 150) * 0.1})`,
          opacity: 0.5 + 0.5 * ease(f, 0, 40),
        }}
      >
        <KnowledgeNodes progress={ease(f, 0, 110)} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 383,
          left: 0,
          width: "100%",
          textAlign: "center",
          fontSize: 146,
          fontWeight: 600,
          letterSpacing: 18,
          opacity: ease(f, 12, 52),
          textShadow: "0 5px 45px #000",
        }}
      >
        BRAINBOT
      </div>
      <div
        style={{
          position: "absolute",
          top: 735,
          left: 0,
          width: "100%",
          textAlign: "center",
          fontSize: 66,
          fontWeight: 500,
          letterSpacing: 3,
          opacity: ease(f, 42, 76),
          transform: `translateY(${(1 - ease(f, 42, 76)) * 22}px)`,
        }}
      >
        让思考，产生连接。
      </div>
      <div
        style={{
          position: "absolute",
          top: 843,
          left: 0,
          width: "100%",
          textAlign: "center",
          color: "#8fa1ba",
          fontSize: 24,
          letterSpacing: 8,
          opacity: ease(f, 65, 96),
        }}
      >
        为科研团队而生的知识协作空间
      </div>
    </Stage>
  );
};
