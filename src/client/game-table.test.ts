import { describe, expect, it } from "vitest";

import type { PhysicalCard } from "../game/cards";
import type { PlayerProjection } from "../game/engine";
import {
  actionDetail,
  auditEntryInvolvesPlayer,
  automaticPassDelayMs,
  automaticPassCommand,
  cardVariantText,
  compactCardMeta,
  dedicatedActionShortcut,
  cardArtPath,
  factionBackgroundClass,
  formatAuditEntries,
  horizontalOverflowIndicators,
  inspectedHandForProjection,
  isSecondaryPromptAction,
  keyboardConfirmAction,
  keyboardDiscardAction,
  keyboardCardShortcutAction,
  keyboardSeparationShortcutAction,
  keyboardSecretOrderAction,
  keyboardSecretOrderCardId,
  privateNoticeVariantText,
  promptDescription,
  probeIdentityNoticeText,
  isNearScrollBottom,
  mergeAuditLogs,
  privateNoticeText,
  promptActions,
  promptTitle,
  publicCardSummary,
  publicTextReceiptEffect,
  reactionWindowLabel,
  requiresLockCardSelection,
  receiptStageLabel,
  responseActionText,
  responseFocusActionText,
  responseFocusContextText,
  seatOrderAnchoredAtPlayer,
  shouldShowIdleFocusPanel,
  soleSelectableTransmissionCardId,
  transmissionDirectionForSelection,
  transmissionPromptDescription,
  updateIdentityMarkers,
} from "./GameTable";

describe("table focus visibility", () => {
  it("gives the transmitted card the center stage outside reaction windows", () => {
    expect(shouldShowIdleFocusPanel({
      reactionWindow: undefined,
      transmission: {} as PlayerProjection["transmission"],
    })).toBe(false);
    expect(shouldShowIdleFocusPanel({
      reactionWindow: undefined,
      transmission: undefined,
    })).toBe(true);
  });
});

describe("card artwork", () => {
  it("maps physical card names to stable project assets", () => {
    expect(cardArtPath("公开文本")).toBe("/card-art/public-text.png");
    expect(cardArtPath("烧毁")).toBe("/card-art/burn.png");
    expect(cardArtPath("秘密下达")).toBe("/card-art/secret-order.png");
  });
});

describe("compact card metadata", () => {
  it("keeps ordinary metadata on one line without spacing", () => {
    expect(compactCardMeta({
      color: "红蓝",
      transmission: "直达",
      unburnable: false,
    })).toBe("红蓝·直达");
  });

  it("abbreviates transmission only when sharing space with the unburnable marker", () => {
    expect(compactCardMeta({
      color: "黑",
      transmission: "文本",
      unburnable: true,
    })).toBe("黑·文");
  });
});

const identityProbe = {
  id: "p1-02",
  photo: 1,
  position: 1,
  name: "试探",
  color: "黑",
  transmission: "直达",
  circle: false,
  unburnable: false,
  variant: {
    kind: "probeIdentity",
    mapping: { 军情: "间谍", 潜伏: "卧底", 特工: "好人" },
  },
} satisfies PhysicalCard;

const secretOrder = {
  id: "p1-12",
  photo: 1,
  position: 2,
  name: "秘密下达",
  color: "红",
  transmission: "密电",
  circle: false,
  unburnable: false,
  variant: {
    kind: "secretOrder",
    mapping: { 听风: "红", 看雨: "蓝", 日落: "黑" },
  },
} satisfies PhysicalCard;

const redPublicText = {
  id: "public-red",
  photo: 1,
  position: 3,
  name: "公开文本",
  color: "红",
  transmission: "文本",
  circle: false,
  unburnable: false,
  variant: { kind: "publicTextColor" },
} satisfies PhysicalCard;

const blackPublicText = {
  ...redPublicText,
  id: "public-black",
  color: "黑",
  variant: { kind: "publicTextBlack", mandatoryDrawFaction: "特工" },
} satisfies PhysicalCard;

const projection = {
  own: { id: "甲", faction: "军情", hand: [identityProbe, secretOrder] },
  players: [{ id: "乙" }],
} as PlayerProjection;

