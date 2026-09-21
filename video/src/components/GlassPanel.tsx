import React from "react";
export const GlassPanel = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      position: "absolute",
      border: "1px solid #6a85ad66",
      borderRadius: 22,
      background:
        "linear-gradient(125deg,rgba(34,48,69,.98),rgba(12,19,31,.98))",
      boxShadow: "0 28px 75px #0008,inset 0 1px 0 #bfd7ff22",
      padding: 36,
      ...style,
    }}
  >
    {children}
  </div>
);
export const Pill = ({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) => (
  <span
    style={{
      fontSize: 22,
      color: active ? "#badeff" : "#b3bfd1",
      padding: "9px 16px",
      borderRadius: 30,
      border: `1px solid ${active ? "#79b7ff66" : "#66768b55"}`,
      background: active ? "#2a528333" : "transparent",
      display: "inline-block",
    }}
  >
    {children}
  </span>
);
