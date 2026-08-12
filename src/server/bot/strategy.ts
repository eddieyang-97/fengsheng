import { PHYSICAL_DECK, type Faction, type PhysicalCard, type PhysicalCardId, type SingleColor } from "../../game/cards";
import { factionsForPlayerCount, type ActiveFunctionKind, type Direction, type PlayerProjection } from "../../game/engine";
import type { GameCommand } from "../game-session";

const FACTIONS = ["军情", "潜伏", "特工"] as const satisfies readonly Faction[];

export type BotRandom = () => number;
export type LegalAction = PlayerProjection["legalActions"][number];
type StartTransmissionAction = Extract<
  LegalAction,
  { type: "START_TRANSMISSION" }
>;
export interface BotPolicy {
  readonly id: string;
  readonly beliefModel: "independent" | "exact";
  readonly scoring: "baseline" | "tactical";
  readonly burnBase: number;
  /** Strength of the confidence-adjusted cost for spending optional reaction cards. */
  readonly reactionConservation: number;
  /** Score transfer as improvement over leaving the intelligence with its current recipient. */
  readonly incrementalTransfer: boolean;
  /** Score 转移 as its absolute forced receipt, letting the chooser compare free alternatives. */
  readonly transferAgainstBestFreeAlternative: boolean;
  /** Optional extra cost for spending 转移 while retaining its live tactical score model. */
  readonly transferOpportunityCost?: number;
  /** How much downstream routing to include when scoring a decline. */
  readonly declineRouting: "flat" | "forced-return" | "acceptance-weighted";
  /** Score 调虎离山 by the receipt change caused by forcing the current recipient to decline. */
  readonly incrementalLure: boolean;
  /** Avoid 调虎离山 when the current recipient is already likely to decline voluntarily. */
  readonly lureRequiresLikelyAcceptance: boolean;
  /** Do not assume the current recipient can decline when receipt is already committed. */
  readonly lureRespectsCommittedRecipient?: boolean;
  /** Avoid 锁定 when the current recipient is already likely to accept voluntarily. */
  readonly lockRequiresLikelyDecline: boolean;
  /** Score 危险情报 transmission methods by visibility, return risk, and concrete combos. */
  readonly methodAwareDangerousTransmission: boolean;
  /** Preserve 掉包 when an accepting recipient would receive only a routine upgrade. */
  readonly conservativeSwap: boolean;
  /** Score 掉包 by its complete replacement outcome at the recipient's final decision. */
  readonly finalReceiptSwapScoring: boolean;
  /** Evaluate both sides of the hand exchange when redirecting 公开文本 with 离间. */
  readonly publicTextExchangeScoring: boolean;
  /** Treat 公开文本 as hostile except for matching-color handoffs to the immediate upstream player. */
  readonly publicTextIntentScoring: boolean;
  /** Strongly prefer safe receipt after a 特工 has accumulated four true intelligence. */
  readonly agentFourTrueReceiptPriority: boolean;
  /** Experimental extra cost for a 特工 voluntarily accepting known black intelligence. */
  readonly agentKnownBlackReceiptPenalty?: number;
  /** Estimate how each other player perceives this bot from public identity evidence. */
  readonly secondOrderIdentityModel: boolean;
  /** Infer sender opposition and perceived alliances from accepted real 直达 color denial. */
  readonly directColorDenialInference: boolean;
  /** Reinforce affiliation when a +1 试探 sender deliberately reverses 密电 toward this bot. */
  readonly supportiveReverseMailInference: boolean;
  /** Prefer concentrating matching real intelligence on a trusted ally already ahead of this bot. */
  readonly alliedProgressConcentration: boolean;
  /** Preserve 秘密下达 when the target already has strong affinity toward this bot. */
  readonly avoidRedundantAllySecretOrder: boolean;
  /** Evaluate a face-down 试探 from its hidden-variant prior and the prober's affinity. */
  readonly probeCounterAffinityScoring: boolean;
  /** Additional utility assigned to an incoming hidden 试探 per unit of source affinity. */
  readonly incomingProbeAffinityWeight?: number;
  /** Extra opportunity cost for spending 识破 on an incoming hidden 试探. */
  readonly incomingProbeCounterCost?: number;
  /** Compare identity announcement with the exact expected random-card transfer. */
  readonly probeIdentityChoiceScoring: boolean;
  /** Score 截获 by both its forced receipt and the receipt denied to the current target. */
  readonly incrementalInterceptScoring: boolean;
  /** Compare 截获 with the committed receipt it replaces after 转移. */
  readonly committedTransferInterceptScoring?: boolean;
  /** Never immediately undo this bot's own unchanged 转移 by playing 截获. */
  readonly avoidOwnTransferInterceptUndo?: boolean;
  /** Fraction of the held 截获 card's transmission value charged when spending it. */
  readonly interceptOpportunityCostFactor: number;
  /** Evaluate the expected receipt across the complete passive transmission route. */
  readonly routeAwareTransmission: boolean;
  /** Allow route evaluation to change which physical hand card is transmitted. */
  readonly routeAwareTransmissionCardChoice: boolean;
  /** Allow route evaluation to change the selected card's transmission method. */
  readonly routeAwareTransmissionMethodChoice: boolean;
  /** Preserve targeted function cards unless faction confidence supports spending them. */
  readonly targetedFunctionConservation: boolean;
  /** Which visible direct transmissions count as intentional evidence when this bot is the target. */
  readonly directTransmissionEvidence: "none" | "black-only" | "all";
  /** Multiplier for intentional direct-transmission evidence. */
  readonly directTransmissionEvidenceStrength: number;
  /** Evidence strength for faction opposition from a knowingly lethal, unredirected lock. */
  readonly lethalLockEvidence: number;
  /** Hidden-receipt penalty retained after another player redirects 锁定 with 离间. */
  readonly redirectedLockReceiptPenalty?: number;
  /** Extra value for countering a hidden 锁定 aimed at this bot. */
  readonly hiddenSelfLockCounterBonus?: number;
  /** Minimum visible black intelligence already held before applying that bonus. */
  readonly hiddenSelfLockCounterMinBlack?: number;
  /** Largest table size where the hidden self-lock counter bonus applies. */
  readonly hiddenSelfLockCounterMaxPlayers?: number;
  /** How to score inspected 危险情报 discard choices. */
  readonly dangerousDiscardStrategy: "random" | "color-denial" | "color-then-function" | "expected-denial" | "target-value";
  /** Learn weak faction evidence from completed voluntary actions that help or harm this bot. */
  readonly inferResolvedActionAffinity: boolean;
  /** Scale sender-affinity evidence from a resolved 试探 that changes this bot's hand value. */
  readonly resolvedProbeAffinityScale?: number;
  /** Discount harmful-试探 evidence when its sender may not know this bot's faction. */
  readonly resolvedProbeIdentityAwarenessWeighting?: boolean;
  /** Evidence weight for attacker affinity inferred from a chosen 危险情报 discard. */
  readonly dangerousDiscardChoiceEvidence?: number;
  /** Weight known inspected cards when selecting a 危险情报 target. */
  readonly knownHandDangerousTargetWeight?: number;
  /** Avoid a 秘密下达 declaration known to match no card, which would lift the restriction. */
  readonly avoidKnownSecretOrderNoMatch?: boolean;
  /** Weight exact inspected-hand knowledge when selecting a 秘密下达 color. */
  readonly knownHandSecretOrderWeight?: number;
  /** Weight a forced real-color transmission from the bot's immediate upstream ally. */
  readonly upstreamSecretOrderSupportWeight?: number;
  /** Which offensive target choices should prefer the more dangerous opposing faction. */
  readonly factionThreatTargeting: "none" | "dangerous" | "probe" | "all";
  /** Preserve 秘密下达 when its target has too few cards for meaningful color control. */
  readonly avoidSecretOrderSmallHand: boolean;
  /** Posterior estimate used after a player resolves 破译 and then rejects the intelligence. */
  readonly decryptRejectionBlackProbability?: number;
}
export const BASELINE_V1: BotPolicy = {
  id: "baseline-v1",
  beliefModel: "independent",
  scoring: "baseline",
  burnBase: 7,
  reactionConservation: 0,
  incrementalTransfer: false,
  transferAgainstBestFreeAlternative: false,
  declineRouting: "flat",
  incrementalLure: false,
  lureRequiresLikelyAcceptance: false,
  lockRequiresLikelyDecline: false,
  methodAwareDangerousTransmission: false,
  conservativeSwap: false,
  finalReceiptSwapScoring: false,
  publicTextExchangeScoring: false,
  publicTextIntentScoring: false,
  agentFourTrueReceiptPriority: false,
  secondOrderIdentityModel: false,
  directColorDenialInference: false,
  supportiveReverseMailInference: false,
  alliedProgressConcentration: false,
  avoidRedundantAllySecretOrder: false,
  probeCounterAffinityScoring: false,
  probeIdentityChoiceScoring: false,
  incrementalInterceptScoring: false,
  interceptOpportunityCostFactor: 0,
  routeAwareTransmission: false,
  routeAwareTransmissionCardChoice: false,
  routeAwareTransmissionMethodChoice: false,
  targetedFunctionConservation: false,
  directTransmissionEvidence: "none",
  directTransmissionEvidenceStrength: 1,
  lethalLockEvidence: 0,
  dangerousDiscardStrategy: "random",
  inferResolvedActionAffinity: false,
  factionThreatTargeting: "none",
  avoidSecretOrderSmallHand: false,
};
export const TACTICAL_V2: BotPolicy = {
  id: "tactical-v2",
  beliefModel: "independent",
  scoring: "tactical",
  burnBase: 7,
  reactionConservation: 0,
  incrementalTransfer: false,
  transferAgainstBestFreeAlternative: false,
  declineRouting: "flat",
  incrementalLure: false,
  lureRequiresLikelyAcceptance: false,
  lockRequiresLikelyDecline: false,
  methodAwareDangerousTransmission: false,
  conservativeSwap: false,
  finalReceiptSwapScoring: false,
  publicTextExchangeScoring: false,
  publicTextIntentScoring: false,
  agentFourTrueReceiptPriority: false,
  secondOrderIdentityModel: false,
  directColorDenialInference: false,
  supportiveReverseMailInference: false,
  alliedProgressConcentration: false,
  avoidRedundantAllySecretOrder: false,
  probeCounterAffinityScoring: false,
  probeIdentityChoiceScoring: false,
  incrementalInterceptScoring: false,
  interceptOpportunityCostFactor: 0,
  routeAwareTransmission: false,
  routeAwareTransmissionCardChoice: false,
  routeAwareTransmissionMethodChoice: false,
  targetedFunctionConservation: false,
  directTransmissionEvidence: "none",
  directTransmissionEvidenceStrength: 1,
  lethalLockEvidence: 0,
  dangerousDiscardStrategy: "random",
  inferResolvedActionAffinity: false,
  factionThreatTargeting: "none",
  avoidSecretOrderSmallHand: false,
};
export const TACTICAL_V3: BotPolicy = {
  id: "tactical-v3",
  beliefModel: "exact",
  scoring: "tactical",
  burnBase: 4,
  reactionConservation: 1.5,
  incrementalTransfer: false,
  transferAgainstBestFreeAlternative: false,
  declineRouting: "flat",
  incrementalLure: false,
  lureRequiresLikelyAcceptance: false,
  lockRequiresLikelyDecline: false,
  methodAwareDangerousTransmission: false,
  conservativeSwap: false,
  finalReceiptSwapScoring: false,
  publicTextExchangeScoring: false,
  publicTextIntentScoring: false,
  agentFourTrueReceiptPriority: false,
  secondOrderIdentityModel: false,
  directColorDenialInference: false,
  supportiveReverseMailInference: false,
  alliedProgressConcentration: false,
  avoidRedundantAllySecretOrder: false,
  probeCounterAffinityScoring: false,
  probeIdentityChoiceScoring: false,
  incrementalInterceptScoring: false,
  interceptOpportunityCostFactor: 0,
  routeAwareTransmission: false,
  routeAwareTransmissionCardChoice: false,
  routeAwareTransmissionMethodChoice: false,
  targetedFunctionConservation: false,
  directTransmissionEvidence: "none",
  directTransmissionEvidenceStrength: 1,
  lethalLockEvidence: 0,
  dangerousDiscardStrategy: "random",
  inferResolvedActionAffinity: false,
  factionThreatTargeting: "none",
  avoidSecretOrderSmallHand: false,
};
export const TACTICAL_V4: BotPolicy = {
  ...TACTICAL_V3,
  id: "tactical-v4",
  incrementalLure: true,
  lureRequiresLikelyAcceptance: true,
};
export const TACTICAL_V5: BotPolicy = {
  ...TACTICAL_V4,
  id: "tactical-v5",
  lockRequiresLikelyDecline: true,
};
export const TACTICAL_V6: BotPolicy = {
  ...TACTICAL_V5,
  id: "tactical-v6",
  methodAwareDangerousTransmission: true,
  conservativeSwap: true,
};
export const TACTICAL_V7: BotPolicy = {
  ...TACTICAL_V6,
  id: "tactical-v7",
  targetedFunctionConservation: true,
};
export const TACTICAL_V8: BotPolicy = {
  ...TACTICAL_V7,
  id: "tactical-v8",
  declineRouting: "forced-return",
};
export const TACTICAL_V9: BotPolicy = {
  ...TACTICAL_V8,
  id: "tactical-v9",
  directTransmissionEvidence: "black-only",
  lethalLockEvidence: 2.5,
  dangerousDiscardStrategy: "color-denial",
};
export const TACTICAL_V10: BotPolicy = {
  ...TACTICAL_V8,
  id: "tactical-v10",
  dangerousDiscardStrategy: "color-then-function",
};
export const TACTICAL_V11: BotPolicy = {
  ...TACTICAL_V10,
  id: "tactical-v11",
  finalReceiptSwapScoring: true,
};
export const TACTICAL_V12: BotPolicy = {
  ...TACTICAL_V11,
  id: "tactical-v12",
  factionThreatTargeting: "dangerous",
  avoidSecretOrderSmallHand: true,
};
export const TACTICAL_V13: BotPolicy = {
  ...TACTICAL_V12,
  id: "tactical-v13",
  publicTextIntentScoring: true,
};
export const TACTICAL_V14: BotPolicy = {
  ...TACTICAL_V13,
  id: "tactical-v14",
  agentFourTrueReceiptPriority: true,
};
export const TACTICAL_V15: BotPolicy = {
  ...TACTICAL_V14,
  id: "tactical-v15",
  secondOrderIdentityModel: true,
};
export const TACTICAL_V16: BotPolicy = {
  ...TACTICAL_V15,
  id: "tactical-v16",
  directColorDenialInference: true,
};
export const TACTICAL_V17: BotPolicy = {
  ...TACTICAL_V16,
  id: "tactical-v17",
  supportiveReverseMailInference: true,
};
export const TACTICAL_V18: BotPolicy = {
  ...TACTICAL_V17,
  id: "tactical-v18",
  alliedProgressConcentration: true,
};
export const TACTICAL_V19: BotPolicy = {
  ...TACTICAL_V18,
  id: "tactical-v19",
  avoidRedundantAllySecretOrder: true,
};
export const TACTICAL_V20: BotPolicy = {
  ...TACTICAL_V19,
  id: "tactical-v20",
  probeCounterAffinityScoring: true,
  incomingProbeCounterCost: 8,
};
export const TACTICAL_V21: BotPolicy = {
  ...TACTICAL_V20,
  id: "tactical-v21",
  avoidOwnTransferInterceptUndo: true,
};
export const TACTICAL_V22: BotPolicy = {
  ...TACTICAL_V21,
  id: "tactical-v22",
  avoidKnownSecretOrderNoMatch: true,
};
export const TACTICAL_V23: BotPolicy = {
  ...TACTICAL_V22,
  id: "tactical-v23",
  upstreamSecretOrderSupportWeight: 1,
};
export const TACTICAL_V24: BotPolicy = {
  ...TACTICAL_V23,
  id: "tactical-v24",
  lureRespectsCommittedRecipient: true,
};
export const TACTICAL_V25: BotPolicy = {
  ...TACTICAL_V24,
  id: "tactical-v25",
  redirectedLockReceiptPenalty: 5,
};
export const TACTICAL_V26: BotPolicy = {
  ...TACTICAL_V25,
  id: "tactical-v26",
  hiddenSelfLockCounterBonus: 2,
  hiddenSelfLockCounterMinBlack: 2,
};
export const TACTICAL_V27: BotPolicy = {
  ...TACTICAL_V26,
  id: "tactical-v27",
  hiddenSelfLockCounterMaxPlayers: 6,
};
export const LIVE_BOT_POLICY: BotPolicy = TACTICAL_V27;

const PASS_REACTION_SCORE = 5;
const SEPARATION_CARD_COST = 1;
const AGENT_FOUR_TRUE_RECEIPT_BONUS = 60;
const SWAP_CARD_COST_FACTOR = 0.6;
const SETTLED_RECEIPT_SWAP_THRESHOLD = 40;
const SECRET_ORDER_CARD_COST = 4;
const DECRYPT_REJECTION_BLACK_PROBABILITY = 0.7;
const HOSTILE_DIRECT_BLACK_PROBABILITY = 0.62;
const ALLIED_DIRECT_BLACK_DISCOUNT = 0.36;
const SUPPORTIVE_PROBE_MAIL_BLACK_PROBABILITY = 0.22;
const LIMITED_HAND_SUPPORTIVE_MAIL_BLACK_PROBABILITY = 0.4;
const SUPPORTIVE_REVERSE_MAIL_FACTION_EVIDENCE = 0.65;
const HIGH_AFFINITY_THRESHOLD = 0.5;
const REVERSE_MAIL_BLACK_DISCOUNT = 0.113;
const LIMITED_HAND_REVERSE_MAIL_BLACK_DISCOUNT = 0.033;
const ALLIED_PROGRESS_CONCENTRATION_BONUS = 12;
const REDUNDANT_ALLY_SECRET_ORDER_COST = 8;
const SECRET_ORDER_COLOR_EVIDENCE = 0.45;
const DEFINITIVE_FACTION_EVIDENCE = 100;
const TERMINAL_LOSS_UTILITY = -1_000;

interface PublicObservation {
  auditLength: number;
  transmission?: {
    signature: string;
    startAuditIndex: number;
    senderId: string;
    targetId: string;
    method: Exclude<PhysicalCard["transmission"], "任意">;
    direction?: Direction;
    card?: PhysicalCard;
  };
  functionAction?: {
    signature: string;
    kind: Exclude<ActiveFunctionKind, "probeIdentity" | "probeDrawDiscard"> | "probe";
    sourceId: string;
    targetId: string;
    redirected: boolean;
  };
  secretOrder?: {
    signature: string;
    sourceId: string;
    targetId: string;
    requiredColor: SingleColor;
  };
  players: Record<string, {
    alive: boolean;
    faction?: Faction;
    handCount: number;
    intelligence: PhysicalCard[];
  }>;
  ownHand: PhysicalCard[];
}

