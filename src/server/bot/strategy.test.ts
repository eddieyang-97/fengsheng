import { describe, expect, it } from "vitest";
import { PHYSICAL_DECK, type Faction, type PhysicalCard, type PhysicalCardId } from "../../game/cards";
import type { PlayerProjection } from "../../game/engine";
import {
  BASELINE_V1,
  chooseBotCommand,
  chooseBotDecision,
  createBotMemory,
  createSeededBotRandom,
  factionBeliefs,
  LIVE_BOT_POLICY,
  observeBotProjection,
  receiptUtility,
  TACTICAL_V2,
  TACTICAL_V3,
  TACTICAL_V4,
  TACTICAL_V5,
  TACTICAL_V6,
  TACTICAL_V7,
  TACTICAL_V8,
  TACTICAL_V9,
  TACTICAL_V10,
} from "./strategy";
import { CANDIDATE_V14, CANDIDATE_V15, CANDIDATE_V16, CANDIDATE_V17, CANDIDATE_V19, CANDIDATE_V20, CANDIDATE_V23, CANDIDATE_V24, CANDIDATE_V25, CANDIDATE_V26, CANDIDATE_V27, CANDIDATE_V28, CANDIDATE_V29 } from "../../ai-lab/policies";

const LOW_REACTION_CONSERVATION_POLICY = {
  ...TACTICAL_V3,
  id: "test-low-reaction-conservation",
  reactionConservation: 0.75,
};
const INCREMENTAL_TRANSFER_POLICY = {
  ...TACTICAL_V3,
  id: "test-incremental-transfer",
  incrementalTransfer: true,
};
const GUARDED_INCREMENTAL_TRANSFER_POLICY = {
  ...TACTICAL_V4,
  id: "test-guarded-incremental-transfer",
  incrementalTransfer: true,
};
const INCREMENTAL_LURE_POLICY = {
  ...TACTICAL_V3,
  id: "test-incremental-lure",
  incrementalLure: true,
};
const ACTION_AFFINITY_POLICY = {
  ...TACTICAL_V5,
  id: "test-action-affinity",
  inferResolvedActionAffinity: true,
};

const blueCard = cardWhere((card) => card.color === "蓝");
const redDirectCard = cardWhere((card) => card.color === "红" && card.transmission === "直达");
const redPublicText = cardWhere((card) => card.name === "公开文本" && card.color === "红");
const bluePublicText = cardWhere((card) => card.name === "公开文本" && card.color === "蓝");
const blueDirectCard = cardWhere((card) => card.color === "蓝" && card.transmission === "直达");
const blackCard = cardWhere((card) => card.color === "黑");
const secondBlackCard = cardWhere(
  (card) => card.color === "黑" && card.id !== blackCard.id,
);
const dangerousCard = cardWhere((card) => card.name === "危险情报");
const burnCard = cardWhere((card) => card.name === "烧毁");
const reinforcementCard = cardWhere((card) => card.name === "增援");
const lockCard = cardWhere((card) => card.name === "锁定");
const counterCard = cardWhere((card) => card.name === "识破");
const interceptCard = cardWhere((card) => card.name === "截获");
const decryptCard = cardWhere((card) => card.name === "破译");
const transferCard = cardWhere((card) => card.name === "转移");
const separationCard = cardWhere((card) => card.name === "离间");
const lureCard = cardWhere((card) => card.name === "调虎离山");
const blueMailCard = cardWhere((card) => card.color === "蓝" && card.transmission === "密电");
const redMailCard = cardWhere((card) => card.color === "红" && card.transmission === "密电");
const secretOrderCard = cardWhere((card) => card.variant?.kind === "secretOrder");
const redSwapCard = cardWhere((card) => card.name === "掉包" && card.color === "红");
const blueSwapCard = cardWhere((card) => card.name === "掉包" && card.color === "蓝");
const militaryDrawProbe = cardWhere(
  (card) => card.variant?.kind === "probeDrawDiscard" && card.variant.drawFaction === "军情",
);
const undercoverDrawProbe = cardWhere(
  (card) => card.variant?.kind === "probeDrawDiscard" && card.variant.drawFaction === "潜伏",
);