describe("game table card parameters", () => {
  it("shows the printed 试探 and 秘密下达 variants", () => {
    expect(cardVariantText(identityProbe)).toBe("军情→间谍\n潜伏→卧底\n特工→好人");
    expect(probeIdentityNoticeText(identityProbe)).toBe(
      "间谍→军情\n卧底→潜伏\n好人→特工",
    );
    expect(privateNoticeVariantText(identityProbe, true)).toBe(
      "间谍→军情\n卧底→潜伏\n好人→特工",
    );
    expect(cardVariantText(secretOrder)).toBe("听风→红\n看雨→蓝\n日落→黑");
    expect(privateNoticeVariantText(secretOrder)).toBe(
      "听风→红\n看雨→蓝\n日落→黑",
    );
  });

  it("keeps the transmission method in accepted intelligence summaries", () => {
    expect(publicCardSummary(redPublicText)).toBe("公开文本 · 红 · 文本");
  });

  it("keeps 公开文本 receipt rules outside the card face", () => {
    expect(cardVariantText(blackPublicText)).toBeUndefined();
  });

  it("distinguishes the selected action parameters", () => {
    expect(actionDetail(
      { type: "PLAY_PROBE", cardId: "p1-02", targetId: "乙" },
      projection,
      { 乙: "小乙" },
    )).toBe("试探（身份代码） → 小乙");
    expect(actionDetail(
      { type: "PLAY_SECRET_ORDER", cardId: "p1-12", word: "看雨" },
      projection,
      {},
    )).toBe("秘密下达：蓝");
    expect(actionDetail(
      { type: "CHOOSE_PROBE_IDENTITY", choice: "announce" },
      projection,
      {},
    )).toBe("公开身份代码");
    expect(actionDetail(
      { type: "CHOOSE_PROBE_IDENTITY", choice: "giveRandom" },
      projection,
      {},
    )).toBe("随机交出一张手牌");
    expect(actionDetail(
      { type: "PLAY_SEPARATION", cardId: "p1-11", targetId: "乙" },
      projection,
      { 乙: "小乙" },
    )).toBe("离间 → 小乙");
    expect(actionDetail(
      { type: "PLAY_FUNCTION_SEPARATION", cardId: "p1-11", targetId: "乙" },
      projection,
      { 乙: "小乙" },
    )).toBe("离间 → 小乙");
  });

  it("describes every public-text receipt variant", () => {
    expect(publicTextReceiptEffect(redPublicText)).toBe(
      "潜伏必须弃 1 张；军情／特工选择摸 1 张或弃 1 张",
    );
    expect(publicTextReceiptEffect(blackPublicText)).toBe(
      "特工必须摸 1 张；其他阵营选择摸 1 张或摸 2 张",
    );
    expect(publicTextReceiptEffect(identityProbe)).toBeUndefined();
  });
});

describe("own faction background", () => {
  it("uses a distinct background class for every faction", () => {
    expect(factionBackgroundClass("军情")).toBe("game-shell--faction-intelligence");
    expect(factionBackgroundClass("潜伏")).toBe("game-shell--faction-undercover");
    expect(factionBackgroundClass("特工")).toBe("game-shell--faction-agent");
  });
});

describe("private identity markers", () => {
  it("adds, changes, and clears an opponent's inferred faction without mutating prior notes", () => {
    const initial = { 乙: "军情" as const };
    const changed = updateIdentityMarkers(initial, "乙", "潜伏");
    const cleared = updateIdentityMarkers(changed, "乙", "");

    expect(initial).toEqual({ 乙: "军情" });
    expect(changed).toEqual({ 乙: "潜伏" });
    expect(cleared).toEqual({});
  });
});

describe("私人通知文案", () => {
  it("说明秘密下达和危险情报的手牌查看结果", () => {
    expect(privateNoticeText({
      kind: "secretOrderHandInspected",
      otherPlayerId: "乙",
      cards: [identityProbe],
    }, { 乙: "小乙" })).toBe("你通过秘密下达查看了【小乙】的手牌：");
    expect(privateNoticeText({
      kind: "dangerousHandInspected",
      otherPlayerId: "丙",
      cards: [secretOrder],
    }, {})).toBe("你通过危险情报查看了【丙】的手牌：");
  });
});

