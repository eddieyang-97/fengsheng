import { describe, expect, it } from "vitest";

import {
  gameShortcutIntent,
  nextSelectableCardId,
} from "./game-shortcuts";

describe("game keyboard shortcuts", () => {
  it("maps only the supported fixed bindings", () => {
    expect(gameShortcutIntent("1")).toEqual({ type: "selectCard", index: 0 });
    expect(gameShortcutIntent("9")).toEqual({ type: "selectCard", index: 8 });
    expect(gameShortcutIntent("ArrowLeft")).toEqual({ type: "moveCard", direction: -1 });
    expect(gameShortcutIntent("ArrowRight")).toEqual({ type: "moveCard", direction: 1 });
    expect(gameShortcutIntent("Enter")).toEqual({ type: "confirm" });
    expect(gameShortcutIntent("Escape")).toEqual({ type: "cancel" });
    expect(gameShortcutIntent("0")).toBeUndefined();
    expect(gameShortcutIntent("s")).toBeUndefined();
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
});
