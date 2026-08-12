import { PHYSICAL_DECK, type Faction } from "../game/cards";
import { projectGameForPlayer, type GameState } from "../game/engine";
import {
  chooseBotDecision,
  receiptUtility,
  TACTICAL_V24,
  type FactionBelief,
} from "../server/bot/strategy";
import { runSelfPlayGame, type SelfPlayDecisionObservation } from "./benchmark";
import { CANDIDATE_V70 } from "./policies";

const games = parsePositiveInteger(process.argv[2] ?? "300", "game count");
const startSeed = parsePositiveInteger(process.argv[3] ?? "30001", "start seed");
const samples: IntentSample[] = [];
const receiptDecisions: ReceiptDecisionSample[] = [];
const lockResponses: LockResponseSample[] = [];

for (let index = 0; index < games; index += 1) {
  runSelfPlayGame({
    playerCount: 5,
    seed: startSeed + index,
    decisionObserver: (observation) => {
      collectIntentSample(observation, samples);
      collectRedirectedReceiptDecision(observation, receiptDecisions);
      collectLockResponse(observation, lockResponses);
    },
  });
}
console.log(`hidden self-lock counter opportunities: count=${lockResponses.length}`);
console.log(
  `harmful=${percent(lockResponses.filter((sample) => sample.utility < 0).length, lockResponses.length)} ` +
  `countered=${percent(lockResponses.filter((sample) => sample.command === "PLAY_COUNTER").length, lockResponses.length)} ` +
  `passed=${percent(lockResponses.filter((sample) => sample.command === "PASS_REACTION").length, lockResponses.length)}`,
);
console.log(`redirected hidden receipt decisions: count=${receiptDecisions.length}`);
console.log(
  `policy disagreements=${receiptDecisions.filter((sample) => sample.live !== sample.candidate).length} ` +
  `liveCorrect=${receiptDecisions.filter((sample) => sample.live === sample.preferred).length} ` +
  `candidateCorrect=${receiptDecisions.filter((sample) => sample.candidate === sample.preferred).length}`,
);
for (const sample of receiptDecisions.filter((entry) => entry.live !== entry.candidate).slice(0, 20)) {
  console.log(JSON.stringify(sample));
}

console.log(`Lock intent calibration: ${games} games, seeds ${startSeed}-${startSeed + games - 1}`);
for (const action of ["锁定", "离间"] as const) {
  const group = samples.filter((sample) => sample.action === action);
  const utilities = group.map((sample) => sample.targetReceiptUtility);
  console.log(
    `${action} hidden receipt: count=${group.length} ` +
    `beneficial=${percent(group.filter((sample) => sample.targetReceiptUtility > 0).length, group.length)} ` +
    `harmful=${percent(group.filter((sample) => sample.targetReceiptUtility < 0).length, group.length)} ` +
    `mean=${mean(utilities).toFixed(3)} median=${median(utilities).toFixed(3)}`,
  );
  if (action === "离间") {
    for (const relationship of ["ally", "opponent"] as const) {
      const related = group.filter((sample) => sample.relationship === relationship);
      console.log(
        `  separator ${relationship}: count=${related.length} ` +
        `beneficial=${percent(related.filter((sample) => sample.targetReceiptUtility > 0).length, related.length)} ` +
        `harmful=${percent(related.filter((sample) => sample.targetReceiptUtility < 0).length, related.length)} ` +
        `mean=${mean(related.map((sample) => sample.targetReceiptUtility)).toFixed(3)}`,
      );
    }
  }
}

interface IntentSample {
  action: "锁定" | "离间";
  targetReceiptUtility: number;
  relationship?: "ally" | "opponent";
}

interface ReceiptDecisionSample {
  actualColor: string;
  utility: number;
  live: "ACCEPT_INTELLIGENCE" | "DECLINE_INTELLIGENCE";
  candidate: "ACCEPT_INTELLIGENCE" | "DECLINE_INTELLIGENCE";
  preferred: "ACCEPT_INTELLIGENCE" | "DECLINE_INTELLIGENCE";
}

interface LockResponseSample {
  command: string;
  utility: number;
}

function collectLockResponse(
  { actorId, command, projection, state }: SelfPlayDecisionObservation,
  output: LockResponseSample[],
): void {
  const pending = projection.responseStack.at(-1);
  if (
    pending?.kind !== "card" ||
    pending.cardName !== "锁定" ||
    pending.targetPlayerId !== actorId ||
    projection.transmission?.card ||
    !projection.legalActions.some((action) => action.type === "PLAY_COUNTER")
  ) return;
  const card = PHYSICAL_DECK.find((candidate) => candidate.id === state.transmission?.cardId);
  if (!card) return;
  const beliefs = Object.fromEntries(
    state.seatOrder.map((id) => [id, oneHot(state.players[id]!.faction)]),
  );
  output.push({
    command: command.type,
    utility: receiptUtility(card, actorId, projection, beliefs),
  });
}