describe("automatic reaction passing", () => {
  it("passes only when PASS_REACTION or PASS_LOCK is the sole legal action", () => {
    expect(automaticPassCommand([{ type: "PASS_REACTION" }])).toEqual({
      type: "PASS_REACTION",
    });
    expect(automaticPassCommand([{ type: "PASS_LOCK" }])).toEqual({
      type: "PASS_LOCK",
    });
    expect(automaticPassCommand([])).toBeUndefined();
    expect(automaticPassCommand([
      { type: "PASS_REACTION" },
      { type: "PLAY_COUNTER", cardId: "p1-03", targetInteractionId: "interaction-1" },
    ])).toBeUndefined();
    expect(automaticPassCommand([
      { type: "PASS_LOCK" },
      { type: "PLAY_LOCK", cardId: "p1-03" },
    ])).toBeUndefined();
  });

  it("can ignore burn actions without ignoring other available reactions", () => {
    const burnAction = {
      type: "PLAY_BURN" as const,
      cardId: "p1-04" as const,
      targetPlayerId: "乙",
      targetIntelligenceCardId: "p1-05" as const,
    };
    expect(automaticPassCommand([
      { type: "PASS_REACTION" },
      burnAction,
    ])).toBeUndefined();
    expect(automaticPassCommand([
      { type: "PASS_REACTION" },
      burnAction,
    ], true)).toEqual({ type: "PASS_REACTION" });
    expect(automaticPassCommand([
      { type: "PASS_REACTION" },
      burnAction,
      { type: "PLAY_COUNTER", cardId: "p1-03", targetInteractionId: "interaction-1" },
    ], true)).toBeUndefined();
  });

  it("immediately passes only when the player's hand is literally empty", () => {
    expect(automaticPassDelayMs({ type: "PASS_REACTION" }, 0)).toBe(0);
    expect(automaticPassDelayMs({ type: "PASS_REACTION" }, 1)).toBe(1_000);
    expect(automaticPassDelayMs({ type: "PASS_REACTION" }, 1, 500)).toBe(500);
    expect(automaticPassDelayMs({ type: "PASS_REACTION" }, 1, 3_000)).toBe(3_000);
    expect(automaticPassDelayMs({ type: "PASS_LOCK" })).toBe(0);
  });
});

describe("keyboard action confirmation", () => {
  it("confirms only one unambiguous non-discard primary action", () => {
    expect(keyboardConfirmAction([
      { type: "ACCEPT_INTELLIGENCE" },
    ])).toBeUndefined();
    expect(keyboardConfirmAction([
      { type: "PLAY_LOCK", cardId: "p1-05" },
    ])).toEqual({ type: "PLAY_LOCK", cardId: "p1-05" });
    expect(keyboardConfirmAction([
      { type: "ACCEPT_INTELLIGENCE" },
      { type: "PLAY_DECRYPT", cardId: "p1-03" },
    ])).toBeUndefined();
    expect(keyboardConfirmAction([
      { type: "DISCARD_FOR_HAND_LIMIT", cardId: "p1-03" },
    ])).toBeUndefined();
    expect(keyboardConfirmAction([
      { type: "CHOOSE_PUBLIC_TEXT_DISCARD", cardId: "p1-03" },
    ])).toBeUndefined();
    expect(keyboardConfirmAction([
      { type: "ENTER_TRANSMISSION_PHASE" },
    ])).toBeUndefined();
  });
});

describe("dedicated action shortcut labels", () => {
  it("prefers the dedicated card key over the generic Enter badge", () => {
    expect(dedicatedActionShortcut({
      type: "PLAY_LOCK",
      cardId: "p1-05",
    })).toBe("L");
    expect(dedicatedActionShortcut({
      type: "PLAY_REINFORCEMENT",
      cardId: "p1-06",
    })).toBe("F");
    expect(dedicatedActionShortcut({
      type: "PLAY_CONFIDENTIAL_FILE",
      cardId: "p4-14",
    })).toBe("G");
    expect(dedicatedActionShortcut({
      type: "PLAY_SECRET_ORDER",
      cardId: "p1-07",
      word: "听风",
    })).toBe("Q");
    expect(dedicatedActionShortcut({
      type: "DISCARD_FOR_HAND_LIMIT",
      cardId: "p1-03",
    })).toBe("D");
    expect(dedicatedActionShortcut({
      type: "CHOOSE_PUBLIC_TEXT_EFFECT",
      choice: "drawOne",
    })).toBeUndefined();
  });
});