export interface FactionBelief {
  军情: number;
  潜伏: number;
  特工: number;
}

export interface BotMemory {
  readonly botId: string;
  /** Additive evidence, retained between decisions. It contains no hidden state. */
  evidence: Record<string, FactionBelief>;
  /** Estimated faction belief that each observer assigns to this bot. Public information only. */
  perceivedIdentityByPlayer: Record<string, FactionBelief>;
  /** Players whose resolved +1 试探 on this bot publicly signaled likely cooperation. */
  supportiveProbeByPlayer: Record<string, boolean>;
  /** Estimated public relationship: positive means observer likely sees subject as an ally. */
  perceivedAllianceByPlayer: Record<string, Record<string, number>>;
  /** Cards still known with certainty in inspected opponents' hands. */
  knownHands: Record<string, {
    cards: PhysicalCard[];
    unknownCount: number;
    handCount: number;
  }>;
  /** Number of private notices already incorporated into knownHands. */
  observedPrivateNoticeCount: number;
  transmissionInference?: {
    signature: string;
    initialTargetId: string;
    completedDecryptors: string[];
    knownCard?: PhysicalCard;
    blackProbability?: number;
    forcedColor?: SingleColor;
    forcedByPlayerId?: string;
    replaced: boolean;
    lock?: {
      originalTargetId: string;
      redirected: boolean;
    };
  };
  pendingLockInference?: {
    sourceId: string;
    targetId: string;
    resolved: boolean;
    redirected: boolean;
    swapped: boolean;
  };
  previous?: PublicObservation;
}

export interface BotDecision {
  command: GameCommand;
  score: number;
  reason: string;
}

export interface BotDecisionOptions {
  /** Versioned decision policy. Live bots use LIVE_BOT_POLICY unless explicitly overridden. */
  policy?: BotPolicy;
  /** Inject a seeded generator for reproducible games. Defaults to deterministic ordering. */
  random?: BotRandom;
  /** Commands rejected against the unchanged authoritative state. */
  excludedCommands?: readonly GameCommand[];
  excludedTransmissionCardIds?: readonly PhysicalCardId[];
}

interface IntelligenceCounts {
  red: number;
  blue: number;
  black: number;
  physical: number;
}

export function createSeededBotRandom(seed: number): BotRandom {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

export function createBotMemory(
  projection: PlayerProjection,
  policy: BotPolicy = LIVE_BOT_POLICY,
): BotMemory {
  const memory: BotMemory = {
    botId: projection.own.id,
    evidence: {},
    perceivedIdentityByPlayer: {},
    supportiveProbeByPlayer: {},
    perceivedAllianceByPlayer: {},
    knownHands: {},
    observedPrivateNoticeCount: 0,
  };
  observeBotProjection(memory, projection, policy);
  return memory;
}

/**
 * Updates private bot beliefs from public board changes and explicitly revealed
 * factions. It deliberately does not inspect engine state or other hands.
 */
export function observeBotProjection(
  memory: BotMemory,
  projection: PlayerProjection,
  policy: BotPolicy = LIVE_BOT_POLICY,
): void {
  if (memory.botId !== projection.own.id) {
    throw new Error("Bot memory cannot observe another player's private projection");
  }

  const knownTransmissionCard = observeKnownHands(memory, projection);

  for (const player of projection.players) {
    const evidence = memory.evidence[player.id] ??= emptyBelief();
    const previous = memory.previous?.players[player.id];
    if (player.faction) {
      evidence.军情 = player.faction === "军情" ? 100 : -100;
      evidence.潜伏 = player.faction === "潜伏" ? 100 : -100;
      evidence.特工 = player.faction === "特工" ? 100 : -100;
      continue;
    }

    if (previous) {
      const knownIds = new Set(previous.intelligence.map((card) => card.id));
      for (const card of player.intelligence) {
        if (knownIds.has(card.id)) continue;
        // Receipt is useful evidence, but deliberately weak: receipt may have
        // been locked, intercepted, transferred, or forced.
        if (card.color === "蓝") evidence.军情 += 0.8;
        else if (card.color === "红") evidence.潜伏 += 0.8;
        else if (card.color === "红蓝") {
          evidence.军情 += 0.45;
          evidence.潜伏 += 0.45;
        } else {
          evidence.特工 += 0.2;
        }
      }
    }

    if (!projection.winner && projection.phase !== "resolvingReceipt" && player.alive) {
      const counts = countIntelligence(player.intelligence);
      if (counts.red >= 3) excludeFaction(evidence, "潜伏");
      if (counts.blue >= 3) excludeFaction(evidence, "军情");
      if (counts.physical >= 6) excludeFaction(evidence, "特工");
    }
  }

  observeDefinitivePublicTextInference(memory, projection);

  if (policy.secondOrderIdentityModel) {
    memory.perceivedIdentityByPlayer = estimatePerceivedIdentityByPlayer(
      memory,
      projection,
      policy,
    );
  }

  const priorTransmission = memory.previous?.transmission;
  observeResolvedDirectColorDenial(
    memory,
    projection,
    priorTransmission,
    policy,
  );
  const currentTransmission = transmissionObservation(projection);
  observeTransmissionInference(
    memory,
    projection,
    currentTransmission,
    policy,
    knownTransmissionCard,
  );
  if (currentTransmission && currentTransmission.signature !== priorTransmission?.signature) {
    const target = projection.players.find((player) => player.id === currentTransmission.targetId);
    const targetFaction = target?.faction ??
      (
        policy.directTransmissionEvidence !== "none" &&
          (
            policy.directTransmissionEvidence === "all" ||
            currentTransmission.card?.color === "黑"
          ) &&
          currentTransmission.targetId === projection.own.id
          ? projection.own.faction
          : undefined
      );
    const senderEvidence = memory.evidence[currentTransmission.senderId] ??= emptyBelief();
    if (targetFaction && currentTransmission.card) {
      observeTransmissionSenderEvidence(
        senderEvidence,
        targetFaction,
        currentTransmission.card,
        currentTransmission.method,
        memory.transmissionInference?.forcedByPlayerId !== undefined,
        policy.directTransmissionEvidence,
        policy.directTransmissionEvidenceStrength,
      );
    }
  }
  observeLethalLockInference(memory, projection, policy);

  const priorFunction = memory.previous?.functionAction;
  const currentFunction = functionObservation(projection, memory.previous);
  if (
    priorFunction?.kind === "probe" &&
    priorFunction.targetId === projection.own.id &&
    currentFunction?.signature !== priorFunction.signature &&
    projection.own.faction !== "特工"
  ) {
    const priorHandCount = memory.previous?.players[projection.own.id]?.handCount;
    const currentHandCount = projection.players.find((player) => player.id === projection.own.id)?.handCount;
    if (
      priorHandCount !== undefined &&
      currentHandCount !== undefined &&
      currentHandCount === priorHandCount + 1
    ) {
      const sourceEvidence = memory.evidence[priorFunction.sourceId] ??= emptyBelief();
      sourceEvidence[projection.own.faction] += 1.1;
      if (policy.secondOrderIdentityModel) {
        memory.supportiveProbeByPlayer[priorFunction.sourceId] = true;
        addPerceivedAlliance(
          memory,
          priorFunction.sourceId,
          projection.own.id,
          SUPPORTIVE_REVERSE_MAIL_FACTION_EVIDENCE,
        );
      }
    }
  }
  if (currentFunction && currentFunction.signature !== priorFunction?.signature) {
    const target = projection.players.find((player) => player.id === currentFunction.targetId);
    const sourceEvidence = memory.evidence[currentFunction.sourceId] ??= emptyBelief();
    if (currentFunction.kind === "publicText") {
      const targetFaction = target?.faction ??
        (currentFunction.targetId === projection.own.id ? projection.own.faction : undefined);
      if (targetFaction && policy.publicTextIntentScoring) {
        const sourceCard = projection.activeFunctionAction?.sourceCard;
        if (sourceCard) {
          if (isCooperativePublicTextHandoff(
            sourceCard,
            currentFunction.sourceId,
            currentFunction.targetId,
            targetFaction,
            projection,
          )) {
            sourceEvidence[targetFaction] += 0.35;
          } else {
            sourceEvidence[targetFaction] -= 0.35;
            for (const faction of FACTIONS) {
              if (faction !== targetFaction) sourceEvidence[faction] += 0.15;
            }
          }
        }
      } else if (targetFaction) {
        sourceEvidence[targetFaction] += 0.35;
      }
    }
    if (currentFunction.kind === "dangerousIntelligence" && target?.faction) {
      sourceEvidence[target.faction] -= 0.45;
      for (const faction of FACTIONS) if (faction !== target.faction) sourceEvidence[faction] += 0.2;
    }
  }
  if (
    priorFunction &&
    currentFunction?.signature !== priorFunction.signature
  ) {
    if (
      (policy.dangerousDiscardChoiceEvidence ?? 0) > 0 &&
      priorFunction.kind === "dangerousIntelligence"
    ) {
      observeDangerousDiscardChoiceInference(
        memory,
        projection,
        priorFunction,
        policy.dangerousDiscardChoiceEvidence ?? 0,
      );
    } else if (policy.inferResolvedActionAffinity) {
      observeResolvedActionAffinity(memory, projection, priorFunction, 1);
    } else if (
      priorFunction.kind === "probe" &&
      (policy.resolvedProbeAffinityScale ?? 0) > 0
    ) {
      const identityAwareness = policy.resolvedProbeIdentityAwarenessWeighting
        ? memory.perceivedIdentityByPlayer[priorFunction.sourceId]?.[projection.own.faction] ?? 1 / 3
        : 1;
      observeResolvedActionAffinity(
        memory,
        projection,
        priorFunction,
        (policy.resolvedProbeAffinityScale ?? 0) * identityAwareness,
      );
    }
  }

  const priorSecretOrder = memory.previous?.secretOrder;
  const currentSecretOrder = secretOrderObservation(projection);
  if (currentSecretOrder && currentSecretOrder.signature !== priorSecretOrder?.signature) {
    const sourceEvidence = memory.evidence[currentSecretOrder.sourceId] ??= emptyBelief();
    if (currentSecretOrder.requiredColor === "蓝") {
      sourceEvidence.军情 += SECRET_ORDER_COLOR_EVIDENCE;
    } else if (currentSecretOrder.requiredColor === "红") {
      sourceEvidence.潜伏 += SECRET_ORDER_COLOR_EVIDENCE;
    }
  }

  if (policy.secondOrderIdentityModel) {
    memory.perceivedIdentityByPlayer = estimatePerceivedIdentityByPlayer(
      memory,
      projection,
      policy,
    );
  }

  memory.previous = snapshot(projection, currentFunction);
}

function observeKnownHands(
  memory: BotMemory,
  projection: PlayerProjection,
): PhysicalCard | undefined {
  const newNotices = projection.privateNotices.slice(memory.observedPrivateNoticeCount);
  for (const notice of newNotices) {
    if (
      notice.kind === "secretOrderHandInspected" ||
      notice.kind === "dangerousHandInspected"
    ) {
      memory.knownHands[notice.otherPlayerId] = {
        cards: [...notice.cards],
        unknownCount: 0,
        handCount: notice.cards.length,
      };
      continue;
    }
    if (notice.kind === "publicTextLost") {
      const player = projection.players.find((candidate) => candidate.id === notice.otherPlayerId);
      const tracked = memory.knownHands[notice.otherPlayerId];
      if (player && tracked && !tracked.cards.some((card) => card.id === notice.card.id)) {
        tracked.cards.push(notice.card);
      }
    }
  }
  memory.observedPrivateNoticeCount = projection.privateNotices.length;

  const currentTransmission = transmissionObservation(projection);
  const currentFunction = functionObservation(projection, memory.previous);
  const departureIdsByPlayer = new Map<string, Set<string>>();
  const hiddenDeparturesByPlayer = new Map<string, number>();
  const addDepartureId = (playerId: string, cardId: string) => {
    const ids = departureIdsByPlayer.get(playerId) ?? new Set<string>();
    ids.add(cardId);
    departureIdsByPlayer.set(playerId, ids);
  };
  const addHiddenDeparture = (playerId: string) => {
    hiddenDeparturesByPlayer.set(playerId, (hiddenDeparturesByPlayer.get(playerId) ?? 0) + 1);
  };
  if (currentTransmission?.signature !== memory.previous?.transmission?.signature) {
    if (currentTransmission?.card) addDepartureId(currentTransmission.senderId, currentTransmission.card.id);
    else if (currentTransmission) addHiddenDeparture(currentTransmission.senderId);
  }
  if (currentFunction && currentFunction.signature !== memory.previous?.functionAction?.signature) {
    if (projection.activeFunctionAction?.sourceCard) {
      addDepartureId(currentFunction.sourceId, projection.activeFunctionAction.sourceCard.id);
    } else if (currentFunction) {
      addHiddenDeparture(currentFunction.sourceId);
    }
  }

  const publiclyLocatedCardIds = new Set<string>([
    ...projection.publicDiscard.map((card) => card.id),
    ...projection.players.flatMap((player) => player.intelligence.map((card) => card.id)),
    ...projection.own.hand.map((card) => card.id),
    ...(projection.transmission?.card ? [projection.transmission.card.id] : []),
    ...(projection.activeFunctionAction?.sourceCard
      ? [projection.activeFunctionAction.sourceCard.id]
      : []),
  ]);
  for (const notice of newNotices) {
    if (
      notice.kind !== "publicTextGained" &&
      notice.kind !== "dangerousDiscardMade" &&
      notice.kind !== "probeReceived" &&
      notice.kind !== "secretOrderReceived"
    ) {
      continue;
    }
    addDepartureId(notice.otherPlayerId, notice.card.id);
    if (
      (notice.kind === "probeReceived" || notice.kind === "secretOrderReceived") &&
      (hiddenDeparturesByPlayer.get(notice.otherPlayerId) ?? 0) > 0
    ) {
      hiddenDeparturesByPlayer.set(
        notice.otherPlayerId,
        (hiddenDeparturesByPlayer.get(notice.otherPlayerId) ?? 1) - 1,
      );
    }
  }

  let inferredTransmissionCard: PhysicalCard | undefined;
  for (const [playerId, tracked] of Object.entries(memory.knownHands)) {
    const player = projection.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      delete memory.knownHands[playerId];
      continue;
    }
    const departureIds = departureIdsByPlayer.get(playerId) ?? new Set<string>();
    const isNewHiddenTransmission =
      currentTransmission?.senderId === playerId &&
      currentTransmission.card === undefined &&
      currentTransmission.signature !== memory.previous?.transmission?.signature;
    if (
      isNewHiddenTransmission &&
      tracked.handCount === 1 &&
      tracked.unknownCount === 0 &&
      tracked.cards.length === 1
    ) {
      inferredTransmissionCard = tracked.cards[0];
      departureIds.add(tracked.cards[0]!.id);
      hiddenDeparturesByPlayer.set(
        playerId,
        Math.max(0, (hiddenDeparturesByPlayer.get(playerId) ?? 0) - 1),
      );
    }
    const retainedCards = tracked.cards.filter((card) =>
      !publiclyLocatedCardIds.has(card.id) && !departureIds.has(card.id)
    );
    const knownDepartures = tracked.cards.length - retainedCards.length;
    const confirmedUnknownDepartures = [...departureIds].filter((cardId) =>
      !tracked.cards.some((card) => card.id === cardId)
    ).length;
    const explainedLosses = knownDepartures + confirmedUnknownDepartures +
      (hiddenDeparturesByPlayer.get(playerId) ?? 0);
    const expectedCountAfterExplainedLosses = Math.max(0, tracked.handCount - explainedLosses);
    if (player.handCount < expectedCountAfterExplainedLosses) {
      // At least one hidden card left the hand. Any previously known card could
      // have been that card, so no individual identity remains certain.
      tracked.cards = [];
      tracked.unknownCount = player.handCount;
      tracked.handCount = player.handCount;
      continue;
    }
    tracked.cards = retainedCards;
    tracked.unknownCount = Math.max(0, player.handCount - retainedCards.length);
    tracked.handCount = player.handCount;
  }
  return inferredTransmissionCard;
}

export function factionBeliefs(memory: BotMemory, projection: PlayerProjection): Record<string, FactionBelief> {
  const result: Record<string, FactionBelief> = {};
  const known = new Map<string, Faction>();
  for (const player of projection.players) {
    if (player.faction) known.set(player.id, player.faction);
    else if (player.id === projection.own.id) known.set(player.id, projection.own.faction);
  }
  for (const [playerId, faction] of known) result[playerId] = oneHot(faction);

  const distribution = factionsForPlayerCount(projection.players.length);
  const totals = Object.fromEntries(FACTIONS.map((faction) => [
    faction,
    distribution.filter((entry) => entry === faction).length,
  ])) as Record<Faction, number>;
  const remaining = { ...totals };
  for (const faction of known.values()) remaining[faction] -= 1;
  const hiddenIds = projection.players.filter((player) => !known.has(player.id)).map((player) => player.id);
  const weightedAssignments: Array<{ assignment: Record<string, Faction>; logWeight: number }> = [];

  enumerateFactionAssignments(hiddenIds, 0, remaining, {}, memory, weightedAssignments);
  if (weightedAssignments.length === 0) {
    throw new Error("Known factions are inconsistent with the player-count distribution");
  }
  const maxLogWeight = Math.max(...weightedAssignments.map((entry) => entry.logWeight));
  const normalizer = weightedAssignments.reduce(
    (sum, entry) => sum + Math.exp(entry.logWeight - maxLogWeight),
    0,
  );
  for (const playerId of hiddenIds) {
    const possibleFactions = FACTIONS.filter((faction) =>
      (memory.evidence[playerId]?.[faction] ?? 0) > -DEFINITIVE_FACTION_EVIDENCE
    );
    if (possibleFactions.length === 1) {
      result[playerId] = oneHot(possibleFactions[0]!);
      continue;
    }
    const belief = emptyBelief();
    for (const entry of weightedAssignments) {
      belief[entry.assignment[playerId]!] += Math.exp(entry.logWeight - maxLogWeight) / normalizer;
    }
    result[playerId] = belief;
  }
  return result;
}

export function factionBeliefsForPolicy(
  memory: BotMemory,
  projection: PlayerProjection,
  policy: BotPolicy,
): Record<string, FactionBelief> {
  return policy.beliefModel === "exact"
    ? factionBeliefs(memory, projection)
    : independentFactionBeliefs(memory, projection);
}

