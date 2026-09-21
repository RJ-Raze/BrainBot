import React from "react";
import { CanvasImage, staticFile } from "remotion";
export const ProductScreen = ({
  src,
  children,
  style,
}: {
  src: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      position: "absolute",
      width: 1280,
      borderRadius: 18,
      padding: 7,
      background:
        "linear-gradient(140deg,#6a778c,#1c2739 22%,#101723 60%,#4e6483)",
      boxShadow: "0 55px 100px #000b, 0 0 65px #5c9bff12",
      ...style,
    }}
  >
    <div
      style={{
        height: 34,
        display: "flex",
        alignItems: "center",
        gap: 7,
        paddingLeft: 14,
        background: "#131923",
        borderRadius: "12px 12px 0 0",
      }}
    >
      {["#6e7787", "#535e70", "#3c4960"].map((c) => (
        <span
          key={c}
          style={{ width: 7, height: 7, borderRadius: 20, background: c }}
        />
      ))}
      <span
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: "#8c9bb3",
          marginLeft: 420,
        }}
      >
        BRAINBOT / WORKSPACE
      </span>
    </div>
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "0 0 11px 11px",
        background: "#090909",
      }}
    >
      <CanvasImage
        src={staticFile(`product/${src}.png`)}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      {children}
    </div>
  </div>
);