describe("discard keyboard confirmation", () => {
  const discardActions = [
    { type: "DISCARD_FOR_HAND_LIMIT", cardId: "p1-01" },
    { type: "DISCARD_FOR_HAND_LIMIT", cardId: "p1-02" },
  ] as const;

  it("uses D only for the currently selected discard card", () => {
    expect(keyboardDiscardAction(discardActions, "p1-02")).toEqual(
      discardActions[1],
    );
    expect(keyboardDiscardAction(discardActions)).toBeUndefined();
    expect(keyboardDiscardAction(discardActions, "missing")).toBeUndefined();
  });
});

describe("keyboard card action shortcuts", () => {
  const lock = { type: "PLAY_LOCK" as const, cardId: "p1-02" as const };
  const firstSwap = { type: "PLAY_SWAP" as const, cardId: "p1-03" as const };
  const secondSwap = { type: "PLAY_SWAP" as const, cardId: "p1-04" as const };
  const counter = {
    type: "PLAY_COUNTER" as const,
    cardId: "p1-05" as const,
    targetInteractionId: "interaction-1",
  };
  const intercept = { type: "PLAY_INTERCEPT" as const, cardId: "p1-06" as const };
  const lure = { type: "PLAY_LURE" as const, cardId: "p1-10" as const };
  const decrypt = { type: "PLAY_DECRYPT" as const, cardId: "p2-01" as const };
  const reinforcement = {
    type: "PLAY_REINFORCEMENT" as const,
    cardId: "p2-02" as const,
  };
  const burnFirstTarget = {
    type: "PLAY_BURN" as const,
    cardId: "p1-07" as const,
    targetPlayerId: "乙",
    targetIntelligenceCardId: "p1-08" as const,
  };
  const burnSecondTarget = {
    ...burnFirstTarget,
    targetPlayerId: "丙",
    targetIntelligenceCardId: "p1-09" as const,
  };
  const separationFirstTarget = {
    type: "PLAY_SEPARATION" as const,
    cardId: "p1-11" as const,
    targetId: "乙",
  };
  const separationSecondTarget = {
    ...separationFirstTarget,
    targetId: "丙",
  };
  const functionSeparation = {
    type: "PLAY_FUNCTION_SEPARATION" as const,
    cardId: "p1-12" as const,
    targetId: "丁",
  };

  it("uses a sole legal card or an explicitly selected copy", () => {
    expect(keyboardCardShortcutAction([lock], "PLAY_LOCK")).toEqual(lock);
    expect(keyboardCardShortcutAction([firstSwap], "PLAY_SWAP")).toEqual(firstSwap);
    expect(
      keyboardCardShortcutAction([firstSwap, secondSwap], "PLAY_SWAP"),
    ).toBeUndefined();
    expect(
      keyboardCardShortcutAction(
        [firstSwap, secondSwap],
        "PLAY_SWAP",
        secondSwap.cardId,
      ),
    ).toEqual(secondSwap);
    expect(
      keyboardCardShortcutAction([counter], "PLAY_COUNTER"),
    ).toEqual(counter);
    expect(
      keyboardCardShortcutAction([counter], "PLAY_COUNTER", firstSwap.cardId),
    ).toEqual(counter);
    expect(
      keyboardCardShortcutAction([intercept], "PLAY_INTERCEPT"),
    ).toEqual(intercept);
    expect(keyboardCardShortcutAction([lure], "PLAY_LURE")).toEqual(lure);
    expect(keyboardCardShortcutAction([decrypt], "PLAY_DECRYPT")).toEqual(decrypt);
    expect(
      keyboardCardShortcutAction([reinforcement], "PLAY_REINFORCEMENT"),
    ).toEqual(reinforcement);
    expect(
      keyboardCardShortcutAction([burnFirstTarget], "PLAY_BURN"),
    ).toEqual(burnFirstTarget);
    expect(
      keyboardCardShortcutAction(
        [burnFirstTarget, burnSecondTarget],
        "PLAY_BURN",
        burnFirstTarget.cardId,
      ),
    ).toBeUndefined();
  });

  it("handles both 离间 command types without choosing among targets", () => {
    expect(
      keyboardSeparationShortcutAction([functionSeparation]),
    ).toEqual(functionSeparation);
    expect(
      keyboardSeparationShortcutAction(
        [separationFirstTarget, separationSecondTarget],
        separationFirstTarget.cardId,
      ),
    ).toBeUndefined();
  });
});

