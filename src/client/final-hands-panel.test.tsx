import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PHYSICAL_DECK } from "../game/cards";
import { FinalHandsPanel } from "./FinalHandsPanel";

describe("终局手牌公开", () => {
  it("按玩家显示剩余手牌，并明确显示空手牌", () => {
    const card = PHYSICAL_DECK[0];
    const markup = renderToStaticMarkup(
      <FinalHandsPanel
        playerDisplayNames={{ 甲: "Eddie", 乙: "e2" }}
        players={[
          { id: "甲", alive: true, handCount: 1, hand: [card], intelligence: [] },
          { id: "乙", alive: false, handCount: 0, hand: [], intelligence: [] },
        ]}
      />,
    );

    expect(markup).toContain("终局手牌公开");
    expect(markup).toContain("Eddie");
    expect(markup).toContain(card.name);
    expect(markup).toContain("e2");
    expect(markup).toContain("无剩余手牌");
  });
});