function estimatePerceivedIdentityByPlayer(
  memory: BotMemory,
  projection: PlayerProjection,
  policy: BotPolicy,
): Record<string, FactionBelief> {
  const result: Record<string, FactionBelief> = {};
  const publicBot = projection.players.find((player) => player.id === memory.botId);
  if (publicBot?.faction) {
    for (const observer of projection.players) {
      if (observer.id !== memory.botId) result[observer.id] = oneHot(publicBot.faction);
    }
    return result;
  }

  const distribution = factionsForPlayerCount(projection.players.length);
  const totals = Object.fromEntries(FACTIONS.map((faction) => [
    faction,
    distribution.filter((entry) => entry === faction).length,
  ])) as Record<Faction, number>;
  const publiclyRevealed = Object.fromEntries(FACTIONS.map((faction) => [
    faction,
    projection.players.filter((player) => player.faction === faction).length,
  ])) as Record<Faction, number>;
  const publicHiddenCount = projection.players.filter((player) => !player.faction).length;
  const botBeliefs = factionBeliefsForPolicy(memory, projection, policy);
  const publicSelfEvidence = memory.evidence[memory.botId] ?? emptyBelief();

  for (const observer of projection.players) {
    if (observer.id === memory.botId) continue;
    const observerFactions = observer.faction
      ? oneHot(observer.faction)
      : botBeliefs[observer.id] ?? uniformBelief();
    const prior = emptyBelief();
    for (const observerFaction of FACTIONS) {
      const observerProbability = observerFactions[observerFaction];
      if (observerProbability <= 0) continue;
      const denominator = observer.faction
        ? publicHiddenCount
        : Math.max(1, publicHiddenCount - 1);
      for (const candidateFaction of FACTIONS) {
        const remaining = totals[candidateFaction] - publiclyRevealed[candidateFaction] -
          (!observer.faction && observerFaction === candidateFaction ? 1 : 0);
        prior[candidateFaction] += observerProbability * Math.max(0, remaining) / denominator;
      }
    }
    const weighted: FactionBelief = {
      军情: prior.军情 * Math.exp(Math.max(-20, Math.min(20, publicSelfEvidence.军情))),
      潜伏: prior.潜伏 * Math.exp(Math.max(-20, Math.min(20, publicSelfEvidence.潜伏))),
      特工: prior.特工 * Math.exp(Math.max(-20, Math.min(20, publicSelfEvidence.特工))),
    };
    const totalWeight = FACTIONS.reduce((sum, faction) => sum + weighted[faction], 0);
    result[observer.id] = totalWeight > 0
      ? {
          军情: weighted.军情 / totalWeight,
          潜伏: weighted.潜伏 / totalWeight,
          特工: weighted.特工 / totalWeight,
        }
      : uniformBelief();
  }
  return result;
}

function hiddenDirectBlackProbability(
  memory: BotMemory,
  projection: PlayerProjection,
  senderId: string,
  policy: BotPolicy,
): number {
  const senderBelief = factionBeliefsForPolicy(memory, projection, policy)[senderId] ??
    uniformBelief();
  const perceivedBot = memory.perceivedIdentityByPlayer[senderId] ?? uniformBelief();
  const alignedProbability = senderBelief.军情 * perceivedBot.军情 +
    senderBelief.潜伏 * perceivedBot.潜伏;
  return Math.max(
    0,
    Math.min(1, HOSTILE_DIRECT_BLACK_PROBABILITY - ALLIED_DIRECT_BLACK_DISCOUNT * alignedProbability),
  );
}

function supportiveProbeMailBlackProbability(
  memory: BotMemory,
  projection: PlayerProjection,
  senderId: string,
): number | undefined {
  if (!memory.supportiveProbeByPlayer[senderId]) return undefined;
  const sender = projection.players.find((player) => player.id === senderId);
  if (!sender) return undefined;
  // The transmitted card has already left the sender's hand. No remaining card
  // means they had no choice; one remaining card means only a limited choice.
  if (sender.handCount === 0) return undefined;
  return sender.handCount === 1
    ? LIMITED_HAND_SUPPORTIVE_MAIL_BLACK_PROBABILITY
    : SUPPORTIVE_PROBE_MAIL_BLACK_PROBABILITY;
}

function reverseMailAffinityBlackProbability(
  memory: BotMemory,
  projection: PlayerProjection,
  current: NonNullable<PublicObservation["transmission"]>,
  policy: BotPolicy,
): number | undefined {
  if (
    !policy.supportiveReverseMailInference ||
    current.method !== "密电" ||
    current.direction !== "counterclockwise" ||
    current.targetId !== projection.own.id ||
    nextLivingPlayerFrom(current.senderId, "clockwise", projection) === projection.own.id
  ) {
    return undefined;
  }
  const affinity = memory.perceivedAllianceByPlayer[current.senderId]?.[projection.own.id] ?? 0;
  if (affinity < HIGH_AFFINITY_THRESHOLD) return undefined;
  const sender = projection.players.find((player) => player.id === current.senderId);
  if (!sender || sender.handCount === 0) return undefined;
  const discount = sender.handCount === 1
    ? LIMITED_HAND_REVERSE_MAIL_BLACK_DISCOUNT
    : REVERSE_MAIL_BLACK_DISCOUNT;
  return (1 / 3) - discount * affinity;
}

function observeSupportiveReverseMailInference(
  memory: BotMemory,
  projection: PlayerProjection,
  current: NonNullable<PublicObservation["transmission"]>,
  policy: BotPolicy,
): void {
  if (
    !policy.supportiveReverseMailInference ||
    current.method !== "密电" ||
    current.direction !== "counterclockwise" ||
    current.targetId !== projection.own.id ||
    nextLivingPlayerFrom(current.senderId, "clockwise", projection) === projection.own.id
  ) {
    return;
  }
  const affinity = memory.perceivedAllianceByPlayer[current.senderId]?.[projection.own.id] ?? 0;
  if (affinity < HIGH_AFFINITY_THRESHOLD) return;
  const sourceEvidence = memory.evidence[current.senderId] ??= emptyBelief();
  sourceEvidence[projection.own.faction] += SUPPORTIVE_REVERSE_MAIL_FACTION_EVIDENCE;
  addPerceivedAlliance(
    memory,
    current.senderId,
    projection.own.id,
    SUPPORTIVE_REVERSE_MAIL_FACTION_EVIDENCE,
  );
}

function addPerceivedAlliance(
  memory: BotMemory,
  observerId: string,
  subjectId: string,
  strength: number,
): void {
  const relationships = memory.perceivedAllianceByPlayer[observerId] ??= {};
  relationships[subjectId] = Math.max(
    -1,
    Math.min(1, (relationships[subjectId] ?? 0) + strength),
  );
}

function nextLivingPlayerFrom(
  playerId: string,
  direction: Direction,
  projection: PlayerProjection,
): string | undefined {
  const start = projection.seatOrder.indexOf(playerId);
  if (start < 0) return undefined;
  const step = direction === "clockwise" ? 1 : -1;
  for (let offset = 1; offset < projection.seatOrder.length; offset += 1) {
    const candidateId = projection.seatOrder[
      (start + step * offset + projection.seatOrder.length) % projection.seatOrder.length
    ];
    if (projection.players.find((player) => player.id === candidateId)?.alive) {
      return candidateId;
    }
  }
  return undefined;
}

function independentFactionBeliefs(memory: BotMemory, projection: PlayerProjection): Record<string, FactionBelief> {
  const distribution = factionsForPlayerCount(projection.players.length);
  const totals = Object.fromEntries(FACTIONS.map((faction) => [faction, distribution.filter((entry) => entry === faction).length])) as Record<Faction, number>;
  const revealed = Object.fromEntries(FACTIONS.map((faction) => [faction, projection.players.filter((player) => player.faction === faction || (player.id === projection.own.id && projection.own.faction === faction && !player.faction)).length])) as Record<Faction, number>;
  const hiddenCount = projection.players.filter((player) => !player.faction && player.id !== projection.own.id).length;
  const result: Record<string, FactionBelief> = {};
  for (const player of projection.players) {
    if (player.faction) {
      result[player.id] = oneHot(player.faction);
      continue;
    }
    if (player.id === projection.own.id) {
      result[player.id] = oneHot(projection.own.faction);
      continue;
    }
    const evidence = memory.evidence[player.id] ?? emptyBelief();
    const possibleFactions = FACTIONS.filter((faction) =>
      evidence[faction] > -DEFINITIVE_FACTION_EVIDENCE
    );
    if (possibleFactions.length === 1) {
      result[player.id] = oneHot(possibleFactions[0]!);
      continue;
    }
    const weighted = Object.fromEntries(FACTIONS.map((faction) => {
      const prior = Math.max(0, (totals[faction] - revealed[faction]) / Math.max(1, hiddenCount));
      return [
        faction,
        evidence[faction] <= -DEFINITIVE_FACTION_EVIDENCE
          ? 0
          : prior * Math.exp(Math.max(-8, Math.min(8, evidence[faction]))),
      ];
    })) as unknown as FactionBelief;
    const sum = FACTIONS.reduce((total, faction) => total + weighted[faction], 0);
    result[player.id] = Object.fromEntries(
      FACTIONS.map((faction) => [faction, sum > 0 ? weighted[faction] / sum : 1 / FACTIONS.length]),
    ) as unknown as FactionBelief;
  }
  return result;
}

function enumerateFactionAssignments(
  playerIds: readonly string[],
  index: number,
  remaining: Record<Faction, number>,
  assignment: Record<string, Faction>,
  memory: BotMemory,
  output: Array<{ assignment: Record<string, Faction>; logWeight: number }>,
): void {
  if (index === playerIds.length) {
    if (FACTIONS.some((faction) => remaining[faction] !== 0)) return;
    const logWeight = playerIds.reduce((sum, playerId) => {
      const evidence = memory.evidence[playerId] ?? emptyBelief();
      return sum + Math.max(-8, Math.min(8, evidence[assignment[playerId]!]));
    }, 0);
    output.push({ assignment: { ...assignment }, logWeight });
    return;
  }
  const playerId = playerIds[index]!;
  for (const faction of FACTIONS) {
    if (remaining[faction] <= 0) continue;
    if ((memory.evidence[playerId]?.[faction] ?? 0) <= -DEFINITIVE_FACTION_EVIDENCE) continue;
    assignment[playerId] = faction;
    remaining[faction] -= 1;
    enumerateFactionAssignments(playerIds, index + 1, remaining, assignment, memory, output);
    remaining[faction] += 1;
    delete assignment[playerId];
  }
}

export function chooseBotCommand(
  projection: PlayerProjection,
  memory: BotMemory,
  options: BotDecisionOptions = {},
): GameCommand | undefined {
  return chooseBotDecision(projection, memory, options)?.command;
}

export function chooseBotDecision(
  projection: PlayerProjection,
  memory: BotMemory,
  options: BotDecisionOptions = {},
): BotDecision | undefined {
  const policy = options.policy ?? LIVE_BOT_POLICY;
  observeBotProjection(memory, projection, policy);
  if (projection.winner || !projection.players.find((player) => player.id === memory.botId)?.alive) {
    return undefined;
  }
  const beliefs = factionBeliefsForPolicy(memory, projection, policy);
  const excluded = new Set(
    options.excludedCommands?.map((command) => JSON.stringify(command)) ?? [],
  );
  const transmissionActions = projection.legalActions.filter(
    (action): action is StartTransmissionAction =>
      action.type === "START_TRANSMISSION",
  );
  if (transmissionActions.length > 0) {
    const transmission = chooseTransmission(
      projection,
      transmissionActions,
      beliefs,
      options.random,
      excluded,
      new Set(options.excludedTransmissionCardIds ?? []),
      policy,
    );
    return transmission
      ? { command: transmission, score: 25, reason: "start required transmission" }
      : undefined;
  }
  const candidates = projection.legalActions
    .map((action) => {
      const scored = policy.scoring === "baseline"
        ? scoreBaselineAction(action, projection, beliefs)
        : scoreAction(
            action,
            projection,
            beliefs,
            policy,
            memory.transmissionInference,
            memory.perceivedAllianceByPlayer,
            memory.knownHands,
          );
      return policy.reactionConservation > 0
        ? applyCardConservation(action, scored, projection, beliefs, policy)
        : scored;
    })
    .filter((candidate) => !excluded.has(JSON.stringify(candidate.command)));

  if (candidates.length === 0) return undefined;
  const highest = Math.max(...candidates.map((candidate) => candidate.score));
  const tied = candidates.filter((candidate) => Math.abs(candidate.score - highest) < 0.0001);
  return tied[pickIndex(tied.length, options.random)];
}

/** Frozen pre-tactical policy retained for paired A/B evaluation. */
function scoreBaselineAction(
  action: LegalAction,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): BotDecision {
  const command = action as GameCommand;
  const ownFaction = projection.own.faction;
  const card = "cardId" in action ? projection.own.hand.find((item) => item.id === action.cardId) : undefined;
  switch (action.type) {
    case "ACCEPT_INTELLIGENCE":
      return decision(command, intelligenceValue(projection.transmission?.card, ownFaction, ownBlackCount(projection)), "baseline receipt evaluation");
    case "DECLINE_INTELLIGENCE": return decision(command, 2, "baseline decline");
    case "ENTER_TRANSMISSION_PHASE": return decision(command, 10, "baseline enter transmission");
    case "PASS_LOCK": return decision(command, 4, "baseline preserve lock");
    case "PLAY_LOCK": return decision(command, Math.max(3, intelligenceValue(projection.transmission?.card, ownFaction, ownBlackCount(projection)) + 12), "baseline lock");
    case "PASS_REACTION": return decision(command, 5, "baseline preserve reaction");
    case "PLAY_COUNTER": return decision(command, 18, "baseline always counter");
    case "PLAY_DECRYPT": return decision(command, projection.transmission?.card ? 4 : 14, "baseline decrypt");
    case "PLAY_INTERCEPT": return decision(command, intelligenceValue(projection.transmission?.card, ownFaction, ownBlackCount(projection)) + 5, "baseline intercept");
    case "PLAY_SWAP": return decision(command, projection.transmission?.card && intelligenceValue(projection.transmission.card, ownFaction, ownBlackCount(projection)) < 0 ? 16 : 7, "baseline swap");
    case "PLAY_TRANSFER":
    case "PLAY_SEPARATION":
    case "PLAY_FUNCTION_SEPARATION":
      return decision(command, targetAffinity(action.targetId, ownFaction, beliefs) * 8 + 8, "baseline ally redirect");
    case "PLAY_BURN":
      if (hasPlayableReinforcement(projection)) {
        return decision(command, -100_000, "play reinforcement before considering burn");
      }
      return decision(command, targetAffinity(action.targetPlayerId, ownFaction, beliefs) * 12 + 8, "baseline ally burn");
    case "PLAY_PUBLIC_TEXT": return decision(command, targetAffinity(action.targetId, ownFaction, beliefs) * 5 + 8, "baseline public text");
    case "PLAY_DANGEROUS_INTELLIGENCE": return decision(command, -targetAffinity(action.targetId, ownFaction, beliefs) * 8 + 10, "baseline dangerous intelligence");
    case "PLAY_PROBE": return decision(command, informationUncertainty(action.targetId, beliefs) * 8 + 8, "baseline probe");
    case "PLAY_REINFORCEMENT": return decision(command, 17, "baseline reinforcement");
    case "PLAY_CONFIDENTIAL_FILE": return decision(command, 22, "baseline confidential file");
    case "PLAY_LURE": return decision(command, 11, "baseline lure");
    case "CHOOSE_PROBE_IDENTITY": return decision(command, action.choice === "giveRandom" && projection.own.hand.length > 2 ? 9 : 7, "baseline probe choice");
    case "CHOOSE_PUBLIC_TEXT_EFFECT": return decision(command, action.choice === "drawTwo" ? 20 : action.choice === "drawOne" ? 13 : 4, "baseline public text choice");
    case "PLAY_SECRET_ORDER": return decision(command, 12, "baseline secret order");
    case "START_TRANSMISSION":
      return decision(
        command,
        startTransmissionActionScore(action, card, projection, beliefs, BASELINE_V1),
        "baseline transmission choice",
      );
    case "DISCARD_FOR_HAND_LIMIT":
    case "CHOOSE_DANGEROUS_DISCARD":
    case "CHOOSE_PROBE_DISCARD":
    case "CHOOSE_PUBLIC_TEXT_DISCARD":
      return decision(command, -cardUtility(card, ownFaction), "baseline discard");
  }
}