describe("bot strategy", () => {
  it("promotes only the validated 危险情报 discard behavior as tactical-v10", () => {
    expect(LIVE_BOT_POLICY).toBe(TACTICAL_V10);
    expect(TACTICAL_V4).toMatchObject({
      incrementalLure: true,
      lureRequiresLikelyAcceptance: true,
    });
    expect(TACTICAL_V5).toMatchObject({
      incrementalLure: true,
      lureRequiresLikelyAcceptance: true,
      lockRequiresLikelyDecline: true,
      methodAwareDangerousTransmission: false,
      conservativeSwap: false,
    });
    expect(TACTICAL_V6).toMatchObject({
      methodAwareDangerousTransmission: true,
      conservativeSwap: true,
      routeAwareTransmission: false,
      routeAwareTransmissionCardChoice: false,
      routeAwareTransmissionMethodChoice: false,
      targetedFunctionConservation: false,
      declineRouting: "flat",
    });
    expect(TACTICAL_V7).toMatchObject({
      methodAwareDangerousTransmission: true,
      conservativeSwap: true,
      targetedFunctionConservation: true,
      declineRouting: "flat",
    });
    expect(TACTICAL_V8).toMatchObject({
      targetedFunctionConservation: true,
      declineRouting: "forced-return",
      directTransmissionEvidence: "none",
      lethalLockEvidence: 0,
      dangerousDiscardStrategy: "random",
    });
    expect(TACTICAL_V9).toMatchObject({
      declineRouting: "forced-return",
      directTransmissionEvidence: "black-only",
      lethalLockEvidence: 2.5,
      dangerousDiscardStrategy: "color-denial",
    });
    expect(TACTICAL_V10).toMatchObject({
      declineRouting: "forced-return",
      directTransmissionEvidence: "none",
      lethalLockEvidence: 0,
      dangerousDiscardStrategy: "color-then-function",
    });
    expect(CANDIDATE_V25).toMatchObject({
      directTransmissionEvidence: "black-only",
      directTransmissionEvidenceStrength: 1,
      lethalLockEvidence: 0,
      dangerousDiscardStrategy: "color-then-function",
    });
    expect(CANDIDATE_V26).toMatchObject({
      directTransmissionEvidence: "black-only",
      directTransmissionEvidenceStrength: 0.5,
      lethalLockEvidence: 0,
    });
    expect(CANDIDATE_V27).toMatchObject({
      directTransmissionEvidence: "none",
      lethalLockEvidence: 1.2,
      dangerousDiscardStrategy: "color-then-function",
    });
    expect(CANDIDATE_V28).toMatchObject({
      declineRouting: "acceptance-weighted",
      directTransmissionEvidence: "none",
      lethalLockEvidence: 0,
      dangerousDiscardStrategy: "color-then-function",
    });
    expect(CANDIDATE_V29).toMatchObject({
      declineRouting: "forced-return",
      dangerousDiscardStrategy: "expected-denial",
      directTransmissionEvidence: "none",
      lethalLockEvidence: 0,
    });
    expect(TACTICAL_V2.id).toBe("tactical-v2");
  });

  it("selects only a supplied legal action during normal prompts", () => {
    const projection = makeProjection({
      legalActions: [{ type: "CHOOSE_PROBE_IDENTITY", choice: "announce" }],
    });
    const command = chooseBotCommand(projection, createBotMemory(projection));
    expect(command).toEqual({ type: "CHOOSE_PROBE_IDENTITY", choice: "announce" });
  });

  it("learns a weak faction signal from newly received public intelligence", () => {
    const initial = makeProjection();
    const memory = createBotMemory(initial);
    const before = factionBeliefs(memory, initial).b.军情;
    const updated = makeProjection({
      players: initial.players.map((player) =>
        player.id === "b" ? { ...player, intelligence: [blueCard] } : player
      ),
    });
    observeBotProjection(memory, updated);
    expect(memory.evidence.b.军情).toBeGreaterThan(0);
    expect(factionBeliefs(memory, updated).b.军情).toBeGreaterThan(before);
  });

  it("treats voluntary 直达真情报 to itself as stronger same-faction evidence", () => {
    const initial = makeProjection();
    const memory = createBotMemory(initial);
    const transmitting = makeProjection({
      phase: "transmitting",
      auditLog: ["b开始以直达传递情报，当前接收者：bot"],
      transmission: {
        ...transmission(blueDirectCard),
        senderId: "b",
        method: "直达",
        intendedRecipientId: "bot",
      },
    });

    observeBotProjection(memory, transmitting, CANDIDATE_V19);

    expect(memory.evidence.b).toMatchObject({
      军情: 0.9,
      潜伏: 0,
      特工: 0,
    });
  });

  it("treats voluntary 直达假情报 to itself as strong opposing-faction evidence", () => {
    const initial = makeProjection();
    const memory = createBotMemory(initial);
    const transmitting = makeProjection({
      phase: "transmitting",
      auditLog: ["b开始以直达传递情报，当前接收者：bot"],
      transmission: {
        ...transmission(dangerousCard),
        senderId: "b",
        method: "直达",
        intendedRecipientId: "bot",
      },
    });

    observeBotProjection(memory, transmitting, CANDIDATE_V19);

    expect(memory.evidence.b).toMatchObject({
      军情: -1,
      潜伏: 0.4,
      特工: 0.4,
    });

    const blackOnlyMemory = createBotMemory(initial);
    observeBotProjection(blackOnlyMemory, transmitting, CANDIDATE_V20);
    expect(blackOnlyMemory.evidence.b).toMatchObject({
      军情: -1,
      潜伏: 0.4,
      特工: 0.4,
    });

    const halfStrengthMemory = createBotMemory(initial);
    observeBotProjection(halfStrengthMemory, transmitting, CANDIDATE_V26);
    expect(halfStrengthMemory.evidence.b).toMatchObject({
      军情: -0.5,
      潜伏: 0.2,
      特工: 0.2,
    });

    const liveMemory = createBotMemory(initial);
    observeBotProjection(liveMemory, transmitting, TACTICAL_V9);
    expect(liveMemory.evidence.b).toMatchObject({
      军情: -1,
      潜伏: 0.4,
      特工: 0.4,
    });
  });

  it("candidate-v20 does not infer from 直达真情报 targeting itself", () => {
    const initial = makeProjection();
    const memory = createBotMemory(initial);
    const transmitting = makeProjection({
      phase: "transmitting",
      auditLog: ["b开始以直达传递情报，当前接收者：bot"],
      transmission: {
        ...transmission(blueDirectCard),
        senderId: "b",
        method: "直达",
        intendedRecipientId: "bot",
      },
    });

    observeBotProjection(memory, transmitting, CANDIDATE_V20);

    expect(memory.evidence.b).toEqual({
      军情: 0,
      潜伏: 0,
      特工: 0,
    });
  });

  it("discounts 直达假情报 evidence when 秘密下达 forced its color", () => {
    const ordered = makeProjection({
      phase: "preTransmission",
      auditLog: ["c使用秘密下达并宣布：听风"],
      pendingSecretOrder: {
        stage: "selection",
        sourcePlayerId: "c",
        targetPlayerId: "b",
        word: "听风",
        requiredColor: "黑",
        verifiedNoMatch: false,
      },
    });
    const memory = createBotMemory(ordered);
    const transmitting = makeProjection({
      phase: "transmitting",
      auditLog: [
        ...ordered.auditLog,
        "b开始以直达传递情报，当前接收者：bot",
      ],
      transmission: {
        ...transmission(dangerousCard),
        senderId: "b",
        method: "直达",
        intendedRecipientId: "bot",
      },
    });

    observeBotProjection(memory, transmitting, CANDIDATE_V19);

    expect(memory.evidence.b).toMatchObject({
      军情: -0.55,
      潜伏: 0.2,
      特工: 0.2,
    });
  });

  it("infers strong opposition when a knowingly lethal 锁定 kills a player", () => {
    const initial = makeProjection();
    const memory = createBotMemory(initial, TACTICAL_V9);
    const locked = makeProjection({
      phase: "transmitting",
      players: initial.players.map((player) =>
        player.id === "c"
          ? {
              ...player,
              intelligence: [blackCard, { ...blackCard, id: "victim-black-2" }],
            }
          : player
      ),
      transmission: {
        ...transmission(dangerousCard),
        senderId: "b",
        method: "直达",
        intendedRecipientId: "c",
      },
      auditLog: [
        "b开始以直达传递情报，当前接收者：c",
        "b对c使用锁定，等待响应",
      ],
    });
    observeBotProjection(memory, locked, TACTICAL_V9);

    const killed = makeProjection({
      phase: "resolvingReceipt",
      players: locked.players.map((player) =>
        player.id === "c"
          ? {
              ...player,
              alive: false,
              faction: "军情" as Faction,
              intelligence: [],
            }
          : player
      ),
      auditLog: [
        ...locked.auditLog,
        "锁定结算：锁定目标为c",
        "c接收情报「危险情报（黑 · 直达）」后死亡，阵营公开为军情",
      ],
    });
    observeBotProjection(memory, killed, TACTICAL_V9);

    expect(memory.evidence.b).toMatchObject({
      军情: -2.5,
      潜伏: 0.8,
      特工: 0.8,
    });
  });

  it("does not blame the locker when 掉包 changed a non-black card into the lethal card", () => {
    const initial = makeProjection();
    const memory = createBotMemory(initial, TACTICAL_V9);
    const locked = makeProjection({
      phase: "transmitting",
      transmission: {
        ...transmission(blueDirectCard),
        senderId: "b",
        method: "直达",
        intendedRecipientId: "c",
      },
      auditLog: [
        "b开始以直达传递情报，当前接收者：c",
        "b对c使用锁定，等待响应",
      ],
    });
    observeBotProjection(memory, locked, TACTICAL_V9);

    const killedAfterSwap = makeProjection({
      phase: "resolvingReceipt",
      players: locked.players.map((player) =>
        player.id === "c"
          ? { ...player, alive: false, faction: "军情" as Faction }
          : player
      ),
      auditLog: [
        ...locked.auditLog,
        "锁定结算：锁定目标为c",
        "掉包结算：原情报公开弃置；替换牌正面朝上",
        "c接收情报「掉包（黑 · 直达）」后死亡，阵营公开为军情",
      ],
    });
    observeBotProjection(memory, killedAfterSwap, TACTICAL_V9);

    expect(memory.evidence.b).toEqual({
      军情: 0,
      潜伏: 0,
      特工: 0,
    });
  });

  it("uses 危险情报 to discard an opponent's valuable transmission color", () => {
    const projection = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "军情", hand: [] },
      players: makeProjection().players.map((player) =>
        player.id === "b"
          ? { ...player, faction: "潜伏" as Faction, handCount: 2 }
          : player
      ),
      activeFunctionAction: {
        kind: "dangerousIntelligence",
        sourcePlayerId: "bot",
        targetPlayerId: "b",
        stage: "awaitingDiscard",
        inspectedHand: [blueMailCard, redMailCard],
      },
      legalActions: [
        {
          type: "CHOOSE_DANGEROUS_DISCARD",
          cardId: blueMailCard.id as PhysicalCardId,
        },
        {
          type: "CHOOSE_DANGEROUS_DISCARD",
          cardId: redMailCard.id as PhysicalCardId,
        },
      ],
    });

    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: TACTICAL_V9, random: () => 0 },
    )).toEqual({
      type: "CHOOSE_DANGEROUS_DISCARD",
      cardId: redMailCard.id,
    });
    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: CANDIDATE_V23, random: () => 0 },
    )).toEqual({
      type: "CHOOSE_DANGEROUS_DISCARD",
      cardId: redMailCard.id,
    });
  });

  it("uses function value only to break same-color 危险情报 discard choices", () => {
    const projection = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "军情", hand: [] },
      players: makeProjection().players.map((player) =>
        player.id === "b"
          ? { ...player, faction: "潜伏" as Faction, handCount: 2 }
          : player
      ),
      activeFunctionAction: {
        kind: "dangerousIntelligence",
        sourcePlayerId: "bot",
        targetPlayerId: "b",
        stage: "awaitingDiscard",
        inspectedHand: [redPublicText, redSwapCard],
      },
      legalActions: [
        {
          type: "CHOOSE_DANGEROUS_DISCARD",
          cardId: redPublicText.id as PhysicalCardId,
        },
        {
          type: "CHOOSE_DANGEROUS_DISCARD",
          cardId: redSwapCard.id as PhysicalCardId,
        },
      ],
    });

    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: CANDIDATE_V24, random: () => 0 },
    )).toEqual({
      type: "CHOOSE_DANGEROUS_DISCARD",
      cardId: redSwapCard.id,
    });
  });

  it("can learn weak affinity from a completed action that helps the bot", () => {
    const initial = makeProjection({
      own: { id: "bot", faction: "军情", hand: [redDirectCard] },
      players: makeProjection().players.map((player) =>
        player.id === "bot" ? { ...player, handCount: 1 } : player
      ),
      auditLog: ["b对bot使用公开文本，等待响应"],
      activeFunctionAction: {
        kind: "publicText",
        sourcePlayerId: "b",
        targetPlayerId: "bot",
        stage: "reactions",
      },
    });
    const memory = createBotMemory(initial);
    const updated = makeProjection({
      own: { id: "bot", faction: "军情", hand: [bluePublicText] },
      players: initial.players,
      auditLog: [
        "b对bot使用公开文本，等待响应",
        "b完成与bot的公开文本交换",
      ],
    });

    observeBotProjection(memory, updated, ACTION_AFFINITY_POLICY);

    expect(memory.evidence.b.军情).toBeCloseTo(0.35);
    expect(memory.evidence.b.潜伏).toBe(0);
  });

  it("can treat a completed harmful action as opposing evidence", () => {
    const initial = makeProjection({
      own: { id: "bot", faction: "军情", hand: [counterCard] },
      players: makeProjection().players.map((player) =>
        player.id === "bot" ? { ...player, handCount: 1 } : player
      ),
      auditLog: ["b对bot使用危险情报，等待响应"],
      activeFunctionAction: {
        kind: "dangerousIntelligence",
        sourcePlayerId: "b",
        targetPlayerId: "bot",
        stage: "reactions",
      },
    });
    const memory = createBotMemory(initial);
    const updated = makeProjection({
      own: { id: "bot", faction: "军情", hand: [] },
      players: initial.players,
      auditLog: [
        "b对bot使用危险情报，等待响应",
        "b通过危险情报自动弃置bot唯一的手牌",
      ],
    });

    observeBotProjection(memory, updated, ACTION_AFFINITY_POLICY);

    expect(memory.evidence.b.军情).toBeCloseTo(-0.35);
    expect(memory.evidence.b.潜伏).toBeCloseTo(0.15);
    expect(memory.evidence.b.特工).toBeCloseTo(0.15);
  });

  it("ignores a helpful action redirected onto the bot when learning action affinity", () => {
    const initial = makeProjection({
      own: { id: "bot", faction: "军情", hand: [redDirectCard] },
      auditLog: [
        "b对c使用公开文本，等待响应",
        "离间结算：功能牌目标改为bot",
      ],
      activeFunctionAction: {
        kind: "publicText",
        sourcePlayerId: "b",
        targetPlayerId: "bot",
        stage: "reactions",
      },
    });
    const memory = createBotMemory(initial);
    const updated = makeProjection({
      own: { id: "bot", faction: "军情", hand: [bluePublicText] },
      players: initial.players,
      auditLog: [
        ...initial.auditLog,
        "b完成与bot的公开文本交换",
      ],
    });

    observeBotProjection(memory, updated, ACTION_AFFINITY_POLICY);

    expect(memory.evidence.b).toEqual({ 军情: 0, 潜伏: 0, 特工: 0 });
  });

  it("does not infer teammates from action affinity for a 特工 bot", () => {
    const initial = makeProjection({
      own: { id: "bot", faction: "特工", hand: [redDirectCard] },
      auditLog: ["b对bot使用公开文本，等待响应"],
      activeFunctionAction: {
        kind: "publicText",
        sourcePlayerId: "b",
        targetPlayerId: "bot",
        stage: "reactions",
      },
    });
    const memory = createBotMemory(initial);
    const updated = makeProjection({
      own: { id: "bot", faction: "特工", hand: [counterCard] },
      players: initial.players,
      auditLog: [
        ...initial.auditLog,
        "b完成与bot的公开文本交换",
      ],
    });

    observeBotProjection(memory, updated, ACTION_AFFINITY_POLICY);

    expect(memory.evidence.b).toEqual({ 军情: 0, 潜伏: 0, 特工: 0 });
  });

  it("infers sender alignment from a face-up transmission to a revealed player", () => {
    const initial = makeProjection({
      players: makeProjection().players.map((player) =>
        player.id === "c" ? { ...player, faction: "军情" as Faction } : player
      ),
    });
    const memory = createBotMemory(initial);
    const withTransmission = {
      ...initial,
      phase: "transmitting" as const,
      transmission: { ...transmission(blueCard), senderId: "b", intendedRecipientId: "c" },
    };
    observeBotProjection(memory, withTransmission);
    expect(memory.evidence.b.军情).toBeGreaterThan(memory.evidence.b.潜伏);
  });

  it("treats a visible secret-order color as weak evidence of the orderer's faction", () => {
    const offering = makeProjection({
      phase: "preTransmission",
      pendingSecretOrder: {
        stage: "offering",
        targetPlayerId: "bot",
        verifiedNoMatch: false,
      },
    });
    const memory = createBotMemory(offering);
    const ordered = makeProjection({
      phase: "preTransmission",
      pendingSecretOrder: {
        stage: "selection",
        sourcePlayerId: "b",
        targetPlayerId: "bot",
        word: "听风",
        requiredColor: "蓝",
        verifiedNoMatch: false,
      },
    });

    observeBotProjection(memory, ordered);

    expect(memory.evidence.b.军情).toBeGreaterThan(memory.evidence.b.潜伏);

    const uninformed = createBotMemory({
      ...ordered,
      pendingSecretOrder: { ...ordered.pendingSecretOrder!, requiredColor: undefined },
    });
    expect(uninformed.evidence.b.军情).toBe(0);
    expect(uninformed.evidence.b.潜伏).toBe(0);
  });

  it("retains the secret-order color constraint for the following hidden transmission", () => {
    const ordered = makeProjection({
      phase: "preTransmission",
      auditLog: ["bot使用秘密下达并宣布：日落"],
      pendingSecretOrder: {
        stage: "selection",
        sourcePlayerId: "bot",
        targetPlayerId: "b",
        word: "日落",
        requiredColor: "黑",
        verifiedNoMatch: false,
      },
    });
    const memory = createBotMemory(ordered);
    const hiddenBlack = makeProjection({
      phase: "transmitting",
      players: makeProjection().players.map((player) =>
        player.id === "bot"
          ? { ...player, intelligence: [blackCard, { ...blackCard, id: "second-black" }] }
          : player
      ),
      transmission: {
        ...transmission(blackCard),
        card: undefined,
        faceUp: false,
        senderId: "b",
        intendedRecipientId: "bot",
      },
      auditLog: [
        ...ordered.auditLog,
        "b开始以密电传递情报，当前接收者：bot",
      ],
      legalActions: [{ type: "ACCEPT_INTELLIGENCE" }, { type: "DECLINE_INTELLIGENCE" }],
    });

    expect(chooseBotCommand(hiddenBlack, memory)?.type).toBe("DECLINE_INTELLIGENCE");
    expect(memory.transmissionInference?.forcedColor).toBe("黑");
  });

  it.each([
    "b没有符合秘密下达所要求的颜色的情报，服务器自动验证并解除颜色限制",
    "秘密下达被识破，颜色限制取消",
  ])("does not retain an invalidated secret-order constraint: %s", (invalidationEntry) => {
    const ordered = makeProjection({
      phase: "preTransmission",
      auditLog: ["bot使用秘密下达并宣布：日落"],
      pendingSecretOrder: {
        stage: "selection",
        sourcePlayerId: "bot",
        targetPlayerId: "b",
        word: "日落",
        requiredColor: "黑",
        verifiedNoMatch: false,
      },
    });
    const memory = createBotMemory(ordered);
    const transmissionStarted = makeProjection({
      phase: "transmitting",
      transmission: {
        ...transmission(blackCard),
        card: undefined,
        faceUp: false,
        senderId: "b",
      },
      auditLog: [
        ...ordered.auditLog,
        invalidationEntry,
        "b开始以密电传递情报，当前接收者：bot",
      ],
    });

    observeBotProjection(memory, transmissionStarted);

    expect(memory.transmissionInference?.forcedColor).toBeUndefined();
  });

  it("掉包结算后不再将秘密下达颜色当作替换牌的颜色", () => {
    const ordered = makeProjection({
      phase: "preTransmission",
      auditLog: ["bot使用秘密下达并宣布：日落"],
      pendingSecretOrder: {
        stage: "selection",
        sourcePlayerId: "bot",
        targetPlayerId: "b",
        word: "日落",
        requiredColor: "黑",
        verifiedNoMatch: false,
      },
    });
    const memory = createBotMemory(ordered);
    const transmissionStarted = makeProjection({
      phase: "transmitting",
      transmission: { ...transmission(blackCard), card: undefined, faceUp: false, senderId: "b" },
      auditLog: [
        ...ordered.auditLog,
        "b开始以密电传递情报，当前接收者：bot",
      ],
    });
    observeBotProjection(memory, transmissionStarted);
    expect(memory.transmissionInference?.forcedColor).toBe("黑");

    observeBotProjection(memory, {
      ...transmissionStarted,
      auditLog: [...transmissionStarted.auditLog, "掉包结算：原情报公开弃置；替换牌正面朝上"],
    });

    expect(memory.transmissionInference?.forcedColor).toBeUndefined();
  });

  it("does not immediately 掉包 its own 秘密下达 intelligence to a different color", () => {
    const ordered = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "军情", hand: [blueSwapCard] },
      auditLog: ["bot使用秘密下达并宣布：日落"],
      pendingSecretOrder: {
        stage: "selection",
        sourcePlayerId: "bot",
        targetPlayerId: "b",
        word: "日落",
        requiredColor: "红",
        verifiedNoMatch: false,
      },
    });
    const memory = createBotMemory(ordered);
    const transmitting = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [blueSwapCard] },
      auditLog: [
        ...ordered.auditLog,
        "b开始以密电传递情报，当前接收者：c",
      ],
      transmission: {
        ...transmission(redMailCard),
        card: undefined,
        faceUp: false,
        senderId: "b",
        intendedRecipientId: "c",
      },
      reactionWindow: {
        kind: "intelligence",
        currentResponderId: "bot",
      },
      responseStack: [{
        id: "intelligence",
        kind: "intelligence",
        sourcePlayerId: "b",
        targetPlayerId: "c",
      }],
      legalActions: [
        { type: "PASS_REACTION" },
        {
          type: "PLAY_SWAP",
          cardId: blueSwapCard.id as PhysicalCardId,
        },
      ],
    });

    expect(chooseBotCommand(transmitting, memory)?.type).toBe("PASS_REACTION");
    expect(memory.transmissionInference).toMatchObject({
      forcedColor: "红",
      forcedByPlayerId: "bot",
    });
  });

  it("treats a forced public-text discard as definitive faction evidence", () => {
    const forced = makeProjection({
      phase: "resolvingReceipt",
      players: makeProjection().players.map((player) =>
        player.id === "b" ? { ...player, intelligence: [redPublicText] } : player
      ),
      auditLog: [
        "b接收情报：「公开文本（红 · 文本）」",
        "b须为公开文本选择一张手牌弃置",
      ],
    });
    const forcedMemory = createBotMemory(forced);
    expect(factionBeliefs(forcedMemory, forced).b).toEqual({ 军情: 0, 潜伏: 1, 特工: 0 });

    const optional = makeProjection({
      phase: "resolvingReceipt",
      players: makeProjection().players.map((player) =>
        player.id === "b" ? { ...player, intelligence: [redPublicText] } : player
      ),
      auditLog: [
        "b接收情报：「公开文本（红 · 文本）」",
        "b须选择公开文本的摸牌或弃牌效果",
        "b因公开文本弃置一张手牌：「锁定（红 · 直达）」",
      ],
    });
    expect(factionBeliefs(createBotMemory(optional), optional).b.潜伏).toBeLessThan(1);
  });

  it("rules out factions whose victory thresholds were passed without winning", () => {
    const threeRed = [
      redDirectCard,
      { ...redDirectCard, id: "second-red" },
      { ...redDirectCard, id: "third-red" },
    ];
    const continued = makeProjection({
      phase: "transmitting",
      players: makeProjection().players.map((player) =>
        player.id === "b" ? { ...player, intelligence: threeRed } : player
      ),
    });
    expect(factionBeliefs(createBotMemory(continued), continued).b.潜伏).toBe(0);

    const stillResolving = { ...continued, phase: "resolvingReceipt" as const };
    expect(factionBeliefs(createBotMemory(stillResolving), stillResolving).b.潜伏).toBeGreaterThan(0);
  });

  it("treats receiving the +1 probe outcome as evidence that the sender is a teammate", () => {
    const duringProbe = makeProjection({
      own: { id: "bot", faction: "军情", hand: [counterCard] },
      activeFunctionAction: {
        kind: "probeDrawDiscard",
        sourcePlayerId: "b",
        targetPlayerId: "bot",
        stage: "reactions",
      },
    });
    const memory = createBotMemory(duringProbe);
    const before = memory.evidence.b?.军情 ?? 0;
    const afterProbe = makeProjection({
      own: { id: "bot", faction: "军情", hand: [counterCard, transferCard] },
      players: duringProbe.players.map((player) =>
        player.id === "bot" ? { ...player, handCount: player.handCount + 1 } : player
      ),
      activeFunctionAction: undefined,
    });

    observeBotProjection(memory, afterProbe);

    expect(memory.evidence.b.军情).toBeGreaterThan(before);
    expect(memory.evidence.b.军情).toBeGreaterThan(memory.evidence.b.潜伏);
  });

  it("does not treat another 特工 as a teammate after receiving +1", () => {
    const duringProbe = makeProjection({
      own: { id: "bot", faction: "特工", hand: [counterCard] },
      activeFunctionAction: {
        kind: "probeDrawDiscard",
        sourcePlayerId: "b",
        targetPlayerId: "bot",
        stage: "reactions",
      },
    });
    const memory = createBotMemory(duringProbe);
    const afterProbe = makeProjection({
      own: { id: "bot", faction: "特工", hand: [counterCard, transferCard] },
      players: duringProbe.players.map((player) =>
        player.id === "bot" ? { ...player, handCount: player.handCount + 1 } : player
      ),
      activeFunctionAction: undefined,
    });

    observeBotProjection(memory, afterProbe);

    expect(memory.evidence.b.特工).toBe(0);
  });

  it("treats publicly revealed factions as certain", () => {
    const projection = makeProjection({
      players: makeProjection().players.map((player) =>
        player.id === "c" ? { ...player, faction: "潜伏" as Faction } : player
      ),
    });
    const beliefs = factionBeliefs(createBotMemory(projection), projection);
    expect(beliefs.c).toEqual({ 军情: 0, 潜伏: 1, 特工: 0 });
  });

  it("conditions faction priors on the bot's privately known faction in a duel", () => {
    const projection = makeProjection({
      mode: "duel",
      seatOrder: ["bot", "b"],
      players: [
        { id: "bot", alive: true, handCount: 2, intelligence: [] },
        { id: "b", alive: true, handCount: 2, intelligence: [] },
      ],
    });
    expect(factionBeliefs(createBotMemory(projection), projection).b).toEqual({
      军情: 0,
      潜伏: 1,
      特工: 0,
    });
  });

  it("keeps joint beliefs consistent with the exact faction distribution", () => {
    const projection = makeProjection({
      players: makeProjection().players.map((player) => {
        if (player.id === "c") return { ...player, faction: "军情" as Faction };
        if (player.id === "d") return { ...player, faction: "潜伏" as Faction };
        return player;
      }),
    });
    const beliefs = factionBeliefs(createBotMemory(projection), projection);

    expect(beliefs.b.军情).toBe(0);
    expect(beliefs.e.军情).toBe(0);
    expect(sumFaction(beliefs, "军情")).toBeCloseTo(2);
    expect(sumFaction(beliefs, "潜伏")).toBeCloseTo(2);
    expect(sumFaction(beliefs, "特工")).toBeCloseTo(1);
  });

  it("couples hidden-player beliefs instead of allowing impossible independent totals", () => {
    const projection = makeProjection({
      players: makeProjection().players.map((player) => {
        if (player.id === "c") return { ...player, faction: "军情" as Faction };
        if (player.id === "d") return { ...player, faction: "潜伏" as Faction };
        return player;
      }),
    });
    const memory = createBotMemory(projection);
    memory.evidence.b = { 军情: -8, 潜伏: -8, 特工: 8 };
    const beliefs = factionBeliefs(memory, projection);

    expect(beliefs.b.特工).toBeGreaterThan(0.99);
    expect(beliefs.e.潜伏).toBeGreaterThan(0.99);
    expect(beliefs.e.特工).toBeLessThan(0.01);
  });

  it("accepts matching intelligence and declines lethal black intelligence", () => {
    const helpful = makeProjection({
      phase: "transmitting",
      transmission: transmission(blueCard),
      legalActions: [{ type: "ACCEPT_INTELLIGENCE" }, { type: "DECLINE_INTELLIGENCE" }],
    });
    expect(chooseBotCommand(helpful, createBotMemory(helpful))?.type).toBe("ACCEPT_INTELLIGENCE");

    const lethal = makeProjection({
      phase: "transmitting",
      players: makeProjection().players.map((player) =>
        player.id === "bot" ? { ...player, intelligence: [blackCard, { ...blackCard, id: "another-black" }] } : player
      ),
      transmission: transmission(blackCard),
      legalActions: [{ type: "ACCEPT_INTELLIGENCE" }, { type: "DECLINE_INTELLIGENCE" }],
    });
    expect(chooseBotCommand(lethal, createBotMemory(lethal))?.type).toBe("DECLINE_INTELLIGENCE");
  });

  it("accepts safe true intelligence even when it does not match its faction", () => {
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [] },
      transmission: transmission(redDirectCard),
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        { type: "DECLINE_INTELLIGENCE" },
      ],
    });
    const memory = createBotMemory(projection);

    expect(receiptUtility(
      redDirectCard,
      "bot",
      projection,
      factionBeliefs(memory, projection),
    )).toBe(0);
    expect(chooseBotCommand(projection, memory, { random: () => 0.99 })?.type)
      .toBe("ACCEPT_INTELLIGENCE");
  });

  it("accepts black intelligence instead of forcing worse risk back to an ally", () => {
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [] },
      players: makeProjection().players.map((player) =>
        player.id === "b"
          ? {
              ...player,
              faction: "军情" as Faction,
              intelligence: [blackCard],
            }
          : player
      ),
      transmission: {
        ...transmission(blackCard),
        senderId: "b",
        method: "直达",
        intendedRecipientId: "bot",
        direction: undefined,
      },
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        { type: "DECLINE_INTELLIGENCE" },
      ],
    });

    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: TACTICAL_V7 },
    )?.type).toBe("DECLINE_INTELLIGENCE");
    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: TACTICAL_V8 },
    )?.type).toBe("ACCEPT_INTELLIGENCE");
  });

  it("declines direct intelligence when its forced return gives an ally a terminal win", () => {
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [] },
      players: makeProjection().players.map((player) =>
        player.id === "b"
          ? {
              ...player,
              faction: "军情" as Faction,
              intelligence: [blueCard, { ...blueCard, id: "ally-blue-2" }],
            }
          : player
      ),
      transmission: {
        ...transmission(blueDirectCard),
        senderId: "b",
        method: "直达",
        intendedRecipientId: "bot",
        direction: undefined,
      },
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        { type: "DECLINE_INTELLIGENCE" },
      ],
    });

    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: TACTICAL_V7 },
    )?.type).toBe("ACCEPT_INTELLIGENCE");
    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: TACTICAL_V8 },
    )?.type).toBe("DECLINE_INTELLIGENCE");
  });

  it("does not decline direct intelligence when its forced return lets an opponent win", () => {
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [] },
      players: makeProjection().players.map((player) =>
        player.id === "b"
          ? {
              ...player,
              faction: "潜伏" as Faction,
              intelligence: [redDirectCard, { ...redDirectCard, id: "opponent-red-2" }],
            }
          : player
      ),
      transmission: {
        ...transmission(redDirectCard),
        senderId: "b",
        method: "直达",
        intendedRecipientId: "bot",
        direction: undefined,
      },
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        { type: "DECLINE_INTELLIGENCE" },
      ],
    });

    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: TACTICAL_V8 },
    )?.type).toBe("ACCEPT_INTELLIGENCE");
  });

  it("treats a publicly observed decrypt followed by rejection as evidence of black intelligence", () => {
    const hiddenTransmission = {
      ...transmission(blackCard),
      intendedRecipientId: "c",
      card: undefined,
      faceUp: false,
    };
    const initial = makeProjection({
      phase: "transmitting",
      transmission: hiddenTransmission,
      auditLog: ["b开始以密电传递情报，当前接收者：c"],
    });
    const memory = createBotMemory(initial);
    const afterDecryptRejection = makeProjection({
      phase: "transmitting",
      players: makeProjection().players.map((player) =>
        player.id === "bot"
          ? { ...player, intelligence: [blackCard, { ...blackCard, id: "second-black" }] }
          : player
      ),
      transmission: { ...hiddenTransmission, intendedRecipientId: "bot" },
      auditLog: [
        "b开始以密电传递情报，当前接收者：c",
        "c完成破译",
        "c拒绝情报，当前接收者：bot",
      ],
      legalActions: [{ type: "ACCEPT_INTELLIGENCE" }, { type: "DECLINE_INTELLIGENCE" }],
    });

    expect(chooseBotCommand(afterDecryptRejection, memory)?.type).toBe("DECLINE_INTELLIGENCE");
    expect(memory.transmissionInference?.blackProbability).toBe(0.7);
  });

  it("preserves a marginal reaction card under faction uncertainty", () => {
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "特工", hand: [transferCard] },
      transmission: { ...transmission(blueCard), card: undefined, faceUp: false },
      legalActions: [
        { type: "PASS_REACTION" },
        { type: "PLAY_TRANSFER", cardId: transferCard.id as PhysicalCardId, targetId: "b" },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection), { policy: TACTICAL_V2 })?.type)
      .toBe("PLAY_TRANSFER");
    expect(chooseBotCommand(projection, createBotMemory(projection), { policy: TACTICAL_V3 })?.type)
      .toBe("PASS_REACTION");
    expect(chooseBotCommand(projection, createBotMemory(projection))?.type)
      .toBe("PASS_REACTION");
    expect(chooseBotCommand(projection, createBotMemory(projection), { policy: LOW_REACTION_CONSERVATION_POLICY })?.type)
      .toBe("PLAY_TRANSFER");
  });

  it("tactical-v7 preserves 危险情报 for an unclear target but uses it on a known opponent", () => {
    const chooseDangerous = (
      players: PlayerProjection["players"],
      policy: typeof TACTICAL_V6,
    ) => {
      const projection = makeProjection({
        phase: "initialized",
        own: { id: "bot", faction: "军情", hand: [dangerousCard, blueCard] },
        players,
        legalActions: [
          { type: "ENTER_TRANSMISSION_PHASE" },
          {
            type: "PLAY_DANGEROUS_INTELLIGENCE",
            cardId: dangerousCard.id as PhysicalCardId,
            targetId: "b",
          },
        ],
      });
      return chooseBotCommand(projection, createBotMemory(projection), { policy });
    };

    const unclearPlayers = makeProjection().players;
    const knownOpponentPlayers = unclearPlayers.map((player) =>
      player.id === "b"
        ? { ...player, faction: "潜伏" as Faction }
        : player
    );

    expect(chooseDangerous(unclearPlayers, TACTICAL_V6)?.type)
      .toBe("PLAY_DANGEROUS_INTELLIGENCE");
    expect(chooseDangerous(unclearPlayers, TACTICAL_V7)?.type)
      .toBe("ENTER_TRANSMISSION_PHASE");
    expect(chooseDangerous(knownOpponentPlayers, TACTICAL_V7)?.type)
      .toBe("PLAY_DANGEROUS_INTELLIGENCE");
  });

  it("tactical-v7 does not apply targeted-function conservation to 试探", () => {
    const projection = makeProjection({
      phase: "initialized",
      own: { id: "bot", faction: "军情", hand: [militaryDrawProbe, blueCard] },
      legalActions: [{
        type: "PLAY_PROBE",
        cardId: militaryDrawProbe.id as PhysicalCardId,
        targetId: "b",
      }],
    });

    const previous = chooseBotDecision(
      projection,
      createBotMemory(projection),
      { policy: TACTICAL_V6 },
    );
    const live = chooseBotDecision(
      projection,
      createBotMemory(projection),
      { policy: TACTICAL_V7 },
    );

    expect(live?.command.type).toBe("PLAY_PROBE");
    expect(live?.score).toBe(previous?.score);
  });

  it("incremental transfer scores only improvement over the current recipient", () => {
    const chooseTransfer = (currentIntelligence: PhysicalCard, ownIntelligence: PhysicalCard[]) => {
      const projection = makeProjection({
        phase: "transmitting",
        own: { id: "bot", faction: "军情", hand: [transferCard] },
        players: makeProjection().players.map((player) =>
          player.id === "bot" ? { ...player, intelligence: ownIntelligence } : player
        ),
        transmission: transmission(currentIntelligence),
        legalActions: [
          { type: "PASS_REACTION" },
          { type: "PLAY_TRANSFER", cardId: transferCard.id as PhysicalCardId, targetId: "b" },
        ],
      });
      return chooseBotCommand(projection, createBotMemory(projection), { policy: INCREMENTAL_TRANSFER_POLICY })?.type;
    };

    expect(chooseTransfer(blueCard, [])).toBe("PASS_REACTION");
    expect(chooseTransfer(blackCard, [blackCard, { ...blackCard, id: "second-black" }]))
      .toBe("PLAY_TRANSFER");
  });

  it("can combine incremental transfer with lure safeguards", () => {
    expect(GUARDED_INCREMENTAL_TRANSFER_POLICY).toMatchObject({
      incrementalTransfer: true,
      incrementalLure: true,
      lureRequiresLikelyAcceptance: true,
    });

    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [transferCard] },
      transmission: transmission(blueCard),
      legalActions: [
        { type: "PASS_REACTION" },
        { type: "PLAY_TRANSFER", cardId: transferCard.id as PhysicalCardId, targetId: "b" },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection), { policy: GUARDED_INCREMENTAL_TRANSFER_POLICY })?.type)
      .toBe("PASS_REACTION");
  });

  it("saves 锁定 when a 秘密下达 source is already likely to accept", () => {
    const lockCard = cardWhere((card) => card.name === "锁定");
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [lockCard] },
      transmission: {
        ...transmission(blueCard),
        senderId: "bot",
        intendedRecipientId: "b",
        receiptStage: "lockOffer",
      },
      legalActions: [
        { type: "PASS_LOCK" },
        { type: "PLAY_LOCK", cardId: lockCard.id as PhysicalCardId },
      ],
    });
    const memory = createBotMemory(projection);
    memory.evidence.b = { 军情: 100, 潜伏: -100, 特工: -100 };

    expect(chooseBotCommand(projection, structuredClone(memory), { policy: TACTICAL_V4 })?.type)
      .toBe("PLAY_LOCK");
    expect(chooseBotCommand(projection, structuredClone(memory), { policy: TACTICAL_V5 })?.type)
      .toBe("PASS_LOCK");
  });

  it("still uses 锁定 to force an unfavorable receipt onto an opponent", () => {
    const lockCard = cardWhere((card) => card.name === "锁定");
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [lockCard] },
      transmission: {
        ...transmission(blueCard),
        senderId: "bot",
        intendedRecipientId: "b",
        receiptStage: "lockOffer",
      },
      legalActions: [
        { type: "PASS_LOCK" },
        { type: "PLAY_LOCK", cardId: lockCard.id as PhysicalCardId },
      ],
    });
    const memory = createBotMemory(projection);
    memory.evidence.b = { 军情: -100, 潜伏: 100, 特工: -100 };

    expect(chooseBotCommand(projection, memory, { policy: TACTICAL_V5 })?.type)
      .toBe("PLAY_LOCK");
  });

  it("incremental lure requires the forced next recipient to improve the receipt", () => {
    const chooseLure = (currentFaction: Faction, nextFaction: Faction, policy = INCREMENTAL_LURE_POLICY) => {
      const projection = makeProjection({
        phase: "transmitting",
        own: { id: "bot", faction: "军情", hand: [lureCard] },
        players: makeProjection().players.map((player) =>
          player.id === "b"
            ? { ...player, faction: currentFaction }
            : player.id === "c"
              ? { ...player, faction: nextFaction }
              : player
        ),
        transmission: {
          ...transmission(blueMailCard),
          intendedRecipientId: "b",
          direction: "clockwise",
        },
        legalActions: [
          { type: "PASS_REACTION" },
          { type: "PLAY_LURE", cardId: lureCard.id as PhysicalCardId },
        ],
      });
      return chooseBotCommand(projection, createBotMemory(projection), { policy })?.type;
    };

    expect(chooseLure("军情", "潜伏")).toBe("PASS_REACTION");
    expect(chooseLure("潜伏", "军情")).toBe("PLAY_LURE");
    expect(chooseLure("军情", "潜伏", TACTICAL_V3)).toBe("PLAY_LURE");
  });

  it("live policy saves lure when the current recipient would reject voluntarily", () => {
    const chooseLure = (
      card: PhysicalCard,
      currentFaction: Faction,
      nextFaction: Faction,
      currentIntelligence: PhysicalCard[] = [],
    ) => {
      const projection = makeProjection({
        phase: "transmitting",
        own: { id: "bot", faction: "军情", hand: [lureCard] },
        players: makeProjection().players.map((player) =>
          player.id === "b"
            ? { ...player, faction: currentFaction, intelligence: currentIntelligence }
            : player.id === "c"
              ? { ...player, faction: nextFaction }
              : player
        ),
        transmission: {
          ...transmission(card),
          intendedRecipientId: "b",
          direction: "clockwise",
        },
        legalActions: [
          { type: "PASS_REACTION" },
          { type: "PLAY_LURE", cardId: lureCard.id as PhysicalCardId },
        ],
      });
      return chooseBotCommand(projection, createBotMemory(projection))?.type;
    };

    expect(chooseLure(blueMailCard, "潜伏", "军情")).toBe("PASS_REACTION");
    expect(chooseLure(blueMailCard, "军情", "潜伏")).toBe("PASS_REACTION");
    expect(chooseLure(redMailCard, "潜伏", "军情")).toBe("PLAY_LURE");
    expect(chooseLure(
      blackCard,
      "潜伏",
      "军情",
      [blackCard, { ...blackCard, id: "second-black" }],
    )).toBe("PASS_REACTION");
  });

  it("does not order a known opponent to transmit their game-winning color", () => {
    if (secretOrderCard.variant?.kind !== "secretOrder") throw new Error("Expected secret-order fixture");
    const projection = makeProjection({
      phase: "preTransmission",
      activePlayerId: "b",
      own: { id: "bot", faction: "潜伏", hand: [secretOrderCard] },
      players: makeProjection().players.map((player) => {
        if (player.id === "b") {
          return { ...player, intelligence: [blueCard, { ...blueCard, id: "second-blue" }] };
        }
        if (player.id === "c") return { ...player, alive: false, faction: "军情" as Faction };
        if (player.id === "d") return { ...player, alive: false, faction: "潜伏" as Faction };
        if (player.id === "e") return { ...player, alive: false, faction: "特工" as Faction };
        return player;
      }),
      pendingSecretOrder: {
        stage: "offering",
        targetPlayerId: "b",
        verifiedNoMatch: false,
      },
      legalActions: [
        { type: "PASS_REACTION" },
        ...(["听风", "看雨", "日落"] as const).map((word) => ({
          type: "PLAY_SECRET_ORDER" as const,
          cardId: secretOrderCard.id as PhysicalCardId,
          word,
        })),
      ],
    });

    const command = chooseBotCommand(projection, createBotMemory(projection));
    expect(command?.type).toBe("PLAY_SECRET_ORDER");
    if (command?.type !== "PLAY_SECRET_ORDER") throw new Error("Expected secret order");
    expect(secretOrderCard.variant.mapping[command.word]).not.toBe("蓝");
  });

  it("uses separation only for enough incremental improvement over the pending transfer target", () => {
    const chooseSeparation = (
      players: PlayerProjection["players"],
      pendingTargetId: string,
      proposedTargetId: string,
    ) => {
      const projection = makeProjection({
        phase: "transmitting",
        players,
        own: { id: "bot", faction: "军情", hand: [separationCard] },
        transmission: {
          ...transmission(blueDirectCard),
          pendingTransfer: { sourceCard: transferCard, targetId: pendingTargetId },
        },
        legalActions: [
          { type: "PASS_REACTION" },
          {
            type: "PLAY_SEPARATION",
            cardId: separationCard.id as PhysicalCardId,
            targetId: proposedTargetId,
          },
        ],
      });
      return chooseBotCommand(projection, createBotMemory(projection), { policy: TACTICAL_V2 });
    };
    const hiddenPlayers = makeProjection().players;
    const revealedPlayers = hiddenPlayers.map((player) =>
      player.id === "b"
        ? { ...player, faction: "军情" as Faction }
        : player.id === "c"
          ? { ...player, faction: "潜伏" as Faction }
          : player
    );

    expect(chooseSeparation(hiddenPlayers, "b", "c")?.type).toBe("PASS_REACTION");
    expect(chooseSeparation(revealedPlayers, "b", "c")?.type).toBe("PASS_REACTION");
    expect(chooseSeparation(revealedPlayers, "c", "b")?.type).toBe("PLAY_SEPARATION");
  });

  it("redirects 危险情报 toward an opponent and never toward itself", () => {
    const projection = makeProjection({
      own: { id: "bot", faction: "军情", hand: [separationCard] },
      players: makeProjection().players.map((player) =>
        player.id === "c"
          ? { ...player, faction: "军情" as Faction }
          : player.id === "d"
            ? { ...player, faction: "潜伏" as Faction }
            : player
      ),
      activeFunctionAction: {
        kind: "dangerousIntelligence",
        sourcePlayerId: "b",
        targetPlayerId: "c",
        stage: "reactions",
      },
      legalActions: [
        { type: "PASS_REACTION" },
        {
          type: "PLAY_FUNCTION_SEPARATION",
          cardId: separationCard.id as PhysicalCardId,
          targetId: "bot",
        },
        {
          type: "PLAY_FUNCTION_SEPARATION",
          cardId: separationCard.id as PhysicalCardId,
          targetId: "d",
        },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))).toMatchObject({
      type: "PLAY_FUNCTION_SEPARATION",
      targetId: "d",
    });

    const selfOnly = {
      ...projection,
      legalActions: projection.legalActions.filter((action) =>
        action.type === "PASS_REACTION" ||
        (action.type === "PLAY_FUNCTION_SEPARATION" && action.targetId === "bot")
      ),
    };
    expect(chooseBotCommand(selfOnly, createBotMemory(selfOnly))?.type).toBe("PASS_REACTION");
  });

  it("preserves swap for routine upgrades to intelligence the recipient will accept", () => {
    const players = makeProjection().players.map((player) =>
      player.id === "b" ? { ...player, faction: "军情" as Faction } : player
    );
    const chooseSwap = (
      currentCard: PhysicalCard,
      replacement: PhysicalCard,
      intelligence: PhysicalCard[] = [],
      committed = false,
    ) => {
      const projection = makeProjection({
        phase: "transmitting",
        players: players.map((player) =>
          player.id === "b" ? { ...player, intelligence } : player
        ),
        own: { id: "bot", faction: "军情", hand: [replacement] },
        transmission: {
          ...transmission(currentCard),
          intendedRecipientId: "b",
          recipientMustAccept: committed,
        },
        legalActions: [
          { type: "PASS_REACTION" },
          { type: "PLAY_SWAP", cardId: replacement.id as PhysicalCardId },
        ],
      });
      return {
        previous: chooseBotCommand(
          projection,
          createBotMemory(projection),
          { policy: TACTICAL_V5 },
        ),
        live: chooseBotCommand(
          projection,
          createBotMemory(projection),
          { policy: TACTICAL_V6 },
        ),
      };
    };

    expect(chooseSwap(redDirectCard, redSwapCard).live?.type).toBe("PASS_REACTION");
    expect(chooseSwap(blueDirectCard, redSwapCard).live?.type).toBe("PASS_REACTION");
    expect(chooseSwap(redDirectCard, blueSwapCard).previous?.type).toBe("PLAY_SWAP");
    expect(chooseSwap(redDirectCard, blueSwapCard).live?.type).toBe("PASS_REACTION");
    expect(chooseSwap(redDirectCard, blueSwapCard, [], true).live?.type)
      .toBe("PASS_REACTION");

    expect(
      chooseSwap(
        redDirectCard,
        blueSwapCard,
        [blueCard, { ...blueCard, id: "ally-second-blue" }],
        true,
      ).live?.type,
    ).toBe("PLAY_SWAP");
  });

  it("still swaps to prevent a committed enemy receipt from winning", () => {
    const projection = makeProjection({
      phase: "transmitting",
      players: makeProjection().players.map((player) =>
        player.id === "b"
          ? {
              ...player,
              faction: "军情" as Faction,
              intelligence: [
                blueCard,
                { ...blueCard, id: "enemy-second-blue" },
              ],
            }
          : player
      ),
      own: { id: "bot", faction: "潜伏", hand: [redSwapCard] },
      transmission: {
        ...transmission(blueDirectCard),
        intendedRecipientId: "b",
        recipientMustAccept: true,
      },
      legalActions: [
        { type: "PASS_REACTION" },
        { type: "PLAY_SWAP", cardId: redSwapCard.id as PhysicalCardId },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))).toMatchObject({
      type: "PLAY_SWAP",
      cardId: redSwapCard.id,
    });
  });

  it("still swaps its own receipt when the replacement materially improves it", () => {
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "潜伏", hand: [redSwapCard] },
      transmission: {
        ...transmission(blueDirectCard),
        intendedRecipientId: "bot",
        recipientMustAccept: true,
      },
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        { type: "PLAY_SWAP", cardId: redSwapCard.id as PhysicalCardId },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))).toMatchObject({
      type: "PLAY_SWAP",
      cardId: redSwapCard.id,
    });
  });

  it("uses a draw probe on a likely ally when its printed draw faction matches", () => {
    const projection = makeProjection({
      own: { id: "bot", faction: "军情", hand: [militaryDrawProbe] },
      players: makeProjection().players.map((player) =>
        player.id === "b"
          ? { ...player, faction: "军情" as Faction }
          : player.id === "c"
            ? { ...player, faction: "潜伏" as Faction }
            : player
      ),
      legalActions: [
        { type: "PLAY_PROBE", cardId: militaryDrawProbe.id as PhysicalCardId, targetId: "b" },
        { type: "PLAY_PROBE", cardId: militaryDrawProbe.id as PhysicalCardId, targetId: "c" },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))).toMatchObject({
      type: "PLAY_PROBE",
      targetId: "b",
    });
  });

  it("avoids giving a draw to a likely opponent and probes an opponent who must discard", () => {
    const projection = makeProjection({
      own: { id: "bot", faction: "军情", hand: [undercoverDrawProbe] },
      players: makeProjection().players.map((player) =>
        player.id === "b"
          ? { ...player, faction: "潜伏" as Faction }
          : player.id === "c"
            ? { ...player, faction: "特工" as Faction }
            : player
      ),
      legalActions: [
        { type: "PLAY_PROBE", cardId: undercoverDrawProbe.id as PhysicalCardId, targetId: "b" },
        { type: "PLAY_PROBE", cardId: undercoverDrawProbe.id as PhysicalCardId, targetId: "c" },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))).toMatchObject({
      type: "PLAY_PROBE",
      targetId: "c",
    });
  });

  it("assigns decisive tactical value to an immediate team win", () => {
    const projection = makeProjection({
      phase: "transmitting",
      players: makeProjection().players.map((player) =>
        player.id === "bot"
          ? { ...player, intelligence: [blueCard, { ...blueCard, id: "second-blue" }] }
          : player
      ),
      transmission: transmission(blueCard),
      legalActions: [{ type: "ACCEPT_INTELLIGENCE" }, { type: "DECLINE_INTELLIGENCE" }],
    });
    const memory = createBotMemory(projection);
    expect(receiptUtility(blueCard, "bot", projection, factionBeliefs(memory, projection))).toBeGreaterThan(9_000);
    expect(chooseBotCommand(projection, memory)?.type).toBe("ACCEPT_INTELLIGENCE");
    expect(chooseBotCommand(projection, createBotMemory(projection), { policy: TACTICAL_V3 })?.type)
      .toBe("ACCEPT_INTELLIGENCE");
  });

  it("accepts hidden sixth intelligence when it guarantees a 特工 victory", () => {
    const safeIntelligence = [
      ...PHYSICAL_DECK.filter((card) => card.color !== "黑").slice(0, 4),
      blackCard,
    ];
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "特工", hand: [counterCard] },
      players: makeProjection().players.map((player) =>
        player.id === "bot" ? { ...player, intelligence: safeIntelligence } : player
      ),
      transmission: { ...transmission(blueCard), card: undefined, faceUp: false },
      legalActions: [{ type: "ACCEPT_INTELLIGENCE" }, { type: "DECLINE_INTELLIGENCE" }],
    });
    const memory = createBotMemory(projection);
    expect(receiptUtility(undefined, "bot", projection, factionBeliefs(memory, projection)))
      .toBeGreaterThan(9_000);
    expect(chooseBotCommand(projection, memory, { policy: TACTICAL_V2, random: () => 0.99 })?.type)
      .toBe("ACCEPT_INTELLIGENCE");
  });

  it.each([
    ["blue", blueCard],
    ["red", redDirectCard],
    ["black", blackCard],
    ["hidden", undefined],
  ] as const)(
    "does not decline %s intelligence toward a known 特工 with a guaranteed sixth-card win",
    (_label, incomingCard) => {
      const safeAgentBoard = PHYSICAL_DECK
        .filter((card) => card.color !== "黑")
        .slice(0, 5);
      const projection = makeProjection({
        phase: "transmitting",
        players: makeProjection().players.map((player) =>
          player.id === "b"
            ? {
                ...player,
                faction: "特工" as Faction,
                intelligence: safeAgentBoard,
              }
            : player
        ),
        transmission: {
          ...transmission(incomingCard ?? blueCard),
          card: incomingCard,
          faceUp: Boolean(incomingCard),
          senderId: "b",
          intendedRecipientId: "bot",
        },
        legalActions: [
          { type: "ACCEPT_INTELLIGENCE" },
          { type: "DECLINE_INTELLIGENCE" },
        ],
      });

      expect(chooseBotCommand(projection, createBotMemory(projection))?.type)
        .toBe("ACCEPT_INTELLIGENCE");
    },
  );

  it("uses an available interception instead of passing a guaranteed sixth card to a known 特工", () => {
    const safeAgentBoard = PHYSICAL_DECK
      .filter((card) => card.color !== "黑")
      .slice(0, 5);
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [interceptCard] },
      players: makeProjection().players.map((player) =>
        player.id === "b"
          ? {
              ...player,
              faction: "特工" as Faction,
              intelligence: safeAgentBoard,
            }
          : player
      ),
      transmission: {
        ...transmission(blueCard),
        card: undefined,
        faceUp: false,
        senderId: "c",
        intendedRecipientId: "b",
      },
      reactionWindow: {
        kind: "intelligence",
        currentResponderId: "bot",
      },
      responseStack: [{
        id: "intelligence",
        kind: "intelligence",
        sourcePlayerId: "c",
        targetPlayerId: "b",
      }],
      legalActions: [
        { type: "PASS_REACTION" },
        {
          type: "PLAY_INTERCEPT",
          cardId: interceptCard.id as PhysicalCardId,
        },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))?.type)
      .toBe("PLAY_INTERCEPT");
  });

  it("does not use 破译 on visible intelligence that it originally transmitted", () => {
    const knownReturnedTransmission = {
      ...transmission(blueCard),
      senderId: "bot",
      intendedRecipientId: "bot",
      returnedToSender: true,
      card: blueCard,
      faceUp: false,
    };
    const reactionProjection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [decryptCard] },
      transmission: {
        ...knownReturnedTransmission,
        receiptStage: "reactions",
      },
      reactionWindow: {
        kind: "intelligence",
        currentResponderId: "bot",
      },
      responseStack: [{
        id: "intelligence",
        kind: "intelligence",
        sourcePlayerId: "bot",
        targetPlayerId: "bot",
      }],
      legalActions: [
        { type: "PASS_REACTION" },
        {
          type: "PLAY_DECRYPT",
          cardId: decryptCard.id as PhysicalCardId,
        },
      ],
    });
    expect(
      chooseBotCommand(
        reactionProjection,
        createBotMemory(reactionProjection),
      )?.type,
    ).toBe("PASS_REACTION");

    const finalProjection: PlayerProjection = {
      ...reactionProjection,
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        {
          type: "PLAY_DECRYPT",
          cardId: decryptCard.id as PhysicalCardId,
        },
      ],
    };
    expect(
      chooseBotCommand(finalProjection, createBotMemory(finalProjection))?.type,
    ).toBe("ACCEPT_INTELLIGENCE");
  });

  it("accepts safe intelligence instead of using 烧毁 first", () => {
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [burnCard] },
      players: makeProjection().players.map((player) =>
        player.id === "bot"
          ? { ...player, intelligence: [blackCard, secondBlackCard] }
          : player
      ),
      transmission: transmission(redDirectCard),
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        {
          type: "PLAY_BURN",
          cardId: burnCard.id as PhysicalCardId,
          targetPlayerId: "bot",
          targetIntelligenceCardId: blackCard.id as PhysicalCardId,
        },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))?.type)
      .toBe("ACCEPT_INTELLIGENCE");
  });

  it("uses 增援 before considering 烧毁 during its function-card phase", () => {
    const projection = makeProjection({
      phase: "initialized",
      own: {
        id: "bot",
        faction: "军情",
        hand: [reinforcementCard, burnCard],
      },
      players: makeProjection().players.map((player) =>
        player.id === "bot"
          ? { ...player, intelligence: [blackCard] }
          : player
      ),
      legalActions: [
        {
          type: "PLAY_REINFORCEMENT",
          cardId: reinforcementCard.id as PhysicalCardId,
        },
        {
          type: "PLAY_BURN",
          cardId: burnCard.id as PhysicalCardId,
          targetPlayerId: "bot",
          targetIntelligenceCardId: blackCard.id as PhysicalCardId,
        },
        { type: "ENTER_TRANSMISSION_PHASE" },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))?.type)
      .toBe("PLAY_REINFORCEMENT");
    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: BASELINE_V1 },
    )?.type).toBe("PLAY_REINFORCEMENT");
  });

  it("may use 烧毁 before a forced receipt when it prevents immediate black death", () => {
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [burnCard] },
      players: makeProjection().players.map((player) =>
        player.id === "bot"
          ? { ...player, intelligence: [blackCard, secondBlackCard] }
          : player
      ),
      transmission: {
        ...transmission(blackCard),
        transferredRecipientCommitted: true,
      },
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        {
          type: "PLAY_BURN",
          cardId: burnCard.id as PhysicalCardId,
          targetPlayerId: "bot",
          targetIntelligenceCardId: blackCard.id as PhysicalCardId,
        },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))?.type)
      .toBe("PLAY_BURN");
  });

  it("declines 直达 instead of spending 转移 to its original sender", () => {
    const twoBlack = [
      blackCard,
      { ...blackCard, id: "second-black" },
    ];
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [transferCard] },
      players: makeProjection().players.map((player) => {
        if (player.id === "bot") {
          return { ...player, intelligence: twoBlack };
        }
        if (player.id === "b") {
          return {
            ...player,
            faction: "潜伏" as Faction,
            intelligence: twoBlack.map((card, index) => ({
              ...card,
              id: `target-black-${index}`,
            })),
          };
        }
        return player;
      }),
      transmission: {
        ...transmission(blackCard),
        method: "直达",
        intendedRecipientId: "bot",
      },
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        { type: "DECLINE_INTELLIGENCE" },
        {
          type: "PLAY_TRANSFER",
          cardId: transferCard.id as PhysicalCardId,
          targetId: "b",
        },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))?.type)
      .toBe("DECLINE_INTELLIGENCE");
  });

  it("may still transfer 直达 to someone other than its original sender", () => {
    const twoBlack = [
      blackCard,
      { ...blackCard, id: "second-black" },
    ];
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [transferCard] },
      players: makeProjection().players.map((player) => {
        if (player.id === "bot") {
          return { ...player, intelligence: twoBlack };
        }
        if (player.id === "b") {
          return { ...player, faction: "军情" as Faction };
        }
        if (player.id === "c") {
          return {
            ...player,
            faction: "潜伏" as Faction,
            intelligence: twoBlack.map((card, index) => ({
              ...card,
              id: `other-target-black-${index}`,
            })),
          };
        }
        return player;
      }),
      transmission: {
        ...transmission(blackCard),
        method: "直达",
        senderId: "b",
        intendedRecipientId: "bot",
      },
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        { type: "DECLINE_INTELLIGENCE" },
        {
          type: "PLAY_TRANSFER",
          cardId: transferCard.id as PhysicalCardId,
          targetId: "c",
        },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))).toMatchObject({
      type: "PLAY_TRANSFER",
      targetId: "c",
    });
  });

  it("still permits 转移 for 直达 when refusal is forbidden", () => {
    const twoBlack = [
      blackCard,
      { ...blackCard, id: "second-black" },
    ];
    const projection = makeProjection({
      phase: "transmitting",
      own: { id: "bot", faction: "军情", hand: [transferCard] },
      players: makeProjection().players.map((player) =>
        player.id === "bot"
          ? { ...player, intelligence: twoBlack }
          : player.id === "b"
            ? {
                ...player,
                faction: "潜伏" as Faction,
                intelligence: twoBlack.map((card, index) => ({
                  ...card,
                  id: `forced-target-black-${index}`,
                })),
              }
            : player
      ),
      transmission: {
        ...transmission(blackCard),
        method: "直达",
        senderId: "bot",
        intendedRecipientId: "bot",
        returnedToSender: true,
      },
      legalActions: [
        { type: "ACCEPT_INTELLIGENCE" },
        {
          type: "PLAY_TRANSFER",
          cardId: transferCard.id as PhysicalCardId,
          targetId: "b",
        },
      ],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))?.type)
      .toBe("PLAY_TRANSFER");
  });

  it("counters hostile actions but preserves 识破 when the pending action helps", () => {
    const hostile = makeProjection({
      own: { id: "bot", faction: "军情", hand: [counterCard] },
      responseStack: [{
        id: "danger",
        kind: "card",
        sourcePlayerId: "b",
        targetPlayerId: "bot",
        cardName: "危险情报",
      }],
      legalActions: [
        { type: "PASS_REACTION" },
        { type: "PLAY_COUNTER", cardId: counterCard.id as PhysicalCardId, targetInteractionId: "danger" },
      ],
    });
    expect(chooseBotCommand(hostile, createBotMemory(hostile))?.type).toBe("PLAY_COUNTER");

    const helpful: PlayerProjection = {
      ...hostile,
      responseStack: [{
        id: "support",
        kind: "card" as const,
        sourcePlayerId: "bot",
        targetPlayerId: "bot",
        cardName: "增援" as const,
      }],
      legalActions: [
        { type: "PASS_REACTION" as const },
        { type: "PLAY_COUNTER" as const, cardId: counterCard.id as PhysicalCardId, targetInteractionId: "support" },
      ],
    };
    expect(chooseBotCommand(helpful, createBotMemory(helpful))?.type).toBe("PASS_REACTION");
    expect(chooseBotCommand(helpful, createBotMemory(helpful), { policy: BASELINE_V1 })?.type)
      .toBe("PLAY_COUNTER");
  });

  it("does not hand matching intelligence to a likely opposing faction", () => {
    const projection = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "军情", hand: [redDirectCard] },
      legalActions: [],
    });
    const memory = createBotMemory(projection);
    memory.evidence.b = { 军情: 5, 潜伏: -5, 特工: -5 };
    memory.evidence.c = { 军情: -5, 潜伏: 5, 特工: -5 };
    expect(chooseBotCommand(projection, memory)).toEqual({
      type: "START_TRANSMISSION",
      cardId: redDirectCard.id,
      method: "直达",
      targetId: "b",
    });
  });

  it("prefers concealed 危险情报 over unplanned visible 文本", () => {
    const projection = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "军情", hand: [dangerousCard] },
      legalActions: [],
    });

    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { random: () => 0 },
    )).toMatchObject({
      type: "START_TRANSMISSION",
      cardId: dangerousCard.id,
      method: "密电",
    });
  });

  it("uses visible 危险情报 when 锁定 can force a lethal first receipt", () => {
    const projection = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "军情", hand: [dangerousCard, lockCard] },
      players: makeProjection().players.map((player) =>
        player.id === "b"
          ? { ...player, intelligence: [blackCard, secondBlackCard] }
          : player
      ),
      legalActions: [],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))).toMatchObject({
      type: "START_TRANSMISSION",
      cardId: dangerousCard.id,
      method: "文本",
      direction: "clockwise",
    });
  });

  it("uses visible 危险情报 to set up a committed return-transfer", () => {
    const projection = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "军情", hand: [dangerousCard, transferCard] },
      players: makeProjection().players.map((player) =>
        player.id === "c"
          ? { ...player, intelligence: [blackCard, secondBlackCard] }
          : player
      ),
      legalActions: [],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))).toMatchObject({
      type: "START_TRANSMISSION",
      cardId: dangerousCard.id,
      method: "文本",
    });
  });

  it("uses visible 危险情报 for a safe 特工 return or winning 掉包 replacement", () => {
    const fiveTrueCards = Array.from({ length: 5 }, (_, index) => ({
      ...blueCard,
      id: `agent-true-${index}`,
    }));
    const agent = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "特工", hand: [dangerousCard] },
      players: makeProjection().players.map((player) =>
        player.id === "bot"
          ? { ...player, intelligence: fiveTrueCards }
          : player
      ),
      legalActions: [],
    });
    expect(chooseBotCommand(agent, createBotMemory(agent))).toMatchObject({
      type: "START_TRANSMISSION",
      cardId: dangerousCard.id,
      method: "文本",
    });

    const swapWin = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "军情", hand: [dangerousCard, blueSwapCard] },
      players: makeProjection().players.map((player) =>
        player.id === "bot"
          ? {
              ...player,
              intelligence: [
                blueCard,
                { ...blueCard, id: "second-own-blue" },
              ],
            }
          : player
      ),
      legalActions: [],
    });
    expect(chooseBotCommand(swapWin, createBotMemory(swapWin))).toMatchObject({
      type: "START_TRANSMISSION",
      cardId: dangerousCard.id,
      method: "文本",
    });
  });

  it("does not 直达 危险情报 to a five-card 特工 who will accept and win", () => {
    const fiveSafeCards = Array.from({ length: 5 }, (_, index) => ({
      ...blueCard,
      id: `target-safe-${index}`,
    }));
    const projection = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "军情", hand: [dangerousCard] },
      players: makeProjection().players.map((player) =>
        player.id === "e"
          ? {
              ...player,
              faction: "特工" as Faction,
              intelligence: fiveSafeCards,
            }
          : player.id === "bot"
            ? player
            : { ...player, alive: false }
      ),
      legalActions: [],
    });

    expect(chooseBotCommand(projection, createBotMemory(projection))).toMatchObject({
      type: "START_TRANSMISSION",
      cardId: dangerousCard.id,
      method: "密电",
    });
  });

  it("candidate-v14 values later recipients instead of only the adjacent player", () => {
    const routeCard: PhysicalCard = {
      ...bluePublicText,
      id: "route-aware-public-text",
      color: "红蓝",
      circle: true,
    };
    const twoRed = [
      redDirectCard,
      { ...redDirectCard, id: "route-second-red" },
    ];
    const projection = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "潜伏", hand: [routeCard] },
      players: makeProjection().players.map((player) => {
        if (player.id === "b") {
          return { ...player, faction: "军情" as Faction };
        }
        if (player.id === "c") {
          return {
            ...player,
            faction: "潜伏" as Faction,
            intelligence: twoRed,
          };
        }
        if (player.id === "d") {
          return { ...player, faction: "军情" as Faction };
        }
        if (player.id === "e") {
          return { ...player, faction: "特工" as Faction };
        }
        return player;
      }),
      legalActions: [],
    });

    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: TACTICAL_V6, random: () => 0 },
    )).toMatchObject({
      type: "START_TRANSMISSION",
      direction: "counterclockwise",
    });
    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: CANDIDATE_V14, random: () => 0 },
    )).toMatchObject({
      type: "START_TRANSMISSION",
      direction: "clockwise",
    });
    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: CANDIDATE_V15, random: () => 0 },
    )).toMatchObject({
      type: "START_TRANSMISSION",
      direction: "clockwise",
    });
    expect(chooseBotCommand(
      projection,
      createBotMemory(projection),
      { policy: CANDIDATE_V16, random: () => 0 },
    )).toMatchObject({
      type: "START_TRANSMISSION",
      direction: "clockwise",
    });
  });

  it("prioritizes its own immediate team win over giving an opponent theirs", () => {
    const projection = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "军情", hand: [blueDirectCard, redDirectCard] },
      players: makeProjection().players.map((player) => {
        if (player.id === "b") return { ...player, intelligence: [blueCard, { ...blueCard, id: "ally-blue-2" }] };
        if (player.id === "c") return { ...player, intelligence: [redDirectCard, { ...redDirectCard, id: "enemy-red-2" }] };
        return player;
      }),
      legalActions: [],
    });
    const memory = createBotMemory(projection);
    memory.evidence.b = { 军情: 8, 潜伏: -8, 特工: -8 };
    memory.evidence.c = { 军情: -8, 潜伏: 8, 特工: -8 };
    expect(chooseBotCommand(projection, memory)).toMatchObject({
      type: "START_TRANSMISSION",
      cardId: blueDirectCard.id,
      targetId: "b",
    });
  });

  it("obeys a visible secret-order color when synthesizing transmission", () => {
    const projection = makeProjection({
      phase: "preTransmission",
      own: { id: "bot", faction: "军情", hand: [blueDirectCard, redDirectCard] },
      pendingSecretOrder: {
        stage: "selection",
        targetPlayerId: "bot",
        sourcePlayerId: "b",
        word: "看雨",
        requiredColor: "红",
        verifiedNoMatch: false,
      },
      legalActions: [],
    });
    expect(chooseBotCommand(projection, createBotMemory(projection))).toMatchObject({
      type: "START_TRANSMISSION",
      cardId: redDirectCard.id,
    });
  });

  it("supports reproducible random tie breaking", () => {
    const projection = makeProjection({
      legalActions: [{ type: "PASS_REACTION" }, { type: "PASS_REACTION" }],
    });
    const first = createSeededBotRandom(1234);
    const second = createSeededBotRandom(1234);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
    expect(chooseBotCommand(projection, createBotMemory(projection), { random: createSeededBotRandom(9) }))
      .toEqual({ type: "PASS_REACTION" });
  });
});

