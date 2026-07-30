import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PhysicalCard } from "../game/cards";
import type { PublicPlayerProjection } from "../game/engine";
import {
  HIDDEN_INTELLIGENCE_ART_PATH,
  HiddenIntelligenceArtwork,
} from "./CardArtwork";
import { DiscardPileDialog } from "./DiscardPile";
import { FinalHandsPanel } from "./FinalHandsPanel";

const lockCard = {
  id: "p1-05",
  photo: 1,
  position: 5,
  name: "锁定",
  color: "红",
  transmission: "密电",
  circle: false,
  unburnable: false,
} satisfies PhysicalCard;

describe("shared card artwork", () => {
  it("renders neutral artwork for 未公开情报 without visible text", () => {
    const markup = renderToStaticMarkup(<HiddenIntelligenceArtwork />);

    expect(markup).toContain(HIDDEN_INTELLIGENCE_ART_PATH);
    expect(markup).toContain("hidden-card__art");
    expect(markup).not.toContain("未公开情报");
  });

  it("renders artwork in 弃牌堆", () => {
    const markup = renderToStaticMarkup(
      <DiscardPileDialog cards={[lockCard]} onClose={() => undefined} />,
    );

    expect(markup).toContain("/card-art/lock.png");
    expect(markup).toContain("game-card__art");
  });

  it("renders artwork in 终局手牌公开", () => {
    const players = [{
      id: "甲",
      hand: [lockCard],
    }] as unknown as PublicPlayerProjection[];
    const markup = renderToStaticMarkup(
      <FinalHandsPanel playerDisplayNames={{ 甲: "小甲" }} players={players} />,
    );

    expect(markup).toContain("/card-art/lock.png");
    expect(markup).toContain("final-hand-card game-card game-card--red");
  });
});
