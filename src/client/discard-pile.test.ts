import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PhysicalCard } from "../game/cards";
import { DiscardPileButton, DiscardPileDialog } from "./DiscardPile";
import { cardVariantText } from "./GameCard";

describe("discard pile counts", () => {
  it("makes public, hidden, and removed card totals explicit", () => {
    const button = renderToStaticMarkup(
      createElement(DiscardPileButton, {
        cards: [],
        hiddenCardCount: 2,
        onOpen: () => undefined,
        removedProbeCount: 1,
      }),
    );
    expect(button).toContain("弃牌堆 2（暗 2）· 查看");
    expect(button).toContain("另有1张试探已移出游戏");

    const dialog = renderToStaticMarkup(
      createElement(DiscardPileDialog, {
        cards: [],
        hiddenCardCount: 2,
        onClose: () => undefined,
        removedProbeCount: 1,
      }),
    );
    expect(dialog).toContain("弃牌堆 · 2 张");
    expect(dialog).toContain("公开牌 <b>0</b> 张");
    expect(dialog).toContain("暗置秘密下达 <b>2</b> 张（可洗回）");
    expect(dialog).toContain("试探 <b>1</b> 张（已移出游戏）");
    expect(dialog).toContain("暂无可公开查看的弃牌");
  });
});

describe("discard pile card variants", () => {
  it("keeps each mapping on its own line", () => {
    expect(cardVariantText({
      id: "secret-order",
      name: "秘密下达",
      color: "黑",
      transmission: "直达",
      circle: false,
      unburnable: false,
      variant: {
        kind: "secretOrder",
        mapping: { 听风: "蓝", 看雨: "黑", 日落: "红" },
      },
    } as PhysicalCard)).toBe("听风→蓝\n看雨→黑\n日落→红");

    expect(cardVariantText({
      id: "probe",
      name: "试探",
      color: "黑",
      transmission: "直达",
      circle: false,
      unburnable: false,
      variant: {
        kind: "probeIdentity",
        mapping: { 军情: "间谍", 潜伏: "卧底", 特工: "好人" },
      },
    } as PhysicalCard)).toBe("军情→间谍\n潜伏→卧底\n特工→好人");
  });
});
