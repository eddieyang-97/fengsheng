import { describe, expect, it } from "vitest";

import { PHYSICAL_DECK, type PhysicalCardId } from "./cards";
import {
  currentPromptFingerprint,
  currentReactionWindow,
  currentResolutionContext,
  currentResponderId,
  currentResponseFrames,
  enterTransmissionPhase,
  initializeGame,
  passLockOpportunity,
  passReaction,
  playBurn,
  playDecrypt,
  playLock,
  playLure,
  playPublicText,
  playSecretOrder,
  playSwap,
  playTransfer,
  projectGameForPlayer,
  projectGameForSpectator,
  startTransmission,
  topResponseFrame,
  type GameState,
  type StartTransmissionOptions,
} from "./engine";

const players = ["甲", "乙", "丙", "丁", "戊"] as const;

function game(seed: number): GameState {
  const state = initializeGame(players, seed);
  state.activePlayerId = "甲";
  return state;
}

function cardId(
  predicate: (card: (typeof PHYSICAL_DECK)[number]) => boolean,
  excluded: readonly PhysicalCardId[] = [],
): PhysicalCardId {
  const card = PHYSICAL_DECK.find(
    (candidate) => predicate(candidate) && !excluded.includes(candidate.id),
  );
  if (!card) throw new Error("找不到测试牌");
  return card.id;
}

function putInHand(
  state: GameState,
  playerId: string,
  wanted: PhysicalCardId,
  index = 0,
): void {
  const target = state.players[playerId];
  if (target.hand[index] === wanted) return;
  const replacement = target.hand[index];
  const owner = Object.values(state.players).find((player) =>
    player.hand.includes(wanted),
  );
  if (owner) {
    owner.hand[owner.hand.indexOf(wanted)] = replacement;
  } else {
    const drawIndex = state.drawPile.indexOf(wanted);
    if (drawIndex < 0) throw new Error("测试牌不在手牌或牌库中");
    state.drawPile[drawIndex] = replacement;
  }
  target.hand[index] = wanted;
}

function moveToIntelligence(
  state: GameState,
  playerId: string,
  wanted: PhysicalCardId,
): void {
  const owner = Object.values(state.players).find((player) =>
    player.hand.includes(wanted),
  );
  if (owner) {
    owner.hand.splice(owner.hand.indexOf(wanted), 1);
  } else {
    const drawIndex = state.drawPile.indexOf(wanted);
    if (drawIndex < 0) throw new Error("测试牌不在手牌或牌库中");
    state.drawPile.splice(drawIndex, 1);
  }
  state.players[playerId].intelligence.push(wanted);
}

function transmissionOptions(
  state: GameState,
  cardId: PhysicalCardId,
): StartTransmissionOptions {
  const card = PHYSICAL_DECK.find((candidate) => candidate.id === cardId)!;
  const method = card.transmission === "任意" ? "直达" : card.transmission;
  return {
    ...(card.transmission === "任意" ? { method } : {}),
    ...(method === "直达" ? { targetId: "乙" } : {}),
    ...(card.circle && method !== "直达"
      ? { direction: "clockwise" as const }
      : {}),
  };
}

function advanceReactionTo(state: GameState, actorId: string): void {
  while (currentResponderId(state) !== actorId) {
    const responderId = currentResponderId(state);
    if (!responderId) throw new Error("目标玩家获得响应优先级前窗口已结束");
    passReaction(state, responderId);
  }
}

function directIntelligence(
  excluded: readonly PhysicalCardId[] = [],
): PhysicalCardId {
  return cardId(
    (card) =>
      card.transmission === "直达" &&
      !["锁定", "转移", "掉包", "调虎离山", "破译", "烧毁"].includes(
        card.name,
      ),
    excluded,
  );
}

