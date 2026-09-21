import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONT } from "../design";
export const Stage = ({
  children,
  index = 0,
}: {
  children: React.ReactNode;
  index?: number;
}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at ${60 + Math.sin(f / 200) * 8}% 58%, #132238 0%, #090e18 34%, #05070b 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 240,
          top: 810,
          width: 1460,
          height: 300,
          background:
            "radial-gradient(ellipse,rgba(85,143,215,.19),transparent 65%)",
          transform: "rotateX(65deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 52,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: 4,
          color: "#c6d1e3",
        }}
      >
        BRAINBOT
        <span
          style={{
            fontWeight: 400,
            letterSpacing: 2,
            color: "#67748a",
            marginLeft: 26,
            fontSize: 15,
          }}
        >
          PRODUCT FILM / 2026
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          right: 100,
          top: 52,
          fontFamily: "Consolas,monospace",
          fontSize: 16,
          color: "#8190a7",
          letterSpacing: 2,
        }}
      >
        KNOWLEDGE, IN MOTION.
      </div>
      {children}
      <div
        style={{
          position: "absolute",
          left: 100,
          bottom: 42,
          display: "flex",
          gap: 10,
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              width: i === index ? 44 : 15,
              height: 3,
              background: i === index ? "#c2ddff" : "#344055",
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          right: 100,
          bottom: 34,
          fontSize: 15,
          letterSpacing: 2,
          color: "#718098",
        }}
      >
        BRAINBOT · 科研协作智能平台
      </div>
    </AbsoluteFill>
  );
};