describe("秘密下达 keyboard shortcuts", () => {
  const firstCardActions = (["听风", "看雨", "日落"] as const).map((word) => ({
    type: "PLAY_SECRET_ORDER" as const,
    cardId: "p1-08" as const,
    word,
  }));
  const secondCardAction = {
    type: "PLAY_SECRET_ORDER" as const,
    cardId: "p1-09" as const,
    word: "听风" as const,
  };

  it("selects an unambiguous card and maps Q/W/E to declarations", () => {
    expect(keyboardSecretOrderCardId(firstCardActions)).toBe("p1-08");
    expect(
      keyboardSecretOrderAction(firstCardActions, undefined, "看雨"),
    ).toEqual(firstCardActions[1]);
    expect(
      keyboardSecretOrderCardId(
        [...firstCardActions, secondCardAction],
      ),
    ).toBeUndefined();
    expect(
      keyboardSecretOrderAction(
        [...firstCardActions, secondCardAction],
        "p1-09",
        "听风",
      ),
    ).toEqual(secondCardAction);
  });
});

describe("锁定 prompt actions", () => {
  const redLock = {
    id: "p1-05",
    photo: 1,
    position: 20,
    name: "锁定",
    color: "红",
    transmission: "密电",
    circle: false,
    unburnable: false,
  } satisfies PhysicalCard;
  const blueLock = {
    ...redLock,
    id: "p1-06",
    color: "蓝",
    transmission: "文本",
  } satisfies PhysicalCard;
  const matchingRedLock = {
    ...redLock,
    id: "p2-03",
    photo: 2,
    position: 3,
  } satisfies PhysicalCard;

  it("directly shows a single 锁定 while other card responses still require selection", () => {
    const actions = [
      { type: "PASS_LOCK" as const },
      { type: "PLAY_LOCK" as const, cardId: redLock.id as "p1-05" },
      {
        type: "PLAY_COUNTER" as const,
        cardId: "p1-03" as const,
        targetInteractionId: "interaction-1",
      },
    ];

    expect(promptActions(actions)).toEqual([
      { type: "PASS_LOCK" },
      { type: "PLAY_LOCK", cardId: redLock.id },
    ]);
    expect(promptActions(actions, "p1-03")).toEqual(actions);
  });

  it("requires choosing between visibly different 锁定 cards before confirmation", () => {
    const actions = [
      { type: "PASS_LOCK" as const },
      { type: "PLAY_LOCK" as const, cardId: redLock.id as "p1-05" },
      { type: "PLAY_LOCK" as const, cardId: blueLock.id as "p1-06" },
    ];
    const hand = [redLock, blueLock];

    expect(requiresLockCardSelection(actions, hand)).toBe(true);
    expect(promptActions(actions, undefined, hand)).toEqual([
      { type: "PASS_LOCK" },
    ]);
    expect(promptActions(actions, blueLock.id, hand)).toEqual([
      { type: "PASS_LOCK" },
      { type: "PLAY_LOCK", cardId: blueLock.id },
    ]);

    const lockProjection = {
      legalActions: actions,
      own: { id: "甲", faction: "军情", hand },
      players: [],
    } as unknown as PlayerProjection;
    expect(promptDescription(lockProjection)).toBe(
      "请选择一张高亮的锁定牌，或跳过反应。",
    );
    expect(promptDescription(lockProjection, blueLock.id)).toBe(
      "已选择锁定牌；确认使用，或改选另一张高亮牌。",
    );
    expect(actionDetail(actions[2], lockProjection, {})).toBe(
      "使用锁定（蓝 · 文本）",
    );
  });

  it("treats visually identical 锁定 copies as one direct choice", () => {
    const actions = [
      { type: "PASS_LOCK" as const },
      { type: "PLAY_LOCK" as const, cardId: redLock.id as "p1-05" },
      { type: "PLAY_LOCK" as const, cardId: matchingRedLock.id as "p2-03" },
    ];
    const hand = [redLock, matchingRedLock];

    expect(requiresLockCardSelection(actions, hand)).toBe(false);
    expect(promptActions(actions, undefined, hand)).toEqual([
      { type: "PASS_LOCK" },
      { type: "PLAY_LOCK", cardId: redLock.id },
    ]);
    expect(promptActions(actions, matchingRedLock.id, hand)).toEqual([
      { type: "PASS_LOCK" },
      { type: "PLAY_LOCK", cardId: matchingRedLock.id },
    ]);
  });

  it("keeps server-generated transmission commands inside the dedicated composer", () => {
    expect(promptActions([
      {
        type: "START_TRANSMISSION",
        cardId: "p1-03",
        method: "直达",
        targetId: "乙",
      },
      {
        type: "START_TRANSMISSION",
        cardId: "p1-03",
        method: "密电",
      },
    ], "p1-03")).toEqual([]);
  });
});