function scoreAction(
  action: LegalAction,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  policy: BotPolicy,
  transmissionInference?: BotMemory["transmissionInference"],
  perceivedAllianceByPlayer: BotMemory["perceivedAllianceByPlayer"] = {},
  knownHands: BotMemory["knownHands"] = {},
): BotDecision {
  const command = action as GameCommand;
  const ownFaction = projection.own.faction;
  const card = cardForTacticalAction(action, projection);
  switch (action.type) {
    case "ACCEPT_INTELLIGENCE": {
      const receiptUtility = currentTransmissionReceiptUtility(
        projection.own.id,
        projection,
        beliefs,
        transmissionInference,
      );
      const safeTruePossessionBonus =
        projection.transmission?.card &&
        projection.transmission.card.color !== "黑"
          ? 1
          : 0;
      const agentEndgameBonus = policy.agentFourTrueReceiptPriority &&
          hasFourTrueIntelligence(projection.own.id, projection) &&
          incomingIntelligenceIsSafeForAgent(projection, transmissionInference)
        ? AGENT_FOUR_TRUE_RECEIPT_BONUS
        : 0;
      const agentKnownBlackPenalty = projection.own.faction === "特工" &&
          projection.transmission?.card?.color === "黑"
        ? policy.agentKnownBlackReceiptPenalty ?? 0
        : 0;
      const redirectedLockPenalty = redirectedLockReceiptPenalty(
        projection,
        transmissionInference,
        policy.redirectedLockReceiptPenalty ?? 0,
      );
      return decision(
        command,
        5 + receiptUtility + safeTruePossessionBonus + agentEndgameBonus -
          agentKnownBlackPenalty - redirectedLockPenalty,
        agentEndgameBonus > 0
          ? "prioritize a safe fifth or sixth intelligence after reaching four true intelligence"
          : redirectedLockPenalty > 0
          ? "retain the original 锁定 player's hidden-receipt warning after 离间 moves the lock"
          : safeTruePossessionBonus > 0 && receiptUtility === 0
          ? "accept safe true intelligence instead of routing it onward"
          : "evaluate tactical receipt outcome",
      );
    }
    case "DECLINE_INTELLIGENCE": {
      const nextRecipientId = nextRecipientAfterDecline(projection);
      const nextReceiptUtility = currentTransmissionReceiptUtility(
        nextRecipientId,
        projection,
        beliefs,
        transmissionInference,
      );
      const alliedProgressBonus = currentTransmissionAlliedProgressBonus(
        nextRecipientId,
        projection,
        beliefs,
        transmissionInference,
        policy,
      );
      const routedReceiptUtility = nextReceiptUtility + alliedProgressBonus;
      if (nextReceiptUtility <= TERMINAL_LOSS_UTILITY) {
        return decision(
          command,
          5 + nextReceiptUtility,
          "do not route intelligence to a recipient with a guaranteed terminal win",
        );
      }
      if (alliedProgressBonus > 0) {
        return decision(
          command,
          5 + routedReceiptUtility,
          "route matching real intelligence toward a trusted ally who is closer to victory",
        );
      }
      if (policy.declineRouting === "acceptance-weighted") {
        return decision(
          command,
          5 + expectedNextReceiptUtilityAfterDecline(
            nextRecipientId,
            nextReceiptUtility,
            projection,
            beliefs,
          ),
          "evaluate the acceptance-weighted receipt by the next player",
        );
      }
      if (
        policy.declineRouting === "forced-return" &&
        projection.transmission?.method === "直达"
      ) {
        return decision(
          command,
          5 + nextReceiptUtility,
          "evaluate the forced return receipt by the sender",
        );
      }
      return decision(command, 5, "preserve the current board state");
    }
    case "ENTER_TRANSMISSION_PHASE":
      return decision(command, 10, "finish function-card phase");
    case "PASS_LOCK":
      return decision(command, 4, "preserve lock card");
    case "PLAY_LOCK": {
      const currentTargetId = projection.transmission?.intendedRecipientId;
      if (
        policy.lockRequiresLikelyDecline &&
        currentTransmissionRecipientUtility(
          currentTargetId,
          projection,
          beliefs,
          transmissionInference,
        ) > 0
      ) {
        return decision(
          command,
          3,
          "save lock because the current recipient is already likely to accept",
        );
      }
      return decision(
        command,
        6 + currentTransmissionReceiptUtility(
          currentTargetId,
          projection,
          beliefs,
          transmissionInference,
        ),
        "force a tactically valuable receipt",
      );
    }
    case "PASS_REACTION": {
      const isEstablishedIntelligenceWindow =
        projection.reactionWindow?.kind === "intelligence" &&
        projection.responseStack.at(-1)?.kind === "intelligence";
      const pendingReceiptUtility = isEstablishedIntelligenceWindow
        ? currentTransmissionReceiptUtility(
            projection.transmission?.intendedRecipientId,
            projection,
            beliefs,
            transmissionInference,
          )
        : 0;
      return pendingReceiptUtility <= TERMINAL_LOSS_UTILITY
        ? decision(
            command,
            PASS_REACTION_SCORE + pendingReceiptUtility,
            "do not pass when the intended recipient has a guaranteed terminal win",
          )
        : decision(command, PASS_REACTION_SCORE, "preserve reaction cards");
    }
    case "PLAY_COUNTER": {
      const isIncomingHiddenProbe = projection.activeFunctionAction?.kind === "probe" &&
        projection.activeFunctionAction.targetPlayerId === projection.own.id;
      const probeCounterCost = isIncomingHiddenProbe
        ? policy.incomingProbeCounterCost ?? 0
        : 0;
      const pendingFrame = projection.responseStack.at(-1);
      const ownVisibleBlack = projection.players.find(
        (player) => player.id === projection.own.id,
      )?.intelligence.filter((intelligence) => intelligence.color === "黑").length ?? 0;
      const hiddenSelfLockBonus =
        pendingFrame?.kind === "card" &&
        pendingFrame.cardName === "锁定" &&
        pendingFrame.targetPlayerId === projection.own.id &&
        projection.transmission?.card === undefined &&
        ownVisibleBlack >= (policy.hiddenSelfLockCounterMinBlack ?? 0) &&
        projection.players.length <=
          (policy.hiddenSelfLockCounterMaxPlayers ?? Number.POSITIVE_INFINITY)
          ? policy.hiddenSelfLockCounterBonus ?? 0
          : 0;
      return decision(
        command,
        5 - pendingInteractionUtility(projection, beliefs, policy) - probeCounterCost +
          hiddenSelfLockBonus,
        probeCounterCost > 0
          ? `counter only when the hidden probe costs more than preserving 识破 (${probeCounterCost})`
          : hiddenSelfLockBonus > 0
          ? "counter a hidden 锁定 aimed at this bot because the forced receipt is usually harmful"
          : "counter only when the pending action is unfavorable",
      );
    }
    case "PLAY_DECRYPT":
      return projection.transmission?.card
        ? decision(
            command,
            -100_000,
            "do not spend decrypt on intelligence already known to this player",
          )
        : decision(command, 14, "learn hidden intelligence");
    case "PLAY_INTERCEPT": {
      if (
        policy.avoidOwnTransferInterceptUndo &&
        isUnchangedOwnTransferCommitment(projection)
      ) {
        return decision(
          command,
          -100_000,
          "do not spend 截获 to undo this bot's own unchanged 转移",
        );
      }
      const ownReceipt = currentTransmissionReceiptUtility(
        projection.own.id,
        projection,
        beliefs,
        transmissionInference,
      );
      const compareWithCurrentReceipt = policy.incrementalInterceptScoring ||
        (policy.committedTransferInterceptScoring &&
          projection.transmission?.transferredRecipientCommitted === true);
      return compareWithCurrentReceipt
        ? decision(
            command,
            PASS_REACTION_SCORE + ownReceipt -
              expectedCurrentReceiptUtilityOnPass(
                projection,
                beliefs,
                transmissionInference,
              ) -
              cardUtility(card, ownFaction) * policy.interceptOpportunityCostFactor,
            "intercept only when the forced self-receipt improves on leaving the intelligence with its current recipient",
          )
        : decision(command, PASS_REACTION_SCORE + ownReceipt, "intercept tactically useful intelligence");
    }
    case "PLAY_SWAP":
      if (
        transmissionInference?.forcedByPlayerId === projection.own.id &&
        transmissionInference.forcedColor &&
        card &&
        !matchesColor(card, transmissionInference.forcedColor)
      ) {
        return decision(
          command,
          -100_000,
          "do not replace intelligence with a color that contradicts this bot's own secret order",
        );
      }
      {
        const improvement = swapImprovement(card, projection, beliefs, transmissionInference);
        const isFinalRecipientDecision =
          projection.transmission?.intendedRecipientId === projection.own.id &&
          projection.legalActions.some(
            (candidate) =>
              candidate.type === "ACCEPT_INTELLIGENCE" ||
              candidate.type === "DECLINE_INTELLIGENCE",
          );
        if (policy.finalReceiptSwapScoring && isFinalRecipientDecision) {
          const replacementReceiptUtility = receiptUtility(
            card,
            projection.own.id,
            projection,
            beliefs,
          );
          const safeTruePossessionBonus = card && card.color !== "黑" ? 1 : 0;
          return decision(
            command,
            PASS_REACTION_SCORE +
              replacementReceiptUtility +
              safeTruePossessionBonus -
              (policy.conservativeSwap
                ? cardUtility(card, ownFaction) * SWAP_CARD_COST_FACTOR
                : 1),
            "compare the replacement's final receipt value against accepting or declining the current intelligence",
          );
        }
        if (
          policy.conservativeSwap &&
          projection.transmission?.intendedRecipientId !== projection.own.id &&
          currentRecipientLikelyToAccept(
            projection,
            beliefs,
            transmissionInference,
          ) &&
          improvement < SETTLED_RECEIPT_SWAP_THRESHOLD
        ) {
          return decision(
            command,
            PASS_REACTION_SCORE - 1,
            "preserve swap when the current recipient will already accept and the replacement is only a routine improvement",
          );
        }
        return decision(
          command,
          PASS_REACTION_SCORE +
            improvement -
            (policy.conservativeSwap
              ? cardUtility(card, ownFaction) * SWAP_CARD_COST_FACTOR
              : 1),
          policy.conservativeSwap
            ? "swap only for a material receipt swing after accounting for the card's future value"
            : "swap only when the replacement improves enough to justify spending the card",
        );
      }
    case "PLAY_TRANSFER": {
      if (
        projection.transmission?.method === "直达" &&
        action.targetId === projection.transmission.senderId &&
        projection.legalActions.some(
          (candidate) => candidate.type === "DECLINE_INTELLIGENCE",
        )
      ) {
        return decision(
          command,
          -100_000,
          "do not spend transfer to the original sender when direct intelligence can be declined there",
        );
      }
      const targetValue = currentTransmissionReceiptUtility(action.targetId, projection, beliefs, transmissionInference);
      const currentValue = currentTransmissionReceiptUtility(
        projection.transmission?.intendedRecipientId,
        projection,
        beliefs,
        transmissionInference,
      );
      const targetProgressBonus = currentTransmissionAlliedProgressBonus(
        action.targetId,
        projection,
        beliefs,
        transmissionInference,
        policy,
      );
      const currentProgressBonus = currentTransmissionAlliedProgressBonus(
        projection.transmission?.intendedRecipientId,
        projection,
        beliefs,
        transmissionInference,
        policy,
      );
      return policy.transferAgainstBestFreeAlternative
        ? decision(
            command,
            PASS_REACTION_SCORE + targetValue + targetProgressBonus - SEPARATION_CARD_COST,
            "transfer only when its forced receipt beats the best free accept-or-decline outcome",
          )
        : policy.incrementalTransfer
        ? decision(
            command,
            PASS_REACTION_SCORE + targetValue + targetProgressBonus -
              currentValue - currentProgressBonus - SEPARATION_CARD_COST,
            "transfer only when the new recipient improves enough to justify spending the card",
          )
        : decision(
            command,
            7 + targetValue + targetProgressBonus - (policy.transferOpportunityCost ?? 0),
            policy.transferOpportunityCost
              ? "redirect only when the tactical gain justifies spending transfer"
              : "redirect toward the best tactical recipient",
          );
    }
    case "PLAY_FUNCTION_SEPARATION": {
      const currentTargetId = projection.activeFunctionAction?.targetPlayerId;
      const improvement = activeFunctionTargetUtility(
        action.targetId,
        projection,
        beliefs,
        policy,
        action.cardId,
      ) - activeFunctionTargetUtility(
        currentTargetId,
        projection,
        beliefs,
        policy,
      );
      return decision(
        command,
        PASS_REACTION_SCORE + improvement - SEPARATION_CARD_COST,
        "redirect the active function card only when its new target improves the tactical outcome",
      );
    }
    case "PLAY_SEPARATION": {
      const pendingTargetId = projection.transmission?.pendingTransfer?.targetId;
      const improvement = currentTransmissionReceiptUtility(action.targetId, projection, beliefs, transmissionInference)
        + currentTransmissionAlliedProgressBonus(
          action.targetId,
          projection,
          beliefs,
          transmissionInference,
          policy,
        )
        - currentTransmissionReceiptUtility(pendingTargetId, projection, beliefs, transmissionInference)
        - currentTransmissionAlliedProgressBonus(
          pendingTargetId,
          projection,
          beliefs,
          transmissionInference,
          policy,
        );
      return decision(
        command,
        PASS_REACTION_SCORE + improvement - SEPARATION_CARD_COST,
        "redirect only when the new recipient improves enough to justify spending separation",
      );
    }
    case "PLAY_BURN":
      if (hasPlayableReinforcement(projection)) {
        return decision(
          command,
          -100_000,
          "play reinforcement before reconsidering whether burn is still useful",
        );
      }
      if (shouldDeferBurnUntilAfterReceipt(action.targetPlayerId, projection)) {
        return decision(
          command,
          -100_000,
          "do not delay a safe receipt to burn intelligence that is not an immediate survival requirement",
        );
      }
      return decision(
        command,
        policy.burnBase + burnUtility(action.targetPlayerId, projection, beliefs),
        policy.burnBase < TACTICAL_V2.burnBase
          ? "burn only when the expected protection exceeds card-conservation cost"
          : "remove dangerous black intelligence when it helps the bot's side",
      );
    case "PLAY_PUBLIC_TEXT": {
      const affinity = targetAffinity(action.targetId, ownFaction, beliefs);
      if (!policy.publicTextIntentScoring) {
        return decision(command, affinity * 5 + 8, "exchange with a likely ally");
      }
      const cooperativeHandoff = card !== undefined && isCooperativePublicTextHandoff(
        card,
        projection.own.id,
        action.targetId,
        ownFaction,
        projection,
      );
      return decision(
        command,
        (cooperativeHandoff ? affinity : -affinity) * 5 + 8,
        cooperativeHandoff
          ? "give matching public text to the immediate upstream ally who can pass it back"
          : "use public text as a hostile exchange",
      );
    }
    case "PLAY_DANGEROUS_INTELLIGENCE":
      {
        const baseScore = offensiveTargetBaseScore(action, projection, beliefs);
      return decision(
        command,
        policy.factionThreatTargeting === "dangerous" || policy.factionThreatTargeting === "all"
          ? normalizedStrategicTargetScore(action, projection, beliefs, 4, policy, knownHands)
          : baseScore,
        policy.factionThreatTargeting === "dangerous" || policy.factionThreatTargeting === "all"
          ? "pressure the opposing faction with the greatest combined size and visible win threat"
          : "pressure a likely opponent",
      );
      }
    case "PLAY_PROBE": {
      const baseScore = offensiveTargetBaseScore(action, projection, beliefs);
      return decision(
        command,
        (policy.factionThreatTargeting === "probe" || policy.factionThreatTargeting === "all") &&
          card?.variant?.kind === "probeDrawDiscard"
          ? normalizedStrategicTargetScore(action, projection, beliefs, 3)
          : baseScore,
        card?.variant?.kind === "probeDrawDiscard"
          ? "give the draw to a likely ally or force a likely opponent to discard"
          : "probe an uncertain opponent",
      );
    }
    case "PLAY_REINFORCEMENT":
      return decision(command, 17, "gain cards");
    case "PLAY_CONFIDENTIAL_FILE":
      return decision(command, 22, "gain cards from developed board");
    case "PLAY_LURE": {
      if (!policy.incrementalLure) return decision(command, 11, "deny current recipient");
      const currentTargetId = projection.transmission?.intendedRecipientId;
      const currentRecipientUtility = currentTransmissionRecipientUtility(
        currentTargetId,
        projection,
        beliefs,
        transmissionInference,
      );
      if (
        policy.lureRequiresLikelyAcceptance &&
        currentRecipientUtility <= 0 &&
        !(policy.lureRespectsCommittedRecipient && projection.transmission?.recipientMustAccept)
      ) {
        return decision(
          command,
          PASS_REACTION_SCORE - 1,
          "save lure because the current recipient is already likely to decline",
        );
      }
      const nextTargetId = nextRecipientAfterDecline(projection);
      const improvement = currentTransmissionReceiptUtility(
        nextTargetId,
        projection,
        beliefs,
        transmissionInference,
      ) - currentTransmissionReceiptUtility(
        currentTargetId,
        projection,
        beliefs,
        transmissionInference,
      );
      return decision(
        command,
        PASS_REACTION_SCORE + improvement - 1,
        "force a decline only when the next recipient improves the tactical outcome",
      );
    }
    case "CHOOSE_PROBE_IDENTITY":
      return policy.probeIdentityChoiceScoring
        ? decision(
            command,
            probeIdentityChoiceUtility(
              action.choice,
              projection.activeFunctionAction?.sourcePlayerId,
              projection,
              beliefs,
            ),
            "compare faction disclosure with the expected value of a random card transfer",
          )
        : decision(command, action.choice === "giveRandom" && projection.own.hand.length > 2 ? 9 : 7, "limit revealed identity information");
    case "CHOOSE_PUBLIC_TEXT_EFFECT":
      return decision(command, action.choice === "drawTwo" ? 20 : action.choice === "drawOne" ? 13 : 4, "maximize hand value");
    case "PLAY_SECRET_ORDER": {
      const targetId = projection.pendingSecretOrder?.targetPlayerId;
      const targetHandCount = projection.players.find(
        (player) => player.id === targetId,
      )?.handCount ?? 0;
      if (policy.avoidSecretOrderSmallHand && targetHandCount <= 1) {
        return decision(
          command,
          -100_000,
          "preserve secret order when the target has at most one card",
        );
      }
      const targetAffinityTowardBot = targetId
        ? perceivedAllianceByPlayer[targetId]?.[projection.own.id] ?? 0
        : 0;
      const redundantAllyCost = policy.avoidRedundantAllySecretOrder &&
          targetAffinityTowardBot >= HIGH_AFFINITY_THRESHOLD
        ? REDUNDANT_ALLY_SECRET_ORDER_COST * targetAffinityTowardBot
        : 0;
      const knownHandConstraint = knownHandSecretOrderConstraint(
        card,
        action.word,
        projection,
        beliefs,
        policy,
        knownHands,
      );
      if (knownHandConstraint?.verifiedNoMatch) {
        return decision(
          command,
          -100_000,
          "do not waste secret order on a color absent from the target's exactly known hand",
        );
      }
      const upstreamSupport = upstreamSecretOrderSupportBonus(
        card,
        action.word,
        projection,
        beliefs,
        targetAffinityTowardBot,
        policy,
        knownHands,
      );
      const strategicImprovement =
        (knownHandConstraint?.improvement ??
          secretOrderImprovement(card, action.word, projection, beliefs)) +
        upstreamSupport;
      return decision(
        command,
        PASS_REACTION_SCORE + strategicImprovement -
          SECRET_ORDER_CARD_COST - redundantAllyCost,
        upstreamSupport > 0
          ? "force useful real intelligence along an upstream route toward this bot"
          : redundantAllyCost > 0
          ? "preserve secret order when the target already tends to transmit favorably toward this bot"
          : knownHandConstraint
          ? "force the most restrictive color supported by the target's exactly known hand"
          : "force a likely opponent away from their most favorable intelligence color",
      );
    }
    case "START_TRANSMISSION":
      return decision(
        command,
        startTransmissionActionScore(action, card, projection, beliefs, policy),
        "evaluate required transmission choice",
      );
    case "CHOOSE_DANGEROUS_DISCARD":
      if (policy.dangerousDiscardStrategy === "random") {
        return decision(command, 0, "choose among an unmodeled inspected hand");
      }
      return decision(
        command,
        dangerousDiscardUtility(
          card,
          projection.activeFunctionAction?.targetPlayerId,
          projection,
          beliefs,
          policy.dangerousDiscardStrategy,
        ),
        "remove a likely opponent's most useful function or transmission card",
      );
    case "DISCARD_FOR_HAND_LIMIT":
    case "CHOOSE_PROBE_DISCARD":
    case "CHOOSE_PUBLIC_TEXT_DISCARD":
      return decision(command, -cardUtility(card, ownFaction), "discard least useful card");
  }
  throw new Error(`Unscored legal action: ${JSON.stringify(action)}`);
}

function startTransmissionActionScore(
  action: Extract<LegalAction, { type: "START_TRANSMISSION" }>,
  card: PhysicalCard | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  policy: BotPolicy,
): number {
  if (!card) return -100_000;
  const recipientId = action.method === "直达"
    ? action.targetId
    : adjacentLivingPlayer(projection, action.direction ?? "clockwise");
  if (!recipientId) return -100_000;
  if (policy.scoring === "baseline") {
    return transmissionCardValue(card, projection.own.faction) *
      targetAffinity(recipientId, projection.own.faction, beliefs) -
      cardUtility(card, projection.own.faction) * 0.15;
  }
  return tacticalTransmissionScore(
    card,
    action.method,
    recipientId,
    action.direction,
    projection,
    beliefs,
    policy,
  );
}