function makeProjection(overrides: Partial<PlayerProjection> = {}): PlayerProjection {
  const ids = ["bot", "b", "c", "d", "e"];
  const base: PlayerProjection = {
    mode: "standard",
    phase: "initialized",
    activePlayerId: "bot",
    seatOrder: ids,
    drawPileCount: 50,
    publicDiscard: [],
    players: ids.map((id) => ({ id, alive: true, handCount: id === "bot" ? 2 : 2, intelligence: [] })),
    own: { id: "bot", faction: "军情", hand: [blueCard, redDirectCard] },
    auditLog: [],
    privateNotices: [],
    responseStack: [],
    legalActions: [],
  };
  const projection = { ...base, ...overrides };
  if (
    projection.phase === "preTransmission" &&
    projection.pendingSecretOrder?.stage !== "offering" &&
    projection.activePlayerId === projection.own.id &&
    projection.legalActions.length === 0
  ) {
    const requiredColor = projection.pendingSecretOrder?.requiredColor;
    const orderApplies = requiredColor &&
      !projection.pendingSecretOrder?.verifiedNoMatch;
    const targets = projection.players.filter(
      (player) => player.alive && player.id !== projection.own.id,
    );
    const transmissionActions: PlayerProjection["legalActions"] = [];
    for (const card of projection.own.hand) {
      if (
        orderApplies &&
        card.color !== requiredColor &&
        !(card.color === "红蓝" && requiredColor !== "黑")
      ) {
        continue;
      }
      const methods = card.transmission === "任意"
        ? (["密电", "文本", "直达"] as const)
        : [card.transmission];
      for (const method of methods) {
        if (method === "直达") {
          for (const target of targets) {
            transmissionActions.push({
              type: "START_TRANSMISSION",
              cardId: card.id as PhysicalCardId,
              method,
              targetId: target.id,
            });
          }
          continue;
        }
        if (card.circle && projection.mode !== "duel") {
          for (const direction of ["clockwise", "counterclockwise"] as const) {
            transmissionActions.push({
              type: "START_TRANSMISSION",
              cardId: card.id as PhysicalCardId,
              method,
              direction,
            });
          }
          continue;
        }
        transmissionActions.push({
          type: "START_TRANSMISSION",
          cardId: card.id as PhysicalCardId,
          method,
        });
      }
    }
    projection.legalActions = transmissionActions;
  }
  return projection;
}

function transmission(card: PhysicalCard): NonNullable<PlayerProjection["transmission"]> {
  return {
    senderId: "b",
    method: card.transmission === "任意" ? "直达" : card.transmission,
    intendedRecipientId: "bot",
    card,
    returnedToSender: false,
    transferredRecipientCommitted: false,
    receiptStage: "decision",
    locked: false,
    faceUp: true,
  };
}

function cardWhere(predicate: (card: PhysicalCard) => boolean): PhysicalCard {
  const card = PHYSICAL_DECK.find(predicate);
  if (!card) throw new Error("Expected physical card fixture");
  return card;
}

function sumFaction(
  beliefs: Record<string, { 军情: number; 潜伏: number; 特工: number }>,
  faction: Faction,
): number {
  return Object.values(beliefs).reduce((sum, belief) => sum + belief[faction], 0);
}
