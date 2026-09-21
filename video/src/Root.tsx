import "./index.css";
import { Composition } from "remotion";
import BrainBotDemo from "./BrainBotDemo";
import { VIDEO } from "./design";
export const RemotionRoot = () => (
  <Composition id="BrainBotDemo" component={BrainBotDemo} {...VIDEO} />
);
