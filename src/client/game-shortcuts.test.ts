import { describe, expect, it } from "vitest";

import {
  gameShortcutIntent,
  nextSelectableCardId,
  shouldHandleGameShortcutFromElement,
  transmissionOptionShortcutIndex,
} from "./game-shortcuts";

describe("game keyboard shortcuts", () => {
  it("maps only the supported fixed bindings", () => {
    expect(gameShortcutIntent("1")).toEqual({ type: "selectCard", index: 0 });
    expect(gameShortcutIntent("9")).toEqual({ type: "selectCard", index: 8 });
    expect(gameShortcutIntent("ArrowLeft")).toEqual({ type: "moveCard", direction: -1 });
    expect(gameShortcutIntent("ArrowRight")).toEqual({ type: "moveCard", direction: 1 });
    expect(gameShortcutIntent("Enter")).toEqual({ type: "confirm" });
    expect(gameShortcutIntent("a")).toEqual({ type: "acceptIntelligence" });
    expect(gameShortcutIntent("A")).toEqual({ type: "acceptIntelligence" });
    expect(gameShortcutIntent("d")).toEqual({ type: "declineIntelligence" });
    expect(gameShortcutIntent("D")).toEqual({ type: "declineIntelligence" });
    expect(gameShortcutIntent("s")).toEqual({ type: "passWindow" });
    expect(gameShortcutIntent("S")).toEqual({ type: "passWindow" });
    expect(gameShortcutIntent("l")).toEqual({ type: "playLock" });
    expect(gameShortcutIntent("L")).toEqual({ type: "playLock" });
    expect(gameShortcutIntent("r")).toEqual({ type: "playSwap" });
    expect(gameShortcutIntent("R")).toEqual({ type: "playSwap" });
    expect(gameShortcutIntent("c")).toEqual({ type: "playCounter" });
    expect(gameShortcutIntent("C")).toEqual({ type: "playCounter" });
    expect(gameShortcutIntent("i")).toEqual({ type: "playIntercept" });
    expect(gameShortcutIntent("I")).toEqual({ type: "playIntercept" });
    expect(gameShortcutIntent("b")).toEqual({ type: "playBurn" });
    expect(gameShortcutIntent("B")).toEqual({ type: "playBurn" });
    expect(gameShortcutIntent("u")).toEqual({ type: "playLure" });
    expect(gameShortcutIntent("U")).toEqual({ type: "playLure" });
    expect(gameShortcutIntent("o")).toEqual({ type: "playSeparation" });
    expect(gameShortcutIntent("O")).toEqual({ type: "playSeparation" });
    expect(gameShortcutIntent("p")).toEqual({ type: "playDecrypt" });
    expect(gameShortcutIntent("P")).toEqual({ type: "playDecrypt" });
    expect(gameShortcutIntent("f")).toEqual({ type: "playReinforcement" });
    expect(gameShortcutIntent("F")).toEqual({ type: "playReinforcement" });
    expect(gameShortcutIntent("g")).toEqual({ type: "playConfidentialFile" });
    expect(gameShortcutIntent("G")).toEqual({ type: "playConfidentialFile" });
    expect(gameShortcutIntent("m")).toEqual({ type: "selectSecretOrder" });
    expect(gameShortcutIntent("M")).toEqual({ type: "selectSecretOrder" });
    expect(gameShortcutIntent("q")).toEqual({
      type: "playSecretOrder",
      word: "听风",
    });
    expect(gameShortcutIntent("w")).toEqual({
      type: "playSecretOrder",
      word: "看雨",
    });
    expect(gameShortcutIntent("e")).toEqual({
      type: "playSecretOrder",
      word: "日落",
    });
    expect(gameShortcutIntent("t")).toEqual({ type: "enterTransmissionPhase" });
    expect(gameShortcutIntent("T")).toEqual({ type: "enterTransmissionPhase" });
    expect(gameShortcutIntent("k")).toEqual({ type: "toggleDiscardPile" });
    expect(gameShortcutIntent("K")).toEqual({ type: "toggleDiscardPile" });
    expect(gameShortcutIntent("n")).toEqual({ type: "togglePrivateNotices" });
    expect(gameShortcutIntent("N")).toEqual({ type: "togglePrivateNotices" });
    expect(gameShortcutIntent("Escape")).toEqual({ type: "cancel" });
    expect(gameShortcutIntent("0")).toBeUndefined();
    expect(gameShortcutIntent("x")).toBeUndefined();
  });

  it("moves through selectable cards only and wraps at both ends", () => {
    const hand = ["a", "b", "c", "d"];
    const selectable = new Set(["a", "c"]);

    expect(nextSelectableCardId(hand, selectable, undefined, 1)).toBe("a");
    expect(nextSelectableCardId(hand, selectable, undefined, -1)).toBe("c");
    expect(nextSelectableCardId(hand, selectable, "a", 1)).toBe("c");
    expect(nextSelectableCardId(hand, selectable, "c", 1)).toBe("a");
    expect(nextSelectableCardId(hand, selectable, "a", -1)).toBe("c");
    expect(nextSelectableCardId(hand, new Set(), "a", 1)).toBeUndefined();
  });

  it("maps up to seven visible transmission choices in QWERTYU order", () => {
    expect(["q", "W", "e", "R", "t", "Y", "u"].map(
      transmissionOptionShortcutIndex,
    )).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(transmissionOptionShortcutIndex("i")).toBeUndefined();
  });

  it("allows card shortcuts after clicking a hand card without hijacking native Enter", () => {
    const focusedCard = {
      tagName: "BUTTON",
      isContentEditable: false,
      classNames: ["game-card"],
    };

    expect(shouldHandleGameShortcutFromElement(
      { type: "playLock" },
      focusedCard,
    )).toBe(true);
    expect(shouldHandleGameShortcutFromElement(
      { type: "playSecretOrder", word: "听风" },
      focusedCard,
    )).toBe(true);
    expect(shouldHandleGameShortcutFromElement(
      { type: "confirm" },
      focusedCard,
    )).toBe(false);
  });

  it("keeps shortcuts disabled for form fields and ordinary controls", () => {
    const playLock = { type: "playLock" } as const;

    expect(shouldHandleGameShortcutFromElement(playLock, {
      tagName: "INPUT",
      isContentEditable: false,
    })).toBe(false);
    expect(shouldHandleGameShortcutFromElement(playLock, {
      tagName: "BUTTON",
      isContentEditable: false,
      classNames: ["prompt-action"],
    })).toBe(false);
    expect(shouldHandleGameShortcutFromElement(playLock, {
      tagName: "DIV",
      isContentEditable: true,
    })).toBe(false);
  });
});
