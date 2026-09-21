import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { ease } from "./design";
import { SCENES } from "./timeline";
import { Intro } from "./scenes/Intro";
import { Discussion } from "./scenes/Discussion";
import { Memory } from "./scenes/Memory";
import { Research } from "./scenes/Research";
import { Progress } from "./scenes/Progress";
import { Outro } from "./scenes/Outro";
const views = [Intro, Discussion, Memory, Research, Progress, Outro];
const Dissolve = ({
  children,
  first,
}: {
  children: React.ReactNode;
  first: boolean;
}) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        isolation: "isolate",
        opacity: first ? 1 : ease(f, 0, 14),
      }}
    >
      {children}
    </div>
  );
};
export default function BrainBotDemo() {
  return (
    <AbsoluteFill style={{ background: "#05070b" }}>
      <Audio src={staticFile("audio/score.wav")} />
      {SCENES.map((s, i) => {
        const Scene = views[i];
        return (
          <Sequence
            key={s.id}
            name={s.id}
            from={s.from}
            durationInFrames={s.duration + (i < 5 ? 14 : 0)}
          >
            <Dissolve first={i === 0}>
              <Scene />
            </Dissolve>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