describe("界面状态文案", () => {
  it("完整翻译响应窗口类型", () => {
    expect([
      "intelligence",
      "transfer",
      "lock",
      "swap",
      "lure",
      "decrypt",
      "burn",
      "function",
      "secretOrder",
    ].map((kind) => reactionWindowLabel(kind as Parameters<typeof reactionWindowLabel>[0])))
      .toEqual([
        "情报传递",
        "转移",
        "锁定",
        "掉包",
        "调虎离山",
        "破译",
        "烧毁",
        "功能牌",
        "秘密下达",
      ]);
  });

  it("完整翻译情报接收阶段", () => {
    expect(receiptStageLabel("lockOffer")).toBe("等待是否锁定");
    expect(receiptStageLabel("reactions")).toBe("等待情报响应");
    expect(receiptStageLabel("decision")).toBe("等待接收决定");
  });
});

describe("match log auto-follow", () => {
  it("follows new entries only while the reader remains near the bottom", () => {
    expect(isNearScrollBottom(468, 500, 1_000)).toBe(true);
    expect(isNearScrollBottom(400, 500, 1_000)).toBe(false);
  });
});

describe("hand overflow indicators", () => {
  it("shows edge fades only where more cards can be scrolled into view", () => {
    expect(horizontalOverflowIndicators(0, 500, 500)).toEqual({
      left: false,
      right: false,
    });
    expect(horizontalOverflowIndicators(0, 500, 720)).toEqual({
      left: false,
      right: true,
    });
    expect(horizontalOverflowIndicators(80, 500, 720)).toEqual({
      left: true,
      right: true,
    });
    expect(horizontalOverflowIndicators(220, 500, 720)).toEqual({
      left: true,
      right: false,
    });
  });
});

