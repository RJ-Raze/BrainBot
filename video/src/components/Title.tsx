import React from "react";
import { useCurrentFrame } from "remotion";
import { ease } from "../design";
export const Title = ({
  eyebrow,
  children,
  duration = 300,
}: {
  eyebrow?: string;
  children: React.ReactNode;
  duration?: number;
}) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 120,
        top: 138,
        zIndex: 10,
        opacity: ease(f, 14, 38) * (1 - ease(f, duration - 14, duration)),
        transform: `translateY(${(1 - ease(f, 14, 38)) * 22}px)`,
      }}
    >
      <div
        style={{
          fontSize: 20,
          letterSpacing: 5,
          color: "#94bdeb",
          marginBottom: 23,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontSize: 82,
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: -3,
        }}
      >
        {children}
      </div>
    </div>
  );
};
