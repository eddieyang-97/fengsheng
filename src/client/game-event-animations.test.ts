import { describe, expect, it } from "vitest";

import { parseGameEventAnimation } from "./GameEventAnimationLayer";

const players = ["player-1", "player-2", "player-3"];

describe("parseGameEventAnimation", () => {
  it("recognizes a resolved draw without matching ordinary audit text", () => {
    expect(
      parseGameEventAnimation("player-2回合开始并摸2张牌", players),
    ).toEqual({
      kind: "draw",
      actorId: "player-2",
      label: "摸牌",
    });
    expect(
      parseGameEventAnimation("房间以当前座位开始游戏", players),
    ).toBeUndefined();
  });

  it("gives 识破 its dedicated treatment without animating ordinary card plays", () => {
    expect(
      parseGameEventAnimation(
        "player-3使用识破，反制player-1的锁定",
        players,
      ),
    ).toEqual({
      kind: "counter",
      actorId: "player-3",
      label: "识破",
    });
    expect(
      parseGameEventAnimation("player-1使用锁定", players),
    ).toBeUndefined();
    expect(
      parseGameEventAnimation(
        "player-1对player-2使用试探，等待响应",
        players,
      ),
    ).toBeUndefined();
  });

  it("animates 烧毁 only when the target intelligence actually leaves play", () => {
    expect(
      parseGameEventAnimation(
        "player-2的黑色情报「锁定（黑 · 密电）」被烧毁并公开弃置",
        players,
      ),
    ).toEqual({
      kind: "burn",
      targetPlayerId: "player-2",
      label: "烧毁",
    });
    expect(
      parseGameEventAnimation("烧毁被识破，目标情报保持不变", players),
    ).toBeUndefined();
  });

});