function cardForTacticalAction(
  action: LegalAction,
  projection: PlayerProjection,
): PhysicalCard | undefined {
  if (!("cardId" in action)) return undefined;
  const ownCard = projection.own.hand.find((item) => item.id === action.cardId);
  if (ownCard || action.type !== "CHOOSE_DANGEROUS_DISCARD") return ownCard;
  const targetId = projection.activeFunctionAction?.targetPlayerId;
  const inspectedCard = projection.activeFunctionAction?.inspectedHand?.find(
    (item) => item.id === action.cardId,
  );
  if (inspectedCard) return inspectedCard;
  for (let index = projection.privateNotices.length - 1; index >= 0; index -= 1) {
    const notice = projection.privateNotices[index]!;
    if (
      notice.kind === "dangerousHandInspected" &&
      notice.otherPlayerId === targetId
    ) {
      return notice.cards.find((item) => item.id === action.cardId);
    }
  }
  return undefined;
}

function dangerousDiscardUtility(
  card: PhysicalCard | undefined,
  targetId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  strategy: Exclude<BotPolicy["dangerousDiscardStrategy"], "random">,
): number {
  if (!card || !targetId) return 0;
  const targetBelief = beliefs[targetId] ?? {
    军情: 1 / 3,
    潜伏: 1 / 3,
    特工: 1 / 3,
  };
  const expectedTargetValue = FACTIONS.reduce(
    (total, faction) => total + targetBelief[faction] * cardUtility(card, faction),
    0,
  );
  const ownFaction = projection.own.faction;
  if (strategy === "expected-denial") {
    return FACTIONS.reduce((total, faction) => {
      const aligned = ownFaction !== "特工" && faction === ownFaction;
      const disposition = aligned ? -1 : 1;
      return total +
        targetBelief[faction] * disposition * cardUtility(card, faction);
    }, 0);
  }
  const sameFactionProbability = ownFaction === "特工"
    ? 0
    : targetBelief[ownFaction];
  const opponentProbability = 1 - sameFactionProbability;
  const disposition = ownFaction === "特工"
    ? 1
    : opponentProbability - sameFactionProbability;
  const opposingFactions: readonly Faction[] = ownFaction === "军情"
    ? ["潜伏"]
    : ownFaction === "潜伏"
      ? ["军情"]
      : ["军情", "潜伏"];
  const transmissionDenial = opposingFactions.reduce(
    (total, faction) =>
      total + Math.max(0, transmissionCardValue(card, faction)),
    0,
  ) * (0.3 / opposingFactions.length);
  if (strategy === "target-value") {
    return disposition * expectedTargetValue +
      opponentProbability * transmissionDenial;
  }
  const colorDenial = opponentProbability * transmissionDenial -
    sameFactionProbability * cardUtility(card, ownFaction);
  if (strategy === "color-denial") return colorDenial;
  const confidentOpponentMargin = Math.max(0, disposition);
  return colorDenial +
    confidentOpponentMargin * functionCardValue(card) * 0.35;
}

const DISCRETIONARY_REACTIONS = new Set<LegalAction["type"]>([
  "PLAY_LOCK",
  "PLAY_COUNTER",
  "PLAY_INTERCEPT",
  "PLAY_SWAP",
  "PLAY_TRANSFER",
  "PLAY_SEPARATION",
  "PLAY_FUNCTION_SEPARATION",
  "PLAY_BURN",
  "PLAY_LURE",
]);

const TARGETED_FUNCTION_CARDS = new Set<LegalAction["type"]>([
  "PLAY_PUBLIC_TEXT",
  "PLAY_DANGEROUS_INTELLIGENCE",
  "PLAY_SECRET_ORDER",
]);

function applyCardConservation(
  action: LegalAction,
  scored: BotDecision,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  policy: BotPolicy,
): BotDecision {
  const isReaction = DISCRETIONARY_REACTIONS.has(action.type);
  const isTargetedFunction =
    policy.targetedFunctionConservation &&
    TARGETED_FUNCTION_CARDS.has(action.type);
  if ((!isReaction && !isTargetedFunction) || Math.abs(scored.score) >= 1_000) {
    return scored;
  }
  const targetId = cardDecisionTarget(action, projection);
  const belief = targetId ? beliefs[targetId] : undefined;
  const confidence = belief ? Math.max(...FACTIONS.map((faction) => belief[faction])) : 1 / 3;
  const conservationCost = policy.reactionConservation * (1 + (1 - confidence) * 2);
  return {
    ...scored,
    score: scored.score - conservationCost,
    reason: `${scored.reason}; require ${conservationCost.toFixed(2)} confidence margin before spending this ${isTargetedFunction ? "targeted function" : "reaction"} card`,
  };
}

function cardDecisionTarget(action: LegalAction, projection: PlayerProjection): string | undefined {
  if ("targetPlayerId" in action) return action.targetPlayerId;
  if ("targetId" in action) return action.targetId;
  if (action.type === "PLAY_SECRET_ORDER") {
    return projection.pendingSecretOrder?.targetPlayerId;
  }
  if (action.type === "PLAY_INTERCEPT") return projection.own.id;
  if (action.type === "PLAY_COUNTER") return projection.responseStack.at(-1)?.targetPlayerId;
  return projection.transmission?.intendedRecipientId;
}

function nextRecipientAfterDecline(projection: PlayerProjection): string | undefined {
  const transmission = projection.transmission;
  if (!transmission) return undefined;
  if (transmission.method === "直达") return transmission.senderId;
  const currentIndex = projection.seatOrder.indexOf(transmission.intendedRecipientId);
  if (currentIndex < 0) return undefined;
  const step = transmission.direction === "counterclockwise" ? -1 : 1;
  for (let offset = 1; offset <= projection.seatOrder.length; offset += 1) {
    const index = (currentIndex + step * offset + projection.seatOrder.length) % projection.seatOrder.length;
    const playerId = projection.seatOrder[index]!;
    if (projection.players.find((player) => player.id === playerId)?.alive) return playerId;
  }
  return undefined;
}

function expectedNextReceiptUtilityAfterDecline(
  nextRecipientId: string | undefined,
  receiptUtilityValue: number,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  const transmission = projection.transmission;
  if (!nextRecipientId || !transmission) return 0;
  if (transmission.method === "直达") return receiptUtilityValue;
  const card = transmission.card;
  const acceptance = card
    ? transmissionAcceptanceProbability(
        card,
        transmission.method,
        nextRecipientId,
        projection,
        beliefs,
      )
    : dangerousDirectAcceptanceProbability(
        nextRecipientId,
        projection,
        beliefs,
      );
  return receiptUtilityValue * acceptance;
}

function chooseTransmission(
  projection: PlayerProjection,
  actions: readonly StartTransmissionAction[],
  beliefs: Record<string, FactionBelief>,
  random?: BotRandom,
  excluded: ReadonlySet<string> = new Set(),
  excludedCardIds: ReadonlySet<PhysicalCardId> = new Set(),
  policy: BotPolicy = LIVE_BOT_POLICY,
): GameCommand | undefined {
  const candidates: Array<{
    command: StartTransmissionAction;
    score: number;
    previousScore: number;
  }> = [];
  for (const command of actions) {
    if (excludedCardIds.has(command.cardId)) continue;
    const card = projection.own.hand.find((candidate) => candidate.id === command.cardId);
    if (!card) continue;
    const direction = command.direction ?? "clockwise";
    const recipient = command.method === "直达"
      ? command.targetId
      : adjacentLivingPlayer(projection, direction);
    if (!recipient) continue;
    const previousScore = policy.scoring === "baseline"
      ? transmissionCardValue(card, projection.own.faction) *
          targetAffinity(recipient, projection.own.faction, beliefs) -
          cardUtility(card, projection.own.faction) * 0.15
      : tacticalTransmissionScore(
          card,
          command.method,
          recipient,
          command.direction,
          projection,
          beliefs,
          { ...policy, routeAwareTransmission: false },
        );
    candidates.push({
      command,
      previousScore,
      score: policy.scoring === "baseline" || !policy.routeAwareTransmission
        ? previousScore
        : tacticalTransmissionScore(
            card,
            command.method,
            recipient,
            command.direction,
            projection,
            beliefs,
            policy,
          ),
    });
  }
  const available = candidates.filter(
    (candidate) => !excluded.has(JSON.stringify(candidate.command)),
  );
  if (available.length === 0) return undefined;
  let selectable = available;
  if (policy.routeAwareTransmission && !policy.routeAwareTransmissionCardChoice) {
    const previousBest = Math.max(...available.map((candidate) => candidate.previousScore));
    const previousBestCandidates = available.filter(
      (candidate) => Math.abs(candidate.previousScore - previousBest) < 0.0001,
    );
    const selectedPrevious = previousBestCandidates[
      pickIndex(previousBestCandidates.length, random)
    ]!;
    selectable = available.filter(
      (candidate) =>
        candidate.command.cardId === selectedPrevious.command.cardId &&
        (policy.routeAwareTransmissionMethodChoice ||
          candidate.command.method === selectedPrevious.command.method),
    );
  }
  const best = Math.max(...selectable.map((candidate) => candidate.score));
  const tied = selectable.filter((candidate) => Math.abs(candidate.score - best) < 0.0001);
  return tied[pickIndex(tied.length, random)]?.command;
}

function tacticalTransmissionScore(
  card: PhysicalCard,
  method: Exclude<PhysicalCard["transmission"], "任意">,
  recipientId: string | undefined,
  direction: "clockwise" | "counterclockwise" | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  policy: BotPolicy,
): number {
  const opportunityCost = cardUtility(card, projection.own.faction) * 0.15;
  const recipientUtility = receiptUtility(
    card,
    recipientId,
    projection,
    beliefs,
  ) + alliedProgressConcentrationBonus(
    card.color,
    recipientId,
    projection,
    beliefs,
    policy,
  );
  if (policy.routeAwareTransmission) {
    const routeUtility = expectedTransmissionRouteUtility(
      card,
      method,
      recipientId,
      direction,
      projection,
      beliefs,
    );
    if (card.name !== "危险情报") {
      return routeUtility +
        (method === "直达"
          ? transmissionCardValue(card, projection.own.faction) * 0.1
          : 0) -
        opportunityCost;
    }
    const methodBonus = method === "密电" ? 3 : method === "直达" ? 1 : 0;
    return method === "文本"
      ? dangerousTextPlanUtility(
          routeUtility,
          card,
          recipientId,
          projection,
          beliefs,
        ) - opportunityCost
      : routeUtility + methodBonus - opportunityCost;
  }
  if (card.name !== "危险情报" || !policy.methodAwareDangerousTransmission) {
    return recipientUtility +
      (method === "直达"
        ? transmissionCardValue(card, projection.own.faction) * 0.1
        : 0) -
      opportunityCost;
  }

  const ownReturnUtility = receiptUtility(
    card,
    projection.own.id,
    projection,
    beliefs,
  );
  if (method === "密电") {
    return recipientUtility * 0.7 + 3 - opportunityCost;
  }
  if (method === "直达") {
    const acceptance = dangerousDirectAcceptanceProbability(
      recipientId,
      projection,
      beliefs,
    );
    return recipientUtility * acceptance +
      ownReturnUtility * (1 - acceptance) +
      1 -
      opportunityCost;
  }

  const visibleAcceptance = dangerousTextAcceptanceProbability(
    recipientId,
    projection,
    beliefs,
  );
  return dangerousTextPlanUtility(
    recipientUtility * visibleAcceptance +
      ownReturnUtility * (1 - visibleAcceptance),
    card,
    recipientId,
    projection,
    beliefs,
  ) - opportunityCost;
}

function dangerousTextPlanUtility(
  passiveRouteUtility: number,
  card: PhysicalCard,
  recipientId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  const recipientUtility = receiptUtility(card, recipientId, projection, beliefs);
  const plans = [passiveRouteUtility];
  const lock = projection.own.hand.find((candidate) => candidate.name === "锁定");
  if (lock) {
    plans.push(
      recipientUtility - cardUtility(lock, projection.own.faction) * 0.6,
    );
  }
  const transfer = projection.own.hand.find(
    (candidate) => candidate.name === "转移",
  );
  if (transfer) {
    const bestCommittedTarget = Math.max(
      ...projection.players
        .filter((player) => player.alive && player.id !== projection.own.id)
        .map((player) =>
          receiptUtility(card, player.id, projection, beliefs)
        ),
    );
    plans.push(
      bestCommittedTarget -
        cardUtility(transfer, projection.own.faction) * 0.6,
    );
  }
  for (const swap of projection.own.hand.filter(
    (candidate) => candidate.name === "掉包",
  )) {
    plans.push(
      receiptUtility(swap, projection.own.id, projection, beliefs) -
        cardUtility(swap, projection.own.faction) * 0.6,
    );
  }
  return Math.max(...plans);
}

function expectedTransmissionRouteUtility(
  card: PhysicalCard,
  method: Exclude<PhysicalCard["transmission"], "任意">,
  recipientId: string | undefined,
  direction: "clockwise" | "counterclockwise" | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  if (!recipientId) return 0;
  const route = passiveTransmissionRoute(
    method,
    recipientId,
    direction,
    projection,
  );
  let probabilityToReach = 1;
  let expectedUtility = 0;
  for (const playerId of route) {
    if (playerId === projection.own.id) {
      expectedUtility += probabilityToReach *
        receiptUtility(card, playerId, projection, beliefs);
      break;
    }
    const acceptance = transmissionAcceptanceProbability(
      card,
      method,
      playerId,
      projection,
      beliefs,
    );
    expectedUtility += probabilityToReach * acceptance *
      receiptUtility(card, playerId, projection, beliefs);
    probabilityToReach *= 1 - acceptance;
  }
  return expectedUtility;
}

function passiveTransmissionRoute(
  method: Exclude<PhysicalCard["transmission"], "任意">,
  recipientId: string,
  direction: "clockwise" | "counterclockwise" | undefined,
  projection: PlayerProjection,
): string[] {
  if (method === "直达") return [recipientId, projection.own.id];
  const route = [recipientId];
  const step = direction === "counterclockwise" ? -1 : 1;
  let index = projection.seatOrder.indexOf(recipientId);
  for (let offset = 0; offset < projection.seatOrder.length; offset += 1) {
    index = (index + step + projection.seatOrder.length) % projection.seatOrder.length;
    const playerId = projection.seatOrder[index]!;
    if (!projection.players.find((player) => player.id === playerId)?.alive) continue;
    route.push(playerId);
    if (playerId === projection.own.id) break;
  }
  return route;
}

function transmissionAcceptanceProbability(
  card: PhysicalCard,
  method: Exclude<PhysicalCard["transmission"], "任意">,
  recipientId: string,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  if (method === "文本") {
    return card.color === "黑"
      ? dangerousTextAcceptanceProbability(recipientId, projection, beliefs)
      : 0.95;
  }
  return dangerousDirectAcceptanceProbability(recipientId, projection, beliefs);
}

function dangerousTextAcceptanceProbability(
  recipientId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  if (!recipientId) return 0;
  const recipient = projection.players.find((player) => player.id === recipientId);
  if (!recipient) return 0;
  const counts = countIntelligence(recipient.intelligence);
  const agentProbability = beliefs[recipientId]?.特工 ?? 1 / 3;
  if (counts.black >= 2) return 0.01;
  return counts.physical >= 5
    ? 0.01 + agentProbability * 0.97
    : 0.01 + agentProbability * 0.14;
}

function dangerousDirectAcceptanceProbability(
  recipientId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  if (!recipientId) return 0;
  const recipient = projection.players.find((player) => player.id === recipientId);
  if (!recipient) return 0;
  const counts = countIntelligence(recipient.intelligence);
  const agentProbability = beliefs[recipientId]?.特工 ?? 1 / 3;
  const ordinaryHiddenAcceptance = 0.45;
  if (counts.physical === 5 && counts.black <= 1) {
    return ordinaryHiddenAcceptance +
      agentProbability * (0.99 - ordinaryHiddenAcceptance);
  }
  return ordinaryHiddenAcceptance;
}

function intelligenceValue(card: PhysicalCard | undefined, faction: Faction, blackCount: number): number {
  if (!card) return 3;
  if (card.color === "黑") return blackCount >= 2 ? -100 : faction === "特工" ? 4 : -18;
  if (faction === "特工") return 15;
  const desired = faction === "军情" ? "蓝" : "红";
  return card.color === desired || card.color === "红蓝" ? 38 : -8;
}

/** Utility of adding intelligence to a recipient, including guaranteed outcomes when its face is hidden. */
export function receiptUtility(
  card: PhysicalCard | undefined,
  recipientId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  if (!recipientId) return 0;
  const recipient = projection.players.find((player) => player.id === recipientId);
  if (!recipient) return 0;
  const before = countIntelligence(recipient.intelligence);
  const probabilities = recipientId === projection.own.id
    ? oneHot(projection.own.faction)
    : beliefs[recipientId] ?? { 军情: 1 / 3, 潜伏: 1 / 3, 特工: 1 / 3 };
  if (!card) {
    // A sixth physical card always wins for a 特工 unless it could also be
    // their third black. With at most one current black, even a hidden card is safe.
    if (before.physical === 5 && before.black <= 1) {
      const after = { ...before, physical: before.physical + 1 };
      return probabilities.特工 * (
        playerBoardUtility(after, "特工", recipientId, projection.own.id, projection.own.faction)
        - playerBoardUtility(before, "特工", recipientId, projection.own.id, projection.own.faction)
      );
    }
    return 0;
  }
  const after = addIntelligence(before, card);
  return FACTIONS.reduce((total, faction) => total + probabilities[faction] * (
    playerBoardUtility(after, faction, recipientId, projection.own.id, projection.own.faction)
    - playerBoardUtility(before, faction, recipientId, projection.own.id, projection.own.faction)
  ), 0);
}

function receiptColorUtility(
  color: PhysicalCard["color"],
  recipientId: string,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  const recipient = projection.players.find((player) => player.id === recipientId);
  if (!recipient) return 0;
  const before = countIntelligence(recipient.intelligence);
  const after = {
    red: before.red + (color === "红" || color === "红蓝" ? 1 : 0),
    blue: before.blue + (color === "蓝" || color === "红蓝" ? 1 : 0),
    black: before.black + (color === "黑" ? 1 : 0),
    physical: before.physical + 1,
  };
  const probabilities = recipientId === projection.own.id
    ? oneHot(projection.own.faction)
    : beliefs[recipientId] ?? { 军情: 1 / 3, 潜伏: 1 / 3, 特工: 1 / 3 };
  return FACTIONS.reduce((total, faction) => total + probabilities[faction] * (
    playerBoardUtility(after, faction, recipientId, projection.own.id, projection.own.faction)
    - playerBoardUtility(before, faction, recipientId, projection.own.id, projection.own.faction)
  ), 0);
}