describe("current response wording", () => {
  it("describes intelligence as being transmitted rather than used", () => {
    expect(responseActionText({
      id: "intelligence-1",
      kind: "intelligence",
      sourcePlayerId: "甲",
      targetPlayerId: "乙",
    }, { 甲: "小甲" }, "文本")).toBe("【小甲】正在以文本传递情报");
  });

  it("continues to describe function cards as used", () => {
    expect(responseActionText({
      id: "card-1",
      kind: "card",
      sourcePlayerId: "甲",
      targetPlayerId: "乙",
      cardName: "危险情报",
    }, { 甲: "小甲" })).toBe("【小甲】使用 危险情报");
  });

  it("shows an intelligence route once in the unified focus panel", () => {
    const item = {
      id: "intelligence-1",
      kind: "intelligence" as const,
      sourcePlayerId: "甲",
      targetPlayerId: "乙",
    };
    const transmission = {
      senderId: "甲",
      intendedRecipientId: "乙",
      method: "文本",
    } as NonNullable<PlayerProjection["transmission"]>;

    expect(responseFocusContextText(item, { 甲: "小甲", 乙: "小乙" }, transmission, "甲"))
      .toBe("情报传递 · 文本");
    expect(responseFocusActionText(item, { 甲: "小甲", 乙: "小乙" }, transmission))
      .toBe("小甲 → 小乙");
  });

  it("keeps interrupted card actions distinct from their intelligence route", () => {
    const item = {
      id: "card-1",
      kind: "card" as const,
      sourcePlayerId: "丙",
      targetPlayerId: "乙",
      cardName: "掉包" as const,
    };
    const transmission = {
      senderId: "甲",
      intendedRecipientId: "乙",
      method: "密电",
    } as NonNullable<PlayerProjection["transmission"]>;

    expect(responseFocusContextText(
      item,
      { 甲: "小甲", 乙: "小乙", 丙: "小丙" },
      transmission,
      "甲",
    )).toBe("情报路线 · 小甲 → 小乙 · 密电");
    expect(responseFocusActionText(item, { 丙: "小丙" }, transmission))
      .toBe("【小丙】使用 掉包");
  });
});

describe("transmission prompt", () => {
  it("asks the active player to select intelligence after secret-order polling", () => {
    expect(promptTitle({
      ...projection,
      phase: "preTransmission",
      activePlayerId: "甲",
      pendingSecretOrder: {
        stage: "selection",
        targetPlayerId: "甲",
        verifiedNoMatch: false,
      },
      legalActions: [],
    })).toBe("请选择要传递的情报");
  });

  it("shows the resolved secret-order color to its target", () => {
    expect(promptTitle({
      ...projection,
      phase: "preTransmission",
      activePlayerId: "甲",
      pendingSecretOrder: {
        stage: "selection",
        targetPlayerId: "甲",
        sourcePlayerId: "乙",
        word: "日落",
        requiredColor: "黑",
        verifiedNoMatch: false,
      },
      legalActions: [],
    })).toBe("秘密下达要求：请选择黑色情报");
  });

  it("identifies a sole eligible card for automatic selection", () => {
    const hand = [{ id: "red" }, { id: "blue" }];

    expect(soleSelectableTransmissionCardId(
      hand,
      new Set(["blue"]),
    )).toBe("blue");
    expect(soleSelectableTransmissionCardId(
      hand,
      new Set(["red", "blue"]),
    )).toBeUndefined();
    expect(soleSelectableTransmissionCardId(
      hand,
      new Set(),
    )).toBeUndefined();
  });
});

describe("action dock hierarchy", () => {
  it("separates skip and decline commands from primary actions", () => {
    expect(isSecondaryPromptAction({ type: "PASS_REACTION" })).toBe(true);
    expect(isSecondaryPromptAction({ type: "PASS_LOCK" })).toBe(true);
    expect(isSecondaryPromptAction({ type: "DECLINE_INTELLIGENCE" })).toBe(true);
    expect(isSecondaryPromptAction({ type: "ACCEPT_INTELLIGENCE" })).toBe(false);
  });

  it("gives passive and reaction states concise guidance", () => {
    expect(promptDescription({
      ...projection,
      legalActions: [],
    })).toBe("当前无需操作，状态变化后会自动更新。");
    expect(promptDescription({
      ...projection,
      reactionWindow: {
        kind: "intelligence",
        currentResponderId: "甲",
      },
      legalActions: [{ type: "PASS_REACTION" }],
    })).toBe("可使用高亮手牌，或选择下方的可用操作。");
  });

  it("labels the recipient's combined reaction and receipt decision", () => {
    expect(promptTitle({
      ...projection,
      reactionWindow: {
        kind: "intelligence",
        currentResponderId: "甲",
      },
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        { type: "DECLINE_INTELLIGENCE" },
      ],
    })).toBe("轮到你响应并决定是否接收情报");
  });

  it("treats transmission card selection as an active decision", () => {
    expect(promptDescription({
      ...projection,
      phase: "preTransmission",
      activePlayerId: "甲",
      pendingSecretOrder: {
        stage: "selection",
        targetPlayerId: "甲",
        verifiedNoMatch: false,
      },
      legalActions: [],
    })).toBe("请选择一张高亮情报牌；选中后再确认传递方式和目标。");
  });
});