function collectRedirectedReceiptDecision(
  observation: SelfPlayDecisionObservation,
  output: ReceiptDecisionSample[],
): void {
  const { actorId, command, projection, state, memory } = observation;
  if (
    (command.type !== "ACCEPT_INTELLIGENCE" && command.type !== "DECLINE_INTELLIGENCE") ||
    !projection.legalActions.some((action) => action.type === "ACCEPT_INTELLIGENCE") ||
    !projection.legalActions.some((action) => action.type === "DECLINE_INTELLIGENCE") ||
    projection.transmission?.card ||
    projection.transmission?.intendedRecipientId !== actorId ||
    projection.transmission.lockedRecipientId === actorId ||
    !hasResolvedRedirectedLock(projection.auditLog, actorId)
  ) return;

  const card = PHYSICAL_DECK.find((candidate) => candidate.id === state.transmission?.cardId);
  const target = state.players[actorId];
  if (!card || !target) return;
  const beliefs = Object.fromEntries(
    state.seatOrder.map((id) => [id, oneHot(state.players[id]!.faction)]),
  );
  const utility = receiptUtility(card, actorId, projection, beliefs);
  const live = chooseBotDecision(
    projection,
    structuredClone(memory),
    { policy: TACTICAL_V24, random: () => 0 },
  )?.command.type;
  const candidate = chooseBotDecision(
    projection,
    structuredClone(memory),
    { policy: CANDIDATE_V70, random: () => 0 },
  )?.command.type;
  if (
    (live !== "ACCEPT_INTELLIGENCE" && live !== "DECLINE_INTELLIGENCE") ||
    (candidate !== "ACCEPT_INTELLIGENCE" && candidate !== "DECLINE_INTELLIGENCE")
  ) return;
  output.push({
    actualColor: card.color,
    utility,
    live,
    candidate,
    preferred: utility > 0 ? "ACCEPT_INTELLIGENCE" : "DECLINE_INTELLIGENCE",
  });
}

function hasResolvedRedirectedLock(auditLog: readonly string[], actorId: string): boolean {
  let start = -1;
  for (let index = auditLog.length - 1; index >= 0; index -= 1) {
    if (auditLog[index]?.includes("开始以") && auditLog[index]?.includes("传递情报")) {
      start = index;
      break;
    }
  }
  if (start < 0) return false;
  const recent = auditLog.slice(start + 1);
  return recent.some((entry) => new RegExp(`^.+对${escapeRegExp(actorId)}使用锁定，等待响应$`).test(entry)) &&
    recent.some((entry) => /^离间结算：锁定目标改为.+$/.test(entry));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectIntentSample(
  { actorId, command, state }: SelfPlayDecisionObservation,
  output: IntentSample[],
): void {
  if (command.type === "PLAY_LOCK") {
    const targetId = state.transmission?.intendedRecipientId;
    if (targetId) addSample("锁定", actorId, targetId, state, output);
    return;
  }
  if (command.type === "PLAY_SEPARATION" && state.transmission?.pendingLock) {
    addSample(
      "离间",
      actorId,
      state.transmission.intendedRecipientId,
      state,
      output,
    );
  }
}

function addSample(
  action: IntentSample["action"],
  actorId: string,
  targetId: string,
  state: GameState,
  output: IntentSample[],
): void {
  const transmission = state.transmission;
  if (
    !transmission ||
    transmission.faceUp ||
    transmission.senderId === targetId ||
    transmission.decryptedById === targetId
  ) return;
  const card = PHYSICAL_DECK.find((candidate) => candidate.id === state.transmission?.cardId);
  const target = state.players[targetId];
  const actor = state.players[actorId];
  if (!card || !target || !actor) return;
  const beliefs = Object.fromEntries(
    state.seatOrder.map((id) => [id, oneHot(state.players[id]!.faction)]),
  );
  output.push({
    action,
    relationship: actor.faction !== "特工" && actor.faction === target.faction
      ? "ally"
      : "opponent",
    targetReceiptUtility: receiptUtility(
      card,
      targetId,
      projectGameForPlayer(state, targetId),
      beliefs,
    ),
  });
}

function oneHot(faction: Faction): FactionBelief {
  return {
    军情: faction === "军情" ? 1 : 0,
    潜伏: faction === "潜伏" ? 1 : 0,
    特工: faction === "特工" ? 1 : 0,
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]!
    : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function percent(numerator: number, denominator: number): string {
  return `${(100 * numerator / Math.max(1, denominator)).toFixed(1)}%`;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}