function currentTransmissionReceiptUtility(
  recipientId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  inference?: BotMemory["transmissionInference"],
): number {
  if (!recipientId || projection.transmission?.card) {
    return receiptUtility(projection.transmission?.card, recipientId, projection, beliefs);
  }
  if (inference?.knownCard) {
    return receiptUtility(inference.knownCard, recipientId, projection, beliefs);
  }
  if (inference?.forcedColor) {
    const possibleColors: readonly PhysicalCard["color"][] = inference.forcedColor === "黑"
      ? ["黑"]
      : [inference.forcedColor, "红蓝"];
    return possibleColors.reduce(
      (total, color) => total + receiptColorUtility(color, recipientId, projection, beliefs),
      0,
    ) / possibleColors.length;
  }
  if (inference?.blackProbability === undefined) {
    return receiptUtility(undefined, recipientId, projection, beliefs);
  }
  const blackProbability = Math.max(0, Math.min(1, inference.blackProbability));
  const otherColorProbability = (1 - blackProbability) / 2;
  return blackProbability * receiptColorUtility("黑", recipientId, projection, beliefs)
    + otherColorProbability * receiptColorUtility("红", recipientId, projection, beliefs)
    + otherColorProbability * receiptColorUtility("蓝", recipientId, projection, beliefs);
}

function currentTransmissionAlliedProgressBonus(
  recipientId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  inference: BotMemory["transmissionInference"] | undefined,
  policy: BotPolicy,
): number {
  if (!recipientId) return 0;
  const card = projection.transmission?.card;
  if (card) {
    return alliedProgressConcentrationBonus(
      card.color,
      recipientId,
      projection,
      beliefs,
      policy,
    );
  }
  if (inference?.knownCard) {
    return alliedProgressConcentrationBonus(
      inference.knownCard.color,
      recipientId,
      projection,
      beliefs,
      policy,
    );
  }
  if (inference?.forcedColor) {
    const possibleColors: readonly PhysicalCard["color"][] = inference.forcedColor === "黑"
      ? ["黑"]
      : [inference.forcedColor, "红蓝"];
    return possibleColors.reduce(
      (total, color) => total + alliedProgressConcentrationBonus(
        color,
        recipientId,
        projection,
        beliefs,
        policy,
      ),
      0,
    ) / possibleColors.length;
  }
  if (inference?.blackProbability === undefined) return 0;
  const blackProbability = Math.max(0, Math.min(1, inference.blackProbability));
  const otherColorProbability = (1 - blackProbability) / 2;
  return otherColorProbability * (
    alliedProgressConcentrationBonus("红", recipientId, projection, beliefs, policy) +
    alliedProgressConcentrationBonus("蓝", recipientId, projection, beliefs, policy)
  );
}

function alliedProgressConcentrationBonus(
  color: PhysicalCard["color"],
  recipientId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  policy: BotPolicy,
): number {
  if (
    !policy.alliedProgressConcentration ||
    !recipientId ||
    recipientId === projection.own.id ||
    projection.own.faction === "特工"
  ) {
    return 0;
  }
  const desiredColor = projection.own.faction === "军情" ? "蓝" : "红";
  if (color !== desiredColor && color !== "红蓝") return 0;
  const allyProbability = beliefs[recipientId]?.[projection.own.faction] ?? 0;
  if (allyProbability < 0.7) return 0;
  const recipient = projection.players.find((player) => player.id === recipientId);
  const ownPlayer = projection.players.find((player) => player.id === projection.own.id);
  if (!recipient || !ownPlayer) return 0;
  const recipientCounts = countIntelligence(recipient.intelligence);
  const ownCounts = countIntelligence(ownPlayer.intelligence);
  if (recipientCounts.black > 1) return 0;
  const recipientProgress = projection.own.faction === "军情"
    ? recipientCounts.blue
    : recipientCounts.red;
  const ownProgress = projection.own.faction === "军情"
    ? ownCounts.blue
    : ownCounts.red;
  const progressLead = recipientProgress - ownProgress;
  if (progressLead <= 0) return 0;
  const confidence = Math.max(0, Math.min(1, (allyProbability - 0.5) * 2));
  const blackSafety = recipientCounts.black === 0 ? 1 : 0.7;
  return progressLead * ALLIED_PROGRESS_CONCENTRATION_BONUS * confidence * blackSafety;
}

function recipientColorUtility(
  color: PhysicalCard["color"],
  recipientId: string,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  const recipient = projection.players.find((player) => player.id === recipientId);
  if (!recipient) return 0;
  const before = countIntelligence(recipient.intelligence);
  const after = {
    red: before.red + (color === "红" || color === "红蓝" ? 1 : 0),
    blue: before.blue + (color === "蓝" || color === "红蓝" ? 1 : 0),
    black: before.black + (color === "黑" ? 1 : 0),
    physical: before.physical + 1,
  };
  const probabilities = recipientId === projection.own.id
    ? oneHot(projection.own.faction)
    : beliefs[recipientId] ?? { 军情: 1 / 3, 潜伏: 1 / 3, 特工: 1 / 3 };
  return FACTIONS.reduce((total, faction) => total + probabilities[faction] * (
    playerBoardUtility(after, faction, recipientId, recipientId, faction)
    - playerBoardUtility(before, faction, recipientId, recipientId, faction)
  ), 0);
}

function currentTransmissionRecipientUtility(
  recipientId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  inference?: BotMemory["transmissionInference"],
): number {
  if (!recipientId) return 0;
  const card = projection.transmission?.card;
  if (card) return recipientColorUtility(card.color, recipientId, projection, beliefs);
  if (inference?.knownCard) {
    return recipientColorUtility(inference.knownCard.color, recipientId, projection, beliefs);
  }
  if (inference?.forcedColor) {
    const possibleColors: readonly PhysicalCard["color"][] = inference.forcedColor === "黑"
      ? ["黑"]
      : [inference.forcedColor, "红蓝"];
    return possibleColors.reduce(
      (total, color) => total + recipientColorUtility(color, recipientId, projection, beliefs),
      0,
    ) / possibleColors.length;
  }
  if (inference?.blackProbability === undefined) return 0;
  const blackProbability = Math.max(0, Math.min(1, inference.blackProbability));
  const otherColorProbability = (1 - blackProbability) / 2;
  return blackProbability * recipientColorUtility("黑", recipientId, projection, beliefs)
    + otherColorProbability * recipientColorUtility("红", recipientId, projection, beliefs)
    + otherColorProbability * recipientColorUtility("蓝", recipientId, projection, beliefs);
}

function secretOrderImprovement(
  orderCard: PhysicalCard | undefined,
  word: Extract<LegalAction, { type: "PLAY_SECRET_ORDER" }>["word"],
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  if (orderCard?.variant?.kind !== "secretOrder") return 0;
  const targetId = projection.pendingSecretOrder?.targetPlayerId;
  if (!targetId) return 0;
  const requiredColor = orderCard.variant.mapping[word];
  const colors = ["红", "蓝", "黑"] as const satisfies readonly SingleColor[];
  const forcedUtility = receiptColorUtility(requiredColor, targetId, projection, beliefs);
  const targetBestUtility = Math.min(...colors.map((color) =>
    receiptColorUtility(color, targetId, projection, beliefs)
  ));
  const opponentConfidence = projection.own.faction === "特工"
    ? 1
    : 1 - (beliefs[targetId]?.[projection.own.faction] ?? 1 / 3);
  return Math.max(0, forcedUtility - targetBestUtility) * opponentConfidence;
}

function knownHandSecretOrderConstraint(
  orderCard: PhysicalCard | undefined,
  word: Extract<LegalAction, { type: "PLAY_SECRET_ORDER" }>["word"],
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  policy: BotPolicy,
  knownHands: BotMemory["knownHands"],
): { verifiedNoMatch: boolean; improvement: number } | undefined {
  const weight = policy.knownHandSecretOrderWeight ?? 0;
  if (
    (!policy.avoidKnownSecretOrderNoMatch && weight <= 0) ||
    orderCard?.variant?.kind !== "secretOrder"
  ) return undefined;
  const targetId = projection.pendingSecretOrder?.targetPlayerId;
  if (!targetId) return undefined;
  const tracked = knownHands[targetId];
  if (!tracked || tracked.unknownCount !== 0) return undefined;

  const requiredColor = orderCard.variant.mapping[word];
  const matchingCards = tracked.cards.filter((heldCard) => matchesColor(heldCard, requiredColor));
  if (matchingCards.length === 0) return { verifiedNoMatch: true, improvement: 0 };

  const belief = beliefs[targetId] ?? { 军情: 1 / 3, 潜伏: 1 / 3, 特工: 1 / 3 };
  const expectedTransmissionValue = (heldCard: PhysicalCard): number =>
    FACTIONS.reduce(
      (total, faction) => total + belief[faction] * transmissionCardValue(heldCard, faction),
      0,
    );
  const unrestrictedBest = Math.max(...tracked.cards.map(expectedTransmissionValue));
  const forcedBest = Math.max(...matchingCards.map(expectedTransmissionValue));
  const opponentConfidence = projection.own.faction === "特工"
    ? 1
    : 1 - (beliefs[targetId]?.[projection.own.faction] ?? 1 / 3);
  return {
    verifiedNoMatch: false,
    improvement: Math.max(0, unrestrictedBest - forcedBest) * opponentConfidence * weight,
  };
}

function upstreamSecretOrderSupportBonus(
  orderCard: PhysicalCard | undefined,
  word: Extract<LegalAction, { type: "PLAY_SECRET_ORDER" }>["word"],
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  targetAffinityTowardBot: number,
  policy: BotPolicy,
  knownHands: BotMemory["knownHands"],
): number {
  const weight = policy.upstreamSecretOrderSupportWeight ?? 0;
  if (weight <= 0 || orderCard?.variant?.kind !== "secretOrder") return 0;
  const desiredColor = projection.own.faction === "军情"
    ? "蓝"
    : projection.own.faction === "潜伏"
      ? "红"
      : undefined;
  const targetId = projection.pendingSecretOrder?.targetPlayerId;
  const requiredColor = orderCard.variant.mapping[word];
  if (
    !targetId ||
    requiredColor !== desiredColor ||
    immediateUpstreamPlayerId(projection.own.id, projection) !== targetId
  ) return 0;

  const allyConfidence = Math.max(
    0,
    Math.min(1, targetAffinity(targetId, projection.own.faction, beliefs)),
  );
  const cooperationChance = allyConfidence * (
    0.55 + Math.max(0, Math.min(1, targetAffinityTowardBot)) * 0.25
  );

  const deckMatchingCards = PHYSICAL_DECK.filter((heldCard) =>
    matchesColor(heldCard, requiredColor)
  );
  const forcedClockwisePrior = deckMatchingCards.filter(isForcedClockwiseTransmission).length /
    Math.max(1, deckMatchingCards.length);
  let forcedRouteProbability = forcedClockwisePrior;
  const tracked = knownHands[targetId];
  if (tracked?.unknownCount === 0) {
    const matchingCards = tracked.cards.filter((heldCard) => matchesColor(heldCard, requiredColor));
    if (matchingCards.length === 0) return 0;
    // A hostile sender can escape whenever even one matching card can choose
    // another direction, method, or direct target. Otherwise the clockwise
    // route is forced and this bot is the first recipient.
    forcedRouteProbability = matchingCards.every(isForcedClockwiseTransmission) ? 1 : 0;
  }

  const routeProbability = forcedRouteProbability +
    (1 - forcedRouteProbability) * cooperationChance;
  const receiptProgress = Math.min(
    64,
    Math.max(0, receiptColorUtility(requiredColor, projection.own.id, projection, beliefs)),
  );
  return receiptProgress * routeProbability * weight;
}

function isForcedClockwiseTransmission(card: PhysicalCard): boolean {
  return card.transmission !== "直达" && card.transmission !== "任意" && !card.circle;
}

/** A public-board score useful for benchmarks and future shallow search. */
export function evaluatePublicPosition(
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  if (projection.winner) {
    if (projection.winner.kind === "agent") return projection.winner.playerId === projection.own.id ? 10_000 : -10_000;
    return projection.winner.faction === projection.own.faction ? 10_000 : -10_000;
  }
  return projection.players.reduce((total, player) => {
    const probabilities = player.id === projection.own.id
      ? oneHot(projection.own.faction)
      : beliefs[player.id] ?? { 军情: 1 / 3, 潜伏: 1 / 3, 特工: 1 / 3 };
    const counts = countIntelligence(player.intelligence);
    return total + FACTIONS.reduce((value, faction) => value + probabilities[faction]
      * playerBoardUtility(counts, faction, player.id, projection.own.id, projection.own.faction), 0);
  }, projection.own.hand.reduce((total, heldCard) => total + cardUtility(heldCard, projection.own.faction) * 0.15, 0));
}

function swapImprovement(
  replacement: PhysicalCard | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  transmissionInference?: BotMemory["transmissionInference"],
): number {
  const recipient = projection.transmission?.intendedRecipientId;
  return receiptUtility(replacement, recipient, projection, beliefs)
    - currentTransmissionReceiptUtility(recipient, projection, beliefs, transmissionInference);
}

function currentRecipientLikelyToAccept(
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  transmissionInference?: BotMemory["transmissionInference"],
): boolean {
  const transmission = projection.transmission;
  if (!transmission) return false;
  if (
    transmission.recipientMustAccept ||
    transmission.transferredRecipientCommitted ||
    transmission.lockedRecipientId === transmission.intendedRecipientId ||
    transmission.returnedToSender
  ) {
    return true;
  }
  if (transmission.card?.color !== undefined && transmission.card.color !== "黑") {
    return true;
  }
  return currentTransmissionRecipientUtility(
    transmission.intendedRecipientId,
    projection,
    beliefs,
    transmissionInference,
  ) > 0;
}

function redirectedLockReceiptPenalty(
  projection: PlayerProjection,
  inference: BotMemory["transmissionInference"] | undefined,
  penalty: number,
): number {
  const transmission = projection.transmission;
  if (
    penalty <= 0 ||
    !transmission ||
    transmission.intendedRecipientId !== projection.own.id ||
    !transmission.locked ||
    !transmission.lockedRecipientId ||
    transmission.lockedRecipientId === projection.own.id ||
    transmission.card ||
    inference?.knownCard ||
    inference?.forcedColor
  ) {
    return 0;
  }

  return inference?.lock?.originalTargetId === projection.own.id &&
      inference.lock.redirected
    ? penalty
    : 0;
}

function expectedCurrentReceiptUtilityOnPass(
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  transmissionInference?: BotMemory["transmissionInference"],
): number {
  const transmission = projection.transmission;
  const recipientId = transmission?.intendedRecipientId;
  if (!transmission || !recipientId) return 0;
  const committed =
    transmission.recipientMustAccept ||
    transmission.transferredRecipientCommitted ||
    transmission.lockedRecipientId === recipientId ||
    transmission.returnedToSender;
  if (
    !committed &&
    currentTransmissionRecipientUtility(
      recipientId,
      projection,
      beliefs,
      transmissionInference,
    ) <= 0
  ) {
    return 0;
  }
  return currentTransmissionReceiptUtility(
    recipientId,
    projection,
    beliefs,
    transmissionInference,
  );
}

function isUnchangedOwnTransferCommitment(projection: PlayerProjection): boolean {
  const transmission = projection.transmission;
  if (!transmission?.transferredRecipientCommitted) return false;
  let resolutionIndex = -1;
  for (let index = projection.auditLog.length - 1; index >= 0; index -= 1) {
    if (projection.auditLog[index] === `转移结算，当前接收者：${transmission.intendedRecipientId}`) {
      resolutionIndex = index;
      break;
    }
  }
  if (resolutionIndex < 0) return false;
  let useIndex = -1;
  for (let index = resolutionIndex - 1; index >= 0; index -= 1) {
    if (projection.auditLog[index] === `${projection.own.id}使用转移，声明新的接收者：${transmission.intendedRecipientId}`) {
      useIndex = index;
      break;
    }
  }
  if (useIndex < 0) return false;
  return !projection.auditLog.slice(useIndex + 1).some(
    (entry) =>
      entry.startsWith("离间结算：") ||
      entry.startsWith("掉包结算：") ||
      entry === `${projection.own.id}完成破译`,
  );
}

function activeFunctionTargetUtility(
  targetId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  policy: BotPolicy,
  spentCardId?: PhysicalCardId,
): number {
  if (!targetId) return 0;
  switch (projection.activeFunctionAction?.kind) {
    case "dangerousIntelligence":
      return -10 * targetAffinity(targetId, projection.own.faction, beliefs);
    case "publicText":
      return policy.publicTextExchangeScoring
        ? publicTextExchangeUtility(targetId, projection, beliefs, spentCardId)
        : -5 * targetAffinity(targetId, projection.own.faction, beliefs);
    default:
      return 0;
  }
}

const UNKNOWN_HAND_CARD_UTILITY = 8;

function publicTextExchangeUtility(
  targetId: string,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  spentCardId?: PhysicalCardId,
): number {
  const action = projection.activeFunctionAction;
  const sourceCard = action?.sourceCard;
  if (!action || action.kind !== "publicText" || !sourceCard) {
    return -5 * targetAffinity(targetId, projection.own.faction, beliefs);
  }

  const receivedValue = relationshipWeightedCardUtility(
    sourceCard,
    targetId,
    projection,
    beliefs,
  );
  if (targetId !== projection.own.id) {
    return receivedValue -
      relationshipWeightedUnknownCardUtility(targetId, projection, beliefs) +
      relationshipWeightedUnknownCardUtility(
        action.sourcePlayerId,
        projection,
        beliefs,
      );
  }

  const exchangePool = projection.own.hand.filter(
    (card) => card.id !== spentCardId,
  );
  if (exchangePool.length === 0) return receivedValue;
  return exchangePool.reduce((total, lostCard) => {
    const sourceGain = lostCard.name === "公开文本"
      ? 0
      : relationshipWeightedCardUtility(
          lostCard,
          action.sourcePlayerId,
          projection,
          beliefs,
        );
    return total + receivedValue -
      relationshipWeightedCardUtility(
        lostCard,
        targetId,
        projection,
        beliefs,
      ) + sourceGain;
  }, 0) / exchangePool.length;
}

function relationshipWeightedCardUtility(
  card: PhysicalCard,
  playerId: string,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  const probabilities = playerId === projection.own.id
    ? oneHot(projection.own.faction)
    : beliefs[playerId] ?? { 军情: 1 / 3, 潜伏: 1 / 3, 特工: 1 / 3 };
  return FACTIONS.reduce((total, faction) =>
    total + probabilities[faction] * factionRelationshipSign(
      projection.own.faction,
      faction,
    ) * cardUtility(card, faction), 0);
}

