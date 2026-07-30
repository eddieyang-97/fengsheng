import { describe, expect, it } from "vitest";

import type { PhysicalCard } from "../game/cards";
import { cardVariantText } from "./GameCard";

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