describe("统一解析状态读取器", () => {
  it("无响应时返回空读取模型", () => {
    const state = game(901);

    expect(currentResolutionContext(state)).toBeUndefined();
    expect(currentReactionWindow(state)).toBeUndefined();
    expect(currentResponseFrames(state)).toEqual([]);
    expect(topResponseFrame(state)).toBeUndefined();
    expect(currentResponderId(state)).toBeUndefined();
    expect(currentPromptFingerprint(state)).toBeUndefined();
  });

  it("将功能牌窗口和顶层帧映射到同一上下文", () => {
    const state = game(902);
    const publicText = cardId((card) => card.name === "公开文本");
    putInHand(state, "甲", publicText);

    playPublicText(state, "甲", publicText, "乙");

    const context = currentResolutionContext(state);
    expect(context).toMatchObject({ kind: "function" });
    expect(context?.frames).toHaveLength(1);
    expect(currentReactionWindow(state)).toBe(
      state.resolutionStack.at(-1)?.window,
    );
    expect(topResponseFrame(state)).toBe(context?.frames.at(-1));
    expect(currentResponderId(state)).toBe(
      currentReactionWindow(state)?.responderOrder[currentReactionWindow(state)!.nextResponderIndex],
    );
    expect(currentPromptFingerprint(state)).toContain(
      context!.frames.at(-1)!.id,
    );
    expect(projectGameForSpectator(state).responseStack).toEqual(
      projectGameForPlayer(state, "乙").responseStack,
    );
  });

  it("将烧毁嵌套窗口映射到最上层烧毁上下文", () => {
    const state = game(903);
    const burn = cardId((card) => card.name === "烧毁");
    const intelligence = cardId(
      (card) => card.color === "黑" && !card.unburnable && card.name !== "烧毁",
      [burn],
    );
    putInHand(state, "甲", burn);
    moveToIntelligence(state, "乙", intelligence);

    playBurn(state, "甲", burn, "乙", intelligence);

    const context = currentResolutionContext(state);
    expect(context).toMatchObject({ kind: "burn" });
    expect(context?.kind === "burn" ? context.burn.sourceCardId : undefined)
      .toBe(burn);
    expect(topResponseFrame(state)).toBe(context?.frames.at(-1));
    expect(currentPromptFingerprint(state)).toContain(
      context!.frames.at(-1)!.id,
    );
  });

  it("将秘密下达询问窗口映射为无帧的秘密下达上下文", () => {
    const state = game(905);

    enterTransmissionPhase(state, "甲");

    const context = currentResolutionContext(state);
    expect(context).toMatchObject({ kind: "secretOrder" });
    expect(context?.frames).toEqual([]);
    expect(currentResponseFrames(state)).toEqual([]);
    expect(currentResponderId(state)).toBe("乙");
  });

  it("秘密下达行动窗口的提示指纹包含当前帧", () => {
    const state = game(906);
    const order = cardId((card) => card.name === "秘密下达");
    putInHand(state, "乙", order);

    enterTransmissionPhase(state, "甲");
    playSecretOrder(state, "乙", order, "听风");

    expect(currentResolutionContext(state)).toMatchObject({
      kind: "secretOrder",
    });
    expect(currentPromptFingerprint(state)).toContain(
      topResponseFrame(state)!.id,
    );
  });

  it("保持锁定提示及随后情报响应的指纹兼容", () => {
    const state = game(904);
    const transmittedCard = state.players["甲"].hand[0]!;

    startTransmission(
      state,
      "甲",
      transmittedCard,
      transmissionOptions(state, transmittedCard),
    );

    expect(currentResolutionContext(state)).toBeUndefined();
    expect(currentPromptFingerprint(state)).toBe(
      `lock:${state.transmission?.receiptCycle}:甲:${state.transmission?.intendedRecipientId}`,
    );

    passLockOpportunity(state, "甲");

    const context = currentResolutionContext(state);
    expect(context).toMatchObject({ kind: "receipt" });
    expect(context?.frames).toEqual([]);
    expect(currentResponseFrames(state)).toEqual([]);
    expect(currentPromptFingerprint(state)).toMatch(/^reaction:intelligence:/);

    const firstResponder = currentResponderId(state)!;
    const firstFingerprint = currentPromptFingerprint(state);
    passReaction(state, firstResponder);
    expect(currentResponderId(state)).not.toBe(firstResponder);
    expect(currentPromptFingerprint(state)).not.toBe(firstFingerprint);
  });

  it("通过真实行动为每一种响应窗口生成独立提示指纹", () => {
    const fingerprints = new Map<string, string>();
    const record = (state: GameState, expectedKind: string) => {
      expect(currentReactionWindow(state)?.kind).toBe(expectedKind);
      const fingerprint = currentPromptFingerprint(state);
      expect(fingerprint).toMatch(
        new RegExp(`^reaction:${expectedKind}:`),
      );
      fingerprints.set(expectedKind, fingerprint!);
    };

    const secretOrderState = game(910);
    enterTransmissionPhase(secretOrderState, "甲");
    record(secretOrderState, "secretOrder");

    const functionState = game(911);
    const publicText = cardId((card) => card.name === "公开文本");
    putInHand(functionState, "甲", publicText);
    playPublicText(functionState, "甲", publicText, "乙");
    record(functionState, "function");

    const burnState = game(912);
    const burn = cardId((card) => card.name === "烧毁");
    const blackIntelligence = cardId(
      (card) => card.color === "黑" && !card.unburnable && card.name !== "烧毁",
      [burn],
    );
    putInHand(burnState, "甲", burn);
    moveToIntelligence(burnState, "乙", blackIntelligence);
    playBurn(burnState, "甲", burn, "乙", blackIntelligence);
    record(burnState, "burn");

    const intelligenceState = game(913);
    const ordinaryIntelligence = directIntelligence();
    putInHand(intelligenceState, "甲", ordinaryIntelligence);
    startTransmission(intelligenceState, "甲", ordinaryIntelligence, {
      targetId: "乙",
    });
    passLockOpportunity(intelligenceState, "甲");
    record(intelligenceState, "intelligence");

    const lockState = game(914);
    const lockIntelligence = directIntelligence();
    const lock = cardId((card) => card.name === "锁定", [lockIntelligence]);
    putInHand(lockState, "甲", lockIntelligence, 0);
    putInHand(lockState, "甲", lock, 1);
    startTransmission(lockState, "甲", lockIntelligence, { targetId: "乙" });
    playLock(lockState, "甲", lock);
    record(lockState, "lock");

    const swapState = game(915);
    const swapIntelligence = directIntelligence();
    const swap = cardId((card) => card.name === "掉包", [swapIntelligence]);
    putInHand(swapState, "甲", swapIntelligence);
    putInHand(swapState, "丙", swap);
    startTransmission(swapState, "甲", swapIntelligence, { targetId: "乙" });
    passLockOpportunity(swapState, "甲");
    playSwap(swapState, "丙", swap);
    record(swapState, "swap");

    const lureState = game(916);
    const lureIntelligence = directIntelligence();
    const lure = cardId((card) => card.name === "调虎离山", [lureIntelligence]);
    putInHand(lureState, "甲", lureIntelligence);
    putInHand(lureState, "丙", lure);
    startTransmission(lureState, "甲", lureIntelligence, { targetId: "乙" });
    passLockOpportunity(lureState, "甲");
    playLure(lureState, "丙", lure);
    record(lureState, "lure");

    const transferState = game(917);
    const transferIntelligence = directIntelligence();
    const transfer = cardId(
      (card) => card.name === "转移",
      [transferIntelligence],
    );
    putInHand(transferState, "甲", transferIntelligence);
    putInHand(transferState, "乙", transfer);
    startTransmission(transferState, "甲", transferIntelligence, {
      targetId: "乙",
    });
    passLockOpportunity(transferState, "甲");
    advanceReactionTo(transferState, "乙");
    playTransfer(transferState, "乙", transfer, "丁");
    record(transferState, "transfer");

    const decryptState = game(918);
    const decryptIntelligence = directIntelligence();
    const decrypt = cardId(
      (card) => card.name === "破译",
      [decryptIntelligence],
    );
    putInHand(decryptState, "甲", decryptIntelligence);
    putInHand(decryptState, "乙", decrypt);
    startTransmission(decryptState, "甲", decryptIntelligence, {
      targetId: "乙",
    });
    passLockOpportunity(decryptState, "甲");
    advanceReactionTo(decryptState, "乙");
    playDecrypt(decryptState, "乙", decrypt);
    record(decryptState, "decrypt");

    expect([...fingerprints.keys()].sort()).toEqual([
      "burn",
      "decrypt",
      "function",
      "intelligence",
      "lock",
      "lure",
      "secretOrder",
      "swap",
      "transfer",
    ]);
    expect(new Set(fingerprints.values()).size).toBe(fingerprints.size);
  });
});