function relationshipWeightedUnknownCardUtility(
  playerId: string,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  const probabilities = playerId === projection.own.id
    ? oneHot(projection.own.faction)
    : beliefs[playerId] ?? { 军情: 1 / 3, 潜伏: 1 / 3, 特工: 1 / 3 };
  return FACTIONS.reduce((total, faction) =>
    total + probabilities[faction] * factionRelationshipSign(
      projection.own.faction,
      faction,
    ) * UNKNOWN_HAND_CARD_UTILITY, 0);
}

function factionRelationshipSign(ownFaction: Faction, playerFaction: Faction): number {
  return ownFaction !== "特工" && playerFaction === ownFaction ? 1 : -1;
}

function burnUtility(
  targetId: string,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  const target = projection.players.find((player) => player.id === targetId);
  if (!target) return 0;
  const before = countIntelligence(target.intelligence);
  const after = { ...before, black: Math.max(0, before.black - 1), physical: Math.max(0, before.physical - 1) };
  const probabilities = targetId === projection.own.id
    ? oneHot(projection.own.faction)
    : beliefs[targetId] ?? { 军情: 1 / 3, 潜伏: 1 / 3, 特工: 1 / 3 };
  return FACTIONS.reduce((total, faction) => total + probabilities[faction] * (
    playerBoardUtility(after, faction, targetId, projection.own.id, projection.own.faction)
    - playerBoardUtility(before, faction, targetId, projection.own.id, projection.own.faction)
  ), 0);
}

function shouldDeferBurnUntilAfterReceipt(
  targetId: string,
  projection: PlayerProjection,
): boolean {
  if (!projection.legalActions.some((action) => action.type === "ACCEPT_INTELLIGENCE")) {
    return false;
  }
  if (targetId !== projection.own.id) return true;

  const ownPlayer = projection.players.find((player) => player.id === projection.own.id);
  const ownBlackCount = ownPlayer
    ? countIntelligence(ownPlayer.intelligence).black
    : 0;
  if (ownBlackCount < 2) return true;

  const incoming = projection.transmission?.card;
  return incoming !== undefined && incoming.color !== "黑";
}

function hasPlayableReinforcement(projection: PlayerProjection): boolean {
  return projection.legalActions.some(
    (action) => action.type === "PLAY_REINFORCEMENT",
  );
}

function pendingInteractionUtility(
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  policy: BotPolicy,
): number {
  const frames = projection.responseStack;
  if (frames.length === 0) return 0;
  const values = new Map<string, number>();
  for (const frame of frames) {
    let value: number;
    if (frame.kind === "counter") {
      value = -(frame.targetInteractionId ? values.get(frame.targetInteractionId) ?? 0 : 0);
    } else if (frame.kind === "intelligence") {
      value = receiptUtility(projection.transmission?.card, frame.targetPlayerId, projection, beliefs);
    } else {
      value = cardActionUtility(
        frame.cardName,
        frame.sourcePlayerId,
        frame.targetPlayerId,
        projection,
        beliefs,
        policy,
      );
    }
    values.set(frame.id, value);
  }
  return values.get(frames.at(-1)!.id) ?? 0;
}

function hiddenProbeUtility(
  sourceId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  const knownProbeIds = new Set([
    ...projection.own.hand
      .filter((card) => card.name === "试探")
      .map((card) => card.id),
    ...projection.privateNotices.flatMap((notice) =>
      (notice.kind === "probePlayed" || notice.kind === "probeReceived") &&
          "card" in notice && notice.card.name === "试探"
        ? [notice.card.id]
        : []
    ),
  ]);
  const possibleProbes: PhysicalCard[] = PHYSICAL_DECK.filter(
    (card) => card.name === "试探" && !knownProbeIds.has(card.id),
  ).map((card) => card as PhysicalCard);
  if (possibleProbes.length === 0) return -10;

  const identityUtility = Math.max(
    probeIdentityChoiceUtility("announce", sourceId, projection, beliefs),
    probeIdentityChoiceUtility("giveRandom", sourceId, projection, beliefs),
  );
  const leastValuableHeldCard = projection.own.hand.reduce<PhysicalCard | undefined>(
    (least, card) =>
      !least || cardUtility(card, projection.own.faction) <
          cardUtility(least, projection.own.faction)
        ? card
        : least,
    undefined,
  );
  const discardUtility = leastValuableHeldCard
    ? -cardUtility(leastValuableHeldCard, projection.own.faction)
    : 0;

  return possibleProbes.reduce((total, probe) => {
    if (probe.variant?.kind === "probeIdentity") {
      return total + identityUtility;
    }
    if (probe.variant?.kind === "probeDrawDiscard") {
      return total + (
        probe.variant.drawFaction === projection.own.faction
          ? UNKNOWN_HAND_CARD_UTILITY
          : discardUtility
      );
    }
    return total;
  }, 0) / possibleProbes.length;
}

function probeIdentityChoiceUtility(
  choice: "announce" | "giveRandom",
  sourceId: string | undefined,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  if (choice === "announce") {
    const sourceAffinity = targetAffinity(
      sourceId,
      projection.own.faction,
      beliefs,
    );
    return sourceAffinity >= 0
      ? 4 * sourceAffinity
      : 12 * sourceAffinity;
  }
  if (projection.own.hand.length === 0) return Number.NEGATIVE_INFINITY;
  return projection.own.hand.reduce((total, card) =>
    total - cardUtility(card, projection.own.faction) +
    relationshipWeightedCardUtility(
      card,
      sourceId ?? "",
      projection,
      beliefs,
    ), 0) / projection.own.hand.length;
}

function cardActionUtility(
  name: PhysicalCard["name"] | undefined,
  sourceId: string | undefined,
  targetId: string,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  policy: BotPolicy,
): number {
  const affinity = targetAffinity(targetId, projection.own.faction, beliefs);
  switch (name) {
    case "危险情报":
      return -10 * affinity;
    case "试探":
      return policy.probeCounterAffinityScoring && targetId === projection.own.id
        ? hiddenProbeUtility(sourceId, projection, beliefs) +
          (policy.incomingProbeAffinityWeight ?? 0) * targetAffinity(
            sourceId,
            projection.own.faction,
            beliefs,
          )
        : -10 * affinity;
    case "秘密下达":
      return -10 * affinity;
    case "增援":
    case "机密文件":
    case "公开文本":
    case "破译":
      return 10 * targetAffinity(sourceId ?? targetId, projection.own.faction, beliefs);
    case "烧毁":
      return burnUtility(targetId, projection, beliefs);
    case "锁定":
      return receiptUtility(projection.transmission?.card, targetId, projection, beliefs);
    case "调虎离山":
      return -receiptUtility(projection.transmission?.card, targetId, projection, beliefs);
    case "转移":
    case "离间":
      return receiptUtility(projection.transmission?.card, targetId, projection, beliefs);
    case "截获":
      return receiptUtility(projection.transmission?.card, sourceId, projection, beliefs);
    case "掉包": {
      const replacement = sourceId === projection.own.id
        ? projection.own.hand.find((held) => held.name === "掉包")
        : undefined;
      return receiptUtility(replacement, targetId, projection, beliefs)
        - receiptUtility(projection.transmission?.card, targetId, projection, beliefs);
    }
    default:
      return 0;
  }
}

function playerBoardUtility(
  counts: IntelligenceCounts,
  playerFaction: Faction,
  playerId: string,
  botId: string,
  botFaction: Faction,
): number {
  const isBot = playerId === botId;
  const aligned = botFaction !== "特工" && playerFaction === botFaction;
  const sign = isBot || aligned ? 1 : -1;
  if (counts.black >= 3) return isBot ? -10_000 : aligned ? -1_200 : 900;
  if (playerFaction === "特工" && counts.physical >= 6) return isBot ? 10_000 : -10_000;
  const desired = playerFaction === "军情" ? counts.blue : playerFaction === "潜伏" ? counts.red : counts.physical;
  if (playerFaction !== "特工" && desired >= 3) return sign * 10_000;
  const progress = playerFaction === "特工" ? desired * 16 : desired * 32;
  const blackRisk = counts.black === 2 ? 90 : counts.black * 15;
  return sign * (progress - blackRisk);
}

function countIntelligence(cards: readonly PhysicalCard[]): IntelligenceCounts {
  return cards.reduce<IntelligenceCounts>((counts, card) => {
    counts.physical += 1;
    if (card.color === "红" || card.color === "红蓝") counts.red += 1;
    if (card.color === "蓝" || card.color === "红蓝") counts.blue += 1;
    if (card.color === "黑") counts.black += 1;
    return counts;
  }, { red: 0, blue: 0, black: 0, physical: 0 });
}

function hasFourTrueIntelligence(playerId: string, projection: PlayerProjection): boolean {
  if (playerId !== projection.own.id || projection.own.faction !== "特工") return false;
  const player = projection.players.find((candidate) => candidate.id === playerId);
  if (!player) return false;
  const counts = countIntelligence(player.intelligence);
  return counts.physical - counts.black >= 4;
}

function incomingIntelligenceIsSafeForAgent(
  projection: PlayerProjection,
  inference?: BotMemory["transmissionInference"],
): boolean {
  const player = projection.players.find((candidate) => candidate.id === projection.own.id);
  if (!player) return false;
  const blackCount = countIntelligence(player.intelligence).black;
  const knownOrForcedBlack = projection.transmission?.card?.color === "黑" ||
    (!projection.transmission?.card && inference?.knownCard?.color === "黑") ||
    (!projection.transmission?.card && inference?.forcedColor === "黑");
  return !knownOrForcedBlack || blackCount < 2;
}

function addIntelligence(counts: IntelligenceCounts, card: PhysicalCard): IntelligenceCounts {
  return countIntelligenceFromBase(counts, [card]);
}

function countIntelligenceFromBase(base: IntelligenceCounts, cards: readonly PhysicalCard[]): IntelligenceCounts {
  const added = countIntelligence(cards);
  return {
    red: base.red + added.red,
    blue: base.blue + added.blue,
    black: base.black + added.black,
    physical: base.physical + added.physical,
  };
}

function transmissionCardValue(card: PhysicalCard, faction: Faction): number {
  return intelligenceValue(card, faction, 0);
}

function cardUtility(card: PhysicalCard | undefined, faction: Faction): number {
  if (!card) return 0;
  return functionCardValue(card) + Math.max(0, transmissionCardValue(card, faction) * 0.15);
}

/** Full-information hand value used by offline counterfactual evaluation. */
export function handCardUtility(card: PhysicalCard, faction: Faction): number {
  return cardUtility(card, faction);
}

function functionCardValue(card: PhysicalCard): number {
  const actionValue: Partial<Record<PhysicalCard["name"], number>> = {
    识破: 14, 转移: 12, 截获: 12, 掉包: 11, 锁定: 10, 烧毁: 10,
    增援: 9, 破译: 8, 调虎离山: 8, 离间: 8, 机密文件: 7,
  };
  return actionValue[card.name] ?? 5;
}

function targetAffinity(playerId: string | undefined, faction: Faction, beliefs: Record<string, FactionBelief>): number {
  if (!playerId) return 0;
  const belief = beliefs[playerId];
  if (!belief) return 0;
  return belief[faction] - Math.max(...FACTIONS.filter((entry) => entry !== faction).map((entry) => belief[entry]));
}

function immediateUpstreamPlayerId(
  playerId: string,
  projection: PlayerProjection,
): string | undefined {
  const start = projection.seatOrder.indexOf(playerId);
  if (start < 0) return undefined;
  for (let offset = 1; offset < projection.seatOrder.length; offset += 1) {
    const candidateId = projection.seatOrder[
      (start - offset + projection.seatOrder.length) % projection.seatOrder.length
    ];
    if (projection.players.find((player) => player.id === candidateId)?.alive) {
      return candidateId;
    }
  }
  return undefined;
}

function isCooperativePublicTextHandoff(
  card: PhysicalCard,
  sourceId: string,
  targetId: string,
  sourceFaction: Faction,
  projection: PlayerProjection,
): boolean {
  const matchingColor = sourceFaction === "军情"
    ? "蓝"
    : sourceFaction === "潜伏"
      ? "红"
      : undefined;
  return card.name === "公开文本" &&
    matchingColor !== undefined &&
    card.color === matchingColor &&
    immediateUpstreamPlayerId(sourceId, projection) === targetId;
}

function strategicOpponentThreat(
  playerId: string,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  if (playerId === projection.own.id) return 0;
  const target = projection.players.find((player) => player.id === playerId);
  const belief = beliefs[playerId];
  if (!target || !target.alive || !belief) return 0;
  const counts = countIntelligence(target.intelligence);
  return FACTIONS.reduce((total, faction) => {
    if (projection.own.faction !== "特工" && faction === projection.own.faction) {
      return total;
    }
    const expectedFactionSize = projection.players.reduce((size, player) => {
      if (!player.alive || player.id === projection.own.id) return size;
      return size + (beliefs[player.id]?.[faction] ?? 0);
    }, 0);
    if (faction === "特工") {
      const individualThreat = counts.physical >= 5
        ? 3
        : 0.65 + counts.physical * 0.08;
      return total + belief[faction] * individualThreat;
    }
    const desiredCount = faction === "军情" ? counts.blue : counts.red;
    const factionSizeThreat = 1 + Math.max(0, expectedFactionSize - 1) * 0.4;
    const visibleWinThreat = desiredCount >= 2 ? 1.5 : desiredCount * 0.12;
    return total + belief[faction] * (factionSizeThreat + visibleWinThreat);
  }, 0);
}

function offensiveTargetBaseScore(
  action: Extract<LegalAction, { type: "PLAY_DANGEROUS_INTELLIGENCE" | "PLAY_PROBE" }>,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  if (action.type === "PLAY_DANGEROUS_INTELLIGENCE") {
    return -targetAffinity(action.targetId, projection.own.faction, beliefs) * 8 + 10;
  }
  const card = projection.own.hand.find((held) => held.id === action.cardId);
  return 8 + probeTargetUtility(card, action.targetId, projection, beliefs) * 8 +
    informationUncertainty(action.targetId, beliefs) * 2;
}

function normalizedStrategicTargetScore(
  action: Extract<LegalAction, { type: "PLAY_DANGEROUS_INTELLIGENCE" | "PLAY_PROBE" }>,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  scale: number,
  policy?: BotPolicy,
  knownHands: BotMemory["knownHands"] = {},
): number {
  const comparable = projection.legalActions.filter(
    (candidate): candidate is typeof action =>
      candidate.type === action.type && candidate.cardId === action.cardId,
  );
  const originalBest = Math.max(
    ...comparable.map((candidate) => offensiveTargetBaseScore(candidate, projection, beliefs)),
  );
  const strategicallyAdjustedBest = Math.max(
    ...comparable.map((candidate) =>
      offensiveTargetBaseScore(candidate, projection, beliefs) +
      strategicOpponentThreat(candidate.targetId, projection, beliefs) * scale +
      knownDangerousDiscardTargetBonus(candidate, projection, beliefs, policy, knownHands)
    ),
  );
  return offensiveTargetBaseScore(action, projection, beliefs) +
    strategicOpponentThreat(action.targetId, projection, beliefs) * scale +
    knownDangerousDiscardTargetBonus(action, projection, beliefs, policy, knownHands) -
    (strategicallyAdjustedBest - originalBest);
}

function knownDangerousDiscardTargetBonus(
  action: Extract<LegalAction, { type: "PLAY_DANGEROUS_INTELLIGENCE" | "PLAY_PROBE" }>,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
  policy: BotPolicy | undefined,
  knownHands: BotMemory["knownHands"],
): number {
  const weight = policy?.knownHandDangerousTargetWeight ?? 0;
  const tracked = knownHands[action.targetId];
  if (action.type !== "PLAY_DANGEROUS_INTELLIGENCE" || weight <= 0 || !tracked?.cards.length) {
    return 0;
  }
  const discardStrategy = policy?.dangerousDiscardStrategy ?? "color-then-function";
  return Math.max(
    0,
    ...tracked.cards.map((card) => dangerousDiscardUtility(
      card,
      action.targetId,
      projection,
      beliefs,
      discardStrategy === "random"
        ? "color-then-function"
        : discardStrategy,
    )),
  ) * weight;
}

function informationUncertainty(playerId: string, beliefs: Record<string, FactionBelief>): number {
  const belief = beliefs[playerId];
  return belief ? 1 - Math.max(...FACTIONS.map((faction) => belief[faction])) : 1;
}

function probeTargetUtility(
  card: PhysicalCard | undefined,
  targetId: string,
  projection: PlayerProjection,
  beliefs: Record<string, FactionBelief>,
): number {
  if (card?.variant?.kind !== "probeDrawDiscard") return 0;
  const drawFaction = card.variant.drawFaction;
  const belief = beliefs[targetId];
  if (!belief) return 0;
  const target = projection.players.find((player) => player.id === targetId);
  return FACTIONS.reduce((total, faction) => {
    const targetDraws = faction === drawFaction;
    const effectActuallyChangesHand = targetDraws || (target?.handCount ?? 0) > 0;
    if (!effectActuallyChangesHand) return total;
    // 特工 are independent even when both have the same printed faction.
    const aligned = projection.own.faction !== "特工" && faction === projection.own.faction;
    const targetBenefit = targetDraws ? 1 : -1;
    return total + belief[faction] * (aligned ? targetBenefit : -targetBenefit);
  }, 0);
}

function ownBlackCount(projection: PlayerProjection): number {
  return projection.players.find((player) => player.id === projection.own.id)?.intelligence.filter((card) => card.color === "黑").length ?? 0;
}

function adjacentLivingPlayer(projection: PlayerProjection, direction: "clockwise" | "counterclockwise"): string {
  const order = direction === "clockwise" ? projection.seatOrder : [...projection.seatOrder].reverse();
  const ownIndex = order.indexOf(projection.own.id);
  for (let offset = 1; offset < order.length; offset += 1) {
    const id = order[(ownIndex + offset) % order.length]!;
    if (projection.players.find((player) => player.id === id)?.alive) return id;
  }
  throw new Error("Cannot transmit without another living player");
}

function matchesColor(card: PhysicalCard, color: SingleColor): boolean {
  return card.color === color || (card.color === "红蓝" && color !== "黑");
}

function decision(command: GameCommand, score: number, reason: string): BotDecision {
  return { command, score, reason };
}

function pickIndex(length: number, random?: BotRandom): number {
  if (length <= 1 || !random) return 0;
  return Math.min(length - 1, Math.floor(random() * length));
}

function snapshot(
  projection: PlayerProjection,
  currentFunction = functionObservation(projection),
): PublicObservation {
  return {
    auditLength: projection.auditLog.length,
    transmission: transmissionObservation(projection),
    functionAction: currentFunction,
    secretOrder: secretOrderObservation(projection),
    players: Object.fromEntries(projection.players.map((player) => [player.id, {
      alive: player.alive,
      faction: player.faction,
      handCount: player.handCount,
      intelligence: [...player.intelligence],
    }])),
    ownHand: [...projection.own.hand],
  };
}