describe("private hand inspection", () => {
  it("shows the verified hand to the 秘密下达 player after a no-match claim", () => {
    expect(inspectedHandForProjection({
      ...projection,
      pendingSecretOrder: {
        stage: "selection",
        targetPlayerId: "甲",
        sourcePlayerId: "乙",
        word: "听风",
        verifiedNoMatch: true,
        inspectedHand: [identityProbe],
      },
    })).toEqual([identityProbe]);
  });
});

describe("public audit log", () => {
  it("matches a player as either the action initiator or its target and recipient", () => {
    expect(auditEntryInvolvesPlayer("甲对乙使用危险情报，等待响应", "甲")).toBe(true);
    expect(auditEntryInvolvesPlayer("甲对乙使用危险情报，等待响应", "乙")).toBe(true);
    expect(auditEntryInvolvesPlayer("乙接收情报：「转移（蓝 · 密电）」", "乙")).toBe(true);
    expect(auditEntryInvolvesPlayer("甲的回合结束", "乙")).toBe(false);
    expect(auditEntryInvolvesPlayer("小乙 已重新连接", "player-b", "小乙")).toBe(true);
  });

  it("uses the shared server sequence to interleave room and gameplay entries", () => {
    expect(mergeAuditLogs(
      ["stale projection entry"],
      [
        { sequence: 3, timestamp: 30, text: "乙开始以文本传递情报，当前接收者：甲", source: "game" },
        { sequence: 1, timestamp: 10, text: "房间以当前座位开始游戏", source: "room" },
        { sequence: 2, timestamp: 20, text: "游戏初始化完成：2名玩家", source: "game" },
      ],
    )).toEqual([
      "房间以当前座位开始游戏",
      "游戏初始化完成：2名玩家",
      "乙开始以文本传递情报，当前接收者：甲",
    ]);
  });

  it("falls back to the game projection when ordered events are unavailable", () => {
    expect(mergeAuditLogs(["游戏初始化完成：2名玩家"])).toEqual([
      "游戏初始化完成：2名玩家",
    ]);
  });

  it("shows display names instead of internal IDs and keeps chronological order", () => {
    const entries = [
      "0147dd0b开始传递情报",
      "0147dd0b完成与6740294b的公开文本交换",
    ];

    expect(formatAuditEntries(entries, {
      "0147dd0b": "小甲",
      "6740294b": "小乙",
    })).toEqual([
      "【小甲】开始传递情报",
      "【小甲】完成与【小乙】的公开文本交换",
    ]);
  });
});

describe("viewer-relative seat layout", () => {
  it("anchors the current player first while preserving clockwise order", () => {
    expect(seatOrderAnchoredAtPlayer(["甲", "乙", "丙", "丁", "戊"], "丙"))
      .toEqual(["丙", "丁", "戊", "甲", "乙"]);
    expect(seatOrderAnchoredAtPlayer(["甲", "乙"], "乙")).toEqual(["乙", "甲"]);
  });
});

describe("duel transmission direction", () => {
  it("omits the meaningless direction choice for circle cards", () => {
    expect(transmissionDirectionForSelection("duel", true, "counterclockwise"))
      .toBeUndefined();
    expect(transmissionDirectionForSelection("standard", true, "counterclockwise"))
      .toBe("counterclockwise");
  });
});

describe("transmission prompt", () => {
  it("describes only the choices required by the selected card", () => {
    expect(transmissionPromptDescription(
      { circle: false, transmission: "任意" },
      "直达",
      "standard",
    )).toBe("请选择传递方式和接收者。");
    expect(transmissionPromptDescription(
      { circle: true, transmission: "密电" },
      "密电",
      "standard",
    )).toBe("请选择传递方向。");
    expect(transmissionPromptDescription(
      { circle: true, transmission: "密电" },
      "密电",
      "duel",
    )).toBe("确认后开始传递。");
  });
});