function transmissionObservation(projection: PlayerProjection): PublicObservation["transmission"] {
  const current = projection.transmission;
  if (!current) return undefined;
  let startAuditIndex = -1;
  for (let index = projection.auditLog.length - 1; index >= 0; index -= 1) {
    const entry = projection.auditLog[index]!;
    if (entry.startsWith(`${current.senderId}开始以`) && entry.includes("传递情报")) {
      startAuditIndex = index;
      break;
    }
  }
  return {
    signature: [current.senderId, current.card?.id ?? "hidden", startAuditIndex].join("|"),
    startAuditIndex: Math.max(0, startAuditIndex),
    senderId: current.senderId,
    targetId: current.intendedRecipientId,
    method: current.method,
    direction: current.direction,
    card: current.card,
  };
}

function observeResolvedDirectColorDenial(
  memory: BotMemory,
  projection: PlayerProjection,
  priorTransmission: PublicObservation["transmission"],
  policy: BotPolicy,
): void {
  if (
    !policy.directColorDenialInference ||
    !priorTransmission ||
    priorTransmission.method !== "直达" ||
    projection.transmission ||
    memory.transmissionInference?.signature !== priorTransmission.signature ||
    memory.transmissionInference.initialTargetId !== priorTransmission.targetId ||
    memory.transmissionInference.forcedByPlayerId !== undefined ||
    memory.transmissionInference.replaced
  ) {
    return;
  }
  const sourceId = priorTransmission.senderId;
  const targetId = priorTransmission.targetId;
  if (sourceId === targetId) return;
  const previousTarget = memory.previous?.players[targetId];
  const currentTarget = projection.players.find((player) => player.id === targetId);
  if (!previousTarget || !currentTarget) return;
  const priorCardIds = new Set(previousTarget.intelligence.map((card) => card.id));
  const receivedCard = currentTarget.intelligence.find((card) => !priorCardIds.has(card.id));
  if (!receivedCard || (receivedCard.color !== "红" && receivedCard.color !== "蓝")) return;

  const matchingFaction: Faction = receivedCard.color === "蓝" ? "军情" : "潜伏";
  const beliefs = factionBeliefsForPolicy(memory, projection, policy);
  const hasStrongReferencePlayer = projection.players.some((player) =>
    player.id !== sourceId &&
    player.id !== targetId &&
    (
      player.faction === matchingFaction ||
      (
        player.id === memory.botId
          ? averagePerceivedFactionProbability(memory, matchingFaction) >= 0.85
          : (beliefs[player.id]?.[matchingFaction] ?? 0) >= 0.85
      )
    )
  );
  if (!hasStrongReferencePlayer) return;

  const senderRemainingHand = memory.previous?.players[sourceId]?.handCount ?? 0;
  if (senderRemainingHand === 0) return;
  const strength = senderRemainingHand === 1 ? 0.25 : 0.55;
  const sourceEvidence = memory.evidence[sourceId] ??= emptyBelief();
  sourceEvidence[matchingFaction] -= strength;
  for (const faction of FACTIONS) {
    if (faction !== matchingFaction) sourceEvidence[faction] += strength * 0.35;
  }
  const sourceRelationships = memory.perceivedAllianceByPlayer[sourceId] ??= {};
  sourceRelationships[targetId] = Math.max(
    -1,
    Math.min(1, (sourceRelationships[targetId] ?? 0) + strength),
  );
}

function averagePerceivedFactionProbability(
  memory: BotMemory,
  faction: Faction,
): number {
  const perceptions = Object.values(memory.perceivedIdentityByPlayer);
  if (perceptions.length === 0) return 0;
  return perceptions.reduce((sum, belief) => sum + belief[faction], 0) / perceptions.length;
}

function observeTransmissionInference(
  memory: BotMemory,
  projection: PlayerProjection,
  current: PublicObservation["transmission"],
  policy: BotPolicy,
  knownTransmissionCard?: PhysicalCard,
): void {
  if (!current) {
    memory.transmissionInference = undefined;
    return;
  }
  const isNewTransmission = memory.transmissionInference?.signature !== current.signature;
  if (isNewTransmission) {
    const priorSecretOrder = memory.previous?.secretOrder;
    const recentAudit = projection.auditLog.slice(memory.previous?.auditLength ?? 0);
    const secretOrderInvalidated = recentAudit.some(
      (entry) =>
        entry.includes("秘密下达被识破") ||
        entry.includes("服务器自动验证并解除颜色限制"),
    );
    const forcedColor =
      priorSecretOrder?.targetId === current.senderId && !secretOrderInvalidated
        ? priorSecretOrder.requiredColor
        : undefined;
    const relationshipBlackProbability =
      policy.secondOrderIdentityModel &&
      forcedColor === undefined &&
      current.card === undefined &&
      current.targetId === projection.own.id
        ? current.method === "直达"
          ? hiddenDirectBlackProbability(memory, projection, current.senderId, policy)
          : current.method === "密电"
            ? reverseMailAffinityBlackProbability(memory, projection, current, policy) ??
              supportiveProbeMailBlackProbability(memory, projection, current.senderId)
            : undefined
        : undefined;
    memory.transmissionInference = {
      signature: current.signature,
      initialTargetId: current.targetId,
      completedDecryptors: [],
      knownCard: knownTransmissionCard,
      blackProbability: relationshipBlackProbability,
      forcedColor,
      forcedByPlayerId:
        priorSecretOrder?.targetId === current.senderId && !secretOrderInvalidated
          ? priorSecretOrder.sourceId
          : undefined,
      replaced: false,
    };
    observeSupportiveReverseMailInference(memory, projection, current, policy);
  }
  const inference = memory.transmissionInference!;
  const scanFrom = isNewTransmission
    ? current.startAuditIndex
    : memory.previous?.auditLength ?? projection.auditLog.length;
  for (const entry of projection.auditLog.slice(scanFrom)) {
    const lock = /^(.+)对(.+)使用锁定，等待响应$/.exec(entry);
    if (lock?.[2]) {
      inference.lock = {
        originalTargetId: lock[2],
        redirected: false,
      };
      continue;
    }
    if (/^离间结算：锁定目标改为.+$/.test(entry) && inference.lock) {
      inference.lock.redirected = true;
      continue;
    }
    if (entry.startsWith("掉包结算：")) {
      inference.knownCard = undefined;
      inference.forcedColor = undefined;
      inference.forcedByPlayerId = undefined;
      inference.blackProbability = undefined;
      inference.replaced = true;
      continue;
    }
    const completedDecrypt = /^(.+)完成破译$/.exec(entry)?.[1];
    if (completedDecrypt && !inference.completedDecryptors.includes(completedDecrypt)) {
      inference.completedDecryptors.push(completedDecrypt);
      continue;
    }
    const rejectingPlayer = /^(.+)拒绝情报，当前接收者：/.exec(entry)?.[1];
    if (rejectingPlayer && inference.completedDecryptors.includes(rejectingPlayer)) {
      inference.blackProbability = Math.max(
        inference.blackProbability ?? 0,
        policy.decryptRejectionBlackProbability ?? DECRYPT_REJECTION_BLACK_PROBABILITY,
      );
    }
  }
}

function observeLethalLockInference(
  memory: BotMemory,
  projection: PlayerProjection,
  policy: BotPolicy,
): void {
  if (policy.lethalLockEvidence <= 0) return;
  const recentAudit = projection.auditLog.slice(memory.previous?.auditLength ?? 0);
  for (const entry of recentAudit) {
    if (/^.+开始以.+传递情报，当前接收者：.+$/.test(entry)) {
      memory.pendingLockInference = undefined;
      continue;
    }

    const lock = /^(.+)对(.+)使用锁定，等待响应$/.exec(entry);
    if (lock?.[1] && lock[2]) {
      memory.pendingLockInference = {
        sourceId: lock[1],
        targetId: lock[2],
        resolved: false,
        redirected: false,
        swapped: false,
      };
      continue;
    }

    const pending = memory.pendingLockInference;
    if (!pending) continue;
    const resolvedTarget = /^锁定结算：锁定目标为(.+)$/.exec(entry)?.[1];
    if (resolvedTarget) {
      pending.resolved = true;
      pending.targetId = resolvedTarget;
      continue;
    }
    const redirectedTarget = /^离间结算：锁定目标改为(.+)$/.exec(entry)?.[1];
    if (redirectedTarget) {
      pending.redirected = true;
      pending.targetId = redirectedTarget;
      continue;
    }
    if (entry.startsWith("掉包结算：")) {
      pending.swapped = true;
      continue;
    }

    const death = /^(.+)接收情报.*（黑 · .+）.*后死亡，阵营公开为(军情|潜伏|特工)$/.exec(entry);
    if (death?.[1] && death[2]) {
      if (
        pending.resolved &&
        !pending.redirected &&
        !pending.swapped &&
        pending.targetId === death[1]
      ) {
        const victimFaction = death[2] as Faction;
        const sourceEvidence = memory.evidence[pending.sourceId] ??= emptyBelief();
        sourceEvidence[victimFaction] -= policy.lethalLockEvidence;
        for (const faction of FACTIONS) {
          if (faction !== victimFaction) {
            sourceEvidence[faction] += policy.lethalLockEvidence * 0.32;
          }
        }
      }
      memory.pendingLockInference = undefined;
    }
  }
  if (!projection.transmission) memory.pendingLockInference = undefined;
}

function observeDefinitivePublicTextInference(
  memory: BotMemory,
  projection: PlayerProjection,
): void {
  const pending = new Map<string, { color: SingleColor; optionalChoice: boolean }>();
  for (const entry of projection.auditLog) {
    const receipt = /^(.+)接收情报：「公开文本（(红|蓝|黑) ·/.exec(entry);
    if (receipt?.[1] && receipt[2]) {
      pending.set(receipt[1], {
        color: receipt[2] as SingleColor,
        optionalChoice: false,
      });
      continue;
    }

    const optionalChoice = /^(.+)须选择公开文本的摸牌或弃牌效果$/.exec(entry)?.[1];
    if (optionalChoice) {
      const current = pending.get(optionalChoice);
      if (current) current.optionalChoice = true;
      continue;
    }

    const forcedDiscard = [
      /^(.+)须为公开文本选择一张手牌弃置$/,
      /^(.+)因公开文本须弃牌，但其没有手牌$/,
      /^(.+)因公开文本自动弃置唯一的手牌(?:：.*)?$/,
      /^(.+)因公开文本弃置一张手牌(?:：.*)?$/,
    ].map((pattern) => pattern.exec(entry)?.[1]).find(Boolean);
    if (forcedDiscard) {
      const current = pending.get(forcedDiscard);
      if (current && !current.optionalChoice) {
        if (current.color === "红") setCertainFaction(memory, forcedDiscard, "潜伏");
        if (current.color === "蓝") setCertainFaction(memory, forcedDiscard, "军情");
      }
    }
  }
}

function functionObservation(
  projection: PlayerProjection,
  previous?: PublicObservation,
): PublicObservation["functionAction"] {
  const current = projection.activeFunctionAction;
  if (!current) return undefined;
  const prior = previous?.functionAction;
  const normalizedKind =
    current.kind === "probeIdentity" ||
    current.kind === "probeDrawDiscard" ||
    current.kind === "probe"
      ? "probe"
      : current.kind;
  const labels: Record<NonNullable<PublicObservation["functionAction"]>["kind"], string> = {
    reinforcement: "使用增援",
    confidentialFile: "使用机密文件",
    publicText: "使用公开文本",
    dangerousIntelligence: "使用危险情报",
    probe: "使用试探",
  };
  let startAuditIndex = -1;
  for (let index = projection.auditLog.length - 1; index >= 0; index -= 1) {
    const entry = projection.auditLog[index]!;
    if (
      entry.startsWith(current.sourcePlayerId) &&
      entry.includes(labels[normalizedKind])
    ) {
      startAuditIndex = index;
      break;
    }
  }
  const signature = [
    normalizedKind,
    current.sourcePlayerId,
    Math.max(0, startAuditIndex),
  ].join("|");
  const sameAction = prior?.signature === signature;
  const redirected = Boolean(
    (sameAction && (prior.redirected || prior.targetId !== current.targetPlayerId)) ||
    projection.auditLog
      .slice(Math.max(0, startAuditIndex))
      .some((entry) => entry.startsWith("离间结算：功能牌目标改为"))
  );
  return {
    signature,
    kind: normalizedKind,
    sourceId: current.sourcePlayerId,
    targetId: current.targetPlayerId,
    redirected,
  };
}

function observeResolvedActionAffinity(
  memory: BotMemory,
  projection: PlayerProjection,
  action: NonNullable<PublicObservation["functionAction"]>,
  evidenceScale: number,
): void {
  if (
    action.sourceId === memory.botId ||
    action.targetId !== memory.botId ||
    action.redirected ||
    projection.own.faction === "特工"
  ) {
    return;
  }
  if (
    action.kind !== "publicText" &&
    action.kind !== "dangerousIntelligence" &&
    action.kind !== "probe"
  ) {
    return;
  }
  const previousHand = memory.previous?.ownHand;
  if (!previousHand) return;
  const before = previousHand.reduce(
    (total, card) => total + cardUtility(card, projection.own.faction),
    0,
  );
  const after = projection.own.hand.reduce(
    (total, card) => total + cardUtility(card, projection.own.faction),
    0,
  );
  const change = after - before;
  if (Math.abs(change) < 0.0001) return;

  // A successful 试探 draw already has a stronger, exact outcome signal.
  if (action.kind === "probe" && change > 0) return;

  const sourceEvidence = memory.evidence[action.sourceId] ??= emptyBelief();
  if (change > 0) {
    sourceEvidence[projection.own.faction] += 0.35 * evidenceScale;
    return;
  }
  sourceEvidence[projection.own.faction] -= 0.35 * evidenceScale;
  for (const faction of FACTIONS) {
    if (faction !== projection.own.faction) {
      sourceEvidence[faction] += 0.15 * evidenceScale;
    }
  }
}

function observeDangerousDiscardChoiceInference(
  memory: BotMemory,
  projection: PlayerProjection,
  action: NonNullable<PublicObservation["functionAction"]>,
  maximumEvidence: number,
): void {
  if (
    action.sourceId === memory.botId ||
    action.targetId !== memory.botId ||
    action.redirected ||
    projection.own.faction === "特工"
  ) {
    return;
  }
  const previousHand = memory.previous?.ownHand;
  if (!previousHand || previousHand.length < 2) return;
  const currentIds = new Set(projection.own.hand.map((card) => card.id));
  const removed = previousHand.filter((card) => !currentIds.has(card.id));
  if (removed.length !== 1) return;

  const utilities = previousHand.map((card) => cardUtility(card, projection.own.faction));
  const minimum = Math.min(...utilities);
  const maximum = Math.max(...utilities);
  if (maximum - minimum < 0.0001) return;
  const removedUtility = cardUtility(removed[0], projection.own.faction);
  const relativeChoice = (removedUtility - minimum) / (maximum - minimum);
  const hostileSignal = (relativeChoice - 0.5) * 2;
  if (Math.abs(hostileSignal) < 0.0001) return;

  const evidenceStrength = Math.abs(hostileSignal) * maximumEvidence;
  const sourceEvidence = memory.evidence[action.sourceId] ??= emptyBelief();
  if (hostileSignal > 0) {
    sourceEvidence[projection.own.faction] -= evidenceStrength;
    for (const faction of FACTIONS) {
      if (faction !== projection.own.faction) sourceEvidence[faction] += evidenceStrength * 0.4;
    }
  } else {
    sourceEvidence[projection.own.faction] += evidenceStrength;
  }
}

function secretOrderObservation(projection: PlayerProjection): PublicObservation["secretOrder"] {
  const current = projection.pendingSecretOrder;
  if (!current?.sourcePlayerId || !current.requiredColor || current.verifiedNoMatch) return undefined;
  return {
    signature: [current.sourcePlayerId, current.targetPlayerId, current.word, current.requiredColor].join("|"),
    sourceId: current.sourcePlayerId,
    targetId: current.targetPlayerId,
    requiredColor: current.requiredColor,
  };
}

function cardHelpsFaction(card: PhysicalCard, faction: Faction): boolean {
  if (faction === "特工") return card.color !== "黑";
  const desired = faction === "军情" ? "蓝" : "红";
  return card.color === desired || card.color === "红蓝";
}

function observeTransmissionSenderEvidence(
  evidence: FactionBelief,
  targetFaction: Faction,
  card: PhysicalCard,
  method: Exclude<PhysicalCard["transmission"], "任意">,
  colorWasForced: boolean,
  directTransmissionEvidence: BotPolicy["directTransmissionEvidence"],
  directTransmissionEvidenceStrength: number,
): void {
  const helpful = cardHelpsFaction(card, targetFaction);
  const useIntentionalDirectEvidence = directTransmissionEvidence === "all" ||
    (directTransmissionEvidence === "black-only" && card.color === "黑");
  if (method !== "直达" || !useIntentionalDirectEvidence) {
    evidence[targetFaction] += helpful ? 0.65 : -0.35;
    if (!helpful) {
      for (const faction of FACTIONS) if (faction !== targetFaction) evidence[faction] += 0.15;
    }
    return;
  }

  if (helpful) {
    evidence[targetFaction] += (colorWasForced ? 0.55 : 0.9) *
      directTransmissionEvidenceStrength;
    return;
  }

  const penalty = card.color === "黑"
    ? colorWasForced ? 0.55 : 1
    : colorWasForced ? 0.3 : 0.5;
  const alternativeBoost = card.color === "黑"
    ? colorWasForced ? 0.2 : 0.4
    : colorWasForced ? 0.12 : 0.2;
  evidence[targetFaction] -= penalty * directTransmissionEvidenceStrength;
  for (const faction of FACTIONS) {
    if (faction !== targetFaction) {
      evidence[faction] += alternativeBoost * directTransmissionEvidenceStrength;
    }
  }
}

function emptyBelief(): FactionBelief {
  return { 军情: 0, 潜伏: 0, 特工: 0 };
}

function uniformBelief(): FactionBelief {
  return { 军情: 1 / 3, 潜伏: 1 / 3, 特工: 1 / 3 };
}

function excludeFaction(evidence: FactionBelief, faction: Faction): void {
  evidence[faction] = Math.min(evidence[faction], -DEFINITIVE_FACTION_EVIDENCE);
}

function setCertainFaction(memory: BotMemory, playerId: string, faction: Faction): void {
  const evidence = memory.evidence[playerId] ??= emptyBelief();
  for (const candidate of FACTIONS) {
    evidence[candidate] = candidate === faction
      ? DEFINITIVE_FACTION_EVIDENCE
      : -DEFINITIVE_FACTION_EVIDENCE;
  }
}

function oneHot(faction: Faction): FactionBelief {
  return { 军情: faction === "军情" ? 1 : 0, 潜伏: faction === "潜伏" ? 1 : 0, 特工: faction === "特工" ? 1 : 0 };
}
