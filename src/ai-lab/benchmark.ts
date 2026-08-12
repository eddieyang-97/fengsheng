import {
  currentReactionWindow,
  factionsForPlayerCount,
  projectGameForPlayer,
  type GameState,
  type PlayerProjection,
  type WinnerState,
} from "../game/engine";
import { PHYSICAL_DECK } from "../game/cards";
import { chooseBotCommand, chooseBotDecision, createBotMemory, createSeededBotRandom, evaluatePublicPosition, factionBeliefsForPolicy, handCardUtility, LIVE_BOT_POLICY, type BotDecision, type BotMemory, type BotPolicy, type FactionBelief } from "../server/bot/strategy";
import { dispatchGameCommand, GameSessionService, type GameCommand } from "../server/game-session";
import { CANDIDATE_V29 } from "./policies";

export interface SelfPlayGameOptions {
  playerCount: 2 | 5 | 6 | 7 | 8;
  seed: number;
  maxCommands?: number;
  policies?: readonly BotPolicy[];
  comparePolicies?: readonly [BotPolicy, BotPolicy];
  /** Offline-only observer invoked immediately before each accepted command. */
  decisionObserver?: (observation: SelfPlayDecisionObservation) => void;
}

export interface SelfPlayDecisionObservation {
  actorId: string;
  command: GameCommand;
  projection: PlayerProjection;
  state: GameState;
  memory: BotMemory;
}

export interface BotDisagreement {
  seed: number;
  commandNumber: number;
  actorId: string;
  faction: string;
  phase: string;
  reactionKind?: string;
  ownHand: Array<{ name: string; color: string; transmission: string }>;
  actualFactions: Record<string, string>;
  transmission?: {
    method: string;
    recipientId: string;
    faceUp: boolean;
    recipientMustAccept?: boolean;
    cardName?: string;
    cardColor?: string;
  };
  intelligenceCounts: Record<string, { red: number; blue: number; black: number; physical: number }>;
  legalActionTypes: string[];
  policies: readonly [string, string];
  decisions: readonly [BotDecision | undefined, BotDecision | undefined];
  decisionCards: readonly [
    { name: string; color: string; transmission: string } | undefined,
    { name: string; color: string; transmission: string } | undefined,
  ];
  beliefs: readonly [Record<string, FactionBelief>, Record<string, FactionBelief>];
  counterfactual?: {
    metric: "full-information-discard-denial" | "full-information-receipt-branch" | "full-information-transfer-branch" | "full-information-lure-branch" | "full-information-separation-branch" | "full-information-secret-order-branch" | "full-information-probe-counter-branch" | "full-information-intercept-branch";
    targetFaction?: string;
    recipientIds?: readonly [string, string];
    cardName?: string;
    cardColor?: string;
    secretOrderWords?: readonly [string | undefined, string | undefined];
    secretOrderColors?: readonly [string | undefined, string | undefined];
    utilities: readonly [number, number];
    preferredPolicy: string | "tie";
  };
  publicEvent?: string;
}

export interface SelfPlayGameResult {
  seed: number;
  playerCount: number;
  winner?: WinnerState;
  commands: number;
  turns: number;
  deaths: number;
  rejectedCommands: number;
  status: "completed" | "stalled" | "commandLimit";
  finalPhase: string;
  waitingFor?: string;
  lastPublicEvent?: string;
  lastRejection?: string;
  decryptRejections: {
    total: number;
    black: number;
  };
  participants: Array<{
    id: string;
    seat: number;
    faction: string;
    policy: string;
    won: boolean;
    beliefCalibration: {
      observations: number;
      brierSum: number;
      correctTopChoice: number;
    };
  }>;
  disagreements: BotDisagreement[];
}

export interface SelfPlayBenchmarkOptions {
  playerCount: SelfPlayGameOptions["playerCount"];
  games: number;
  startSeed?: number;
  maxCommandsPerGame?: number;
}

export interface SelfPlayBenchmarkResult {
  playerCount: number;
  games: number;
  completed: number;
  stalled: number;
  commandLimited: number;
  averageCommands: number;
  averageTurns: number;
  rejectedCommands: number;
  winners: Record<string, number>;
  results: SelfPlayGameResult[];
}

export interface PairedTournamentOptions {
  playerCount: SelfPlayGameOptions["playerCount"];
  pairs: number;
  startSeed?: number;
  maxCommandsPerGame?: number;
  candidatePolicy?: BotPolicy;
  baselinePolicy?: BotPolicy;
  mode?: TournamentMode;
}

export type TournamentMode = "focal-seat" | "mixed-seats" | "population";

export interface PairedTournamentResult {
  playerCount: number;
  mode: TournamentMode;
  pairs: number;
  games: number;
  completed: number;
  stalled: number;
  commandLimited: number;
  rejectedCommands: number;
  candidate: PolicyPerformanceSummary;
  baseline: PolicyPerformanceSummary;
  pairedWinRateDifference: number;
  confidence95: { low: number; high: number };
  verdict: "candidate" | "baseline" | "inconclusive";
  pairDifferenceMoments: { count: number; sum: number; sumSquares: number };
  results: SelfPlayGameResult[];
}

export interface WinRateSummary {
  wins: number;
  entries: number;
  winRate: number;
}

export interface PolicyPerformanceSummary extends WinRateSummary {
  byFaction: Record<string, WinRateSummary>;
  bySeat: Record<string, WinRateSummary>;
  beliefCalibration: BeliefCalibrationSummary;
}

export interface BeliefCalibrationSummary {
  observations: number;
  brierSum: number;
  brierScore: number;
  correctTopChoice: number;
  topChoiceAccuracy: number;
}

/** Runs one game using only player projections, the same information available to live bots. */
export function runSelfPlayGame(options: SelfPlayGameOptions): SelfPlayGameResult {
  const ids = Array.from({ length: options.playerCount }, (_, index) => `bot-${index + 1}`);
  if (options.policies && options.policies.length !== ids.length) {
    throw new Error("policies must contain exactly one policy per player");
  }
  const policies = options.policies ?? ids.map(() => LIVE_BOT_POLICY);
  const roomCode = `BENCH-${options.seed}`;
  const games = new GameSessionService();
  games.create(roomCode, ids, options.seed);
  const memories = new Map<string, BotMemory>();
  const comparisonMemories = new Map<string, [BotMemory, BotMemory]>();
  const randoms = new Map(ids.map((id, index) => [id, createSeededBotRandom(options.seed * 131 + index + 1)]));
  const rejectedByState = new Map<string, GameCommand[]>();
  const maxCommands = options.maxCommands ?? 10_000;
  let commands = 0;
  let rejectedCommands = 0;
  let decryptRejectionTotal = 0;
  let decryptRejectionBlack = 0;
  let lastRejection: string | undefined;
  const disagreements: BotDisagreement[] = [];

  while (!games.getState(roomCode).winner && commands < maxCommands) {
    let advanced = false;
    let attempted = false;
    for (const [index, id] of ids.entries()) {
      const projection = games.project(roomCode, id);
      const memory = memories.get(id) ?? createBotMemory(projection, policies[index]);
      memories.set(id, memory);
      const stateKey = decisionStateKey(id, projection);
      const rejected = rejectedByState.get(stateKey) ?? [];
      if (options.comparePolicies) {
        const policyMemories = comparisonMemories.get(id) ?? [
          createBotMemory(projection, options.comparePolicies[0]),
          createBotMemory(projection, options.comparePolicies[1]),
        ];
        comparisonMemories.set(id, policyMemories);
        const decisions = options.comparePolicies.map((policy, policyIndex) =>
          chooseBotDecision(
            projection,
            policyMemories[policyIndex]!,
            {
              policy,
              random: () => 0,
              excludedCommands: rejected,
              excludedTransmissionCardIds: rejected
                .filter((item): item is Extract<GameCommand, { type: "START_TRANSMISSION" }> => item.type === "START_TRANSMISSION")
                .map((item) => item.cardId),
            },
          )
        ) as [BotDecision | undefined, BotDecision | undefined];
        if (JSON.stringify(decisions[0]?.command) !== JSON.stringify(decisions[1]?.command)) {
          disagreements.push(describeDisagreement(
            options.seed,
            commands,
            projection,
            games.getState(roomCode),
            options.comparePolicies,
            decisions,
            policyMemories,
            policies,
            memories,
          ));
        }
      }
      const command = chooseBotCommand(projection, memory, {
        policy: policies[index],
        random: randoms.get(id),
        excludedCommands: rejected,
        excludedTransmissionCardIds: rejected
          .filter((item): item is Extract<GameCommand, { type: "START_TRANSMISSION" }> => item.type === "START_TRANSMISSION")
          .map((item) => item.cardId),
      });
      if (!command) continue;
      attempted = true;
      const stateBeforeCommand = games.getState(roomCode);
      const isDecryptRejection =
        command.type === "DECLINE_INTELLIGENCE" &&
        stateBeforeCommand.transmission?.decryptedById === id;
      const rejectedCard = isDecryptRejection
        ? PHYSICAL_DECK.find(
            (card) => card.id === stateBeforeCommand.transmission?.cardId,
          )
        : undefined;
      try {
        games.dispatch(roomCode, id, command);
        options.decisionObserver?.({
          actorId: id,
          command,
          projection,
          state: stateBeforeCommand,
          memory: structuredClone(memory),
        });
        if (isDecryptRejection) {
          decryptRejectionTotal += 1;
          if (rejectedCard?.color === "黑") decryptRejectionBlack += 1;
        }
        commands += 1;
        advanced = true;
        break;
      } catch (error) {
        rejected.push(command);
        rejectedByState.set(stateKey, rejected);
        rejectedCommands += 1;
        lastRejection = JSON.stringify({
          command,
          error: error instanceof Error ? error.message : String(error),
          projection: {
            phase: projection.phase,
            activePlayerId: projection.activePlayerId,
            actorId: projection.own.id,
            activeFunctionAction: projection.activeFunctionAction,
            reactionWindow: projection.reactionWindow,
            receiptStage: projection.transmission?.receiptStage,
            legalActionTypes: projection.legalActions.map((action) => action.type),
          },
        });
      }
    }
    if (!advanced && !attempted) {
      return summarizeGame(games, roomCode, options, policies, memories, commands, rejectedCommands, "stalled", disagreements, { total: decryptRejectionTotal, black: decryptRejectionBlack }, lastRejection);
    }
  }

  return summarizeGame(
    games,
    roomCode,
    options,
    policies,
    memories,
    commands,
    rejectedCommands,
    games.getState(roomCode).winner ? "completed" : "commandLimit",
    disagreements,
    { total: decryptRejectionTotal, black: decryptRejectionBlack },
    lastRejection,
  );
}

export function runPairedTournament(options: PairedTournamentOptions): PairedTournamentResult {
  if (!Number.isInteger(options.pairs) || options.pairs < 1) throw new Error("pairs must be a positive integer");
  factionsForPlayerCount(options.playerCount);
  const candidatePolicy = options.candidatePolicy ?? CANDIDATE_V29;
  const baselinePolicy = options.baselinePolicy ?? LIVE_BOT_POLICY;
  const mode = options.mode ?? "mixed-seats";
  const startSeed = options.startSeed ?? 1;
  const results: SelfPlayGameResult[] = [];
  const pairDifferences: number[] = [];
  const candidateEntries: SelfPlayGameResult["participants"] = [];
  const baselineEntries: SelfPlayGameResult["participants"] = [];

  for (let index = 0; index < options.pairs; index += 1) {
    const seed = startSeed + index;
    const focalSeatIndex = seed % options.playerCount;
    const firstLeg = policiesForFirstLeg(
      mode,
      options.playerCount,
      focalSeatIndex,
      candidatePolicy,
      baselinePolicy,
    );
    const secondLeg = policiesForSecondLeg(
      mode,
      firstLeg,
      candidatePolicy,
      baselinePolicy,
    );
    const pair = [firstLeg, secondLeg].map((policies) => runSelfPlayGame({
      playerCount: options.playerCount,
      seed,
      policies,
      maxCommands: options.maxCommandsPerGame,
    }));
    results.push(...pair);
    const participants = mode === "focal-seat"
      ? focalParticipants(pair, candidatePolicy.id)
      : pair.flatMap((result) => result.participants);
    candidateEntries.push(...participants.filter((entry) => entry.policy === candidatePolicy.id));
    baselineEntries.push(...participants.filter((entry) => entry.policy === baselinePolicy.id));
    pairDifferences.push(
      winRateFor(participants, candidatePolicy.id) - winRateFor(participants, baselinePolicy.id),
    );
  }

  const candidate = policySummary(candidateEntries, candidatePolicy.id);
  const baseline = policySummary(baselineEntries, baselinePolicy.id);
  const difference = average(pairDifferences);
  const standardError = pairDifferences.length > 1
    ? Math.sqrt(pairDifferences.reduce((sum, value) => sum + (value - difference) ** 2, 0) / (pairDifferences.length - 1)) / Math.sqrt(pairDifferences.length)
    : 0;
  const confidence95 = {
    low: Math.max(-1, difference - 1.96 * standardError),
    high: Math.min(1, difference + 1.96 * standardError),
  };
  return {
    playerCount: options.playerCount,
    mode,
    pairs: options.pairs,
    games: results.length,
    completed: results.filter((result) => result.status === "completed").length,
    stalled: results.filter((result) => result.status === "stalled").length,
    commandLimited: results.filter((result) => result.status === "commandLimit").length,
    rejectedCommands: results.reduce((sum, result) => sum + result.rejectedCommands, 0),
    candidate,
    baseline,
    pairedWinRateDifference: difference,
    confidence95,
    verdict: confidence95.low > 0 ? "candidate" : confidence95.high < 0 ? "baseline" : "inconclusive",
    pairDifferenceMoments: {
      count: pairDifferences.length,
      sum: pairDifferences.reduce((sum, value) => sum + value, 0),
      sumSquares: pairDifferences.reduce((sum, value) => sum + value ** 2, 0),
    },
    results,
  };
}

function focalParticipants(
  pair: readonly [SelfPlayGameResult, SelfPlayGameResult] | readonly SelfPlayGameResult[],
  candidatePolicyId: string,
): SelfPlayGameResult["participants"] {
  const candidate = pair[0]?.participants.find(
    (participant) => participant.policy === candidatePolicyId,
  );
  if (!candidate) throw new Error("focal candidate participant is missing");
  const baseline = pair[1]?.participants.find(
    (participant) => participant.id === candidate.id,
  );
  if (!baseline) throw new Error("matching focal baseline participant is missing");
  return [candidate, baseline];
}

function policiesForFirstLeg(
  mode: TournamentMode,
  playerCount: number,
  focalSeatIndex: number,
  candidatePolicy: BotPolicy,
  baselinePolicy: BotPolicy,
): BotPolicy[] {
  if (mode === "population") {
    return Array.from({ length: playerCount }, () => candidatePolicy);
  }
  if (mode === "focal-seat") {
    return Array.from(
      { length: playerCount },
      (_, index) => index === focalSeatIndex ? candidatePolicy : baselinePolicy,
    );
  }
  return Array.from(
    { length: playerCount },
    (_, index) => index % 2 === 0 ? candidatePolicy : baselinePolicy,
  );
}

function policiesForSecondLeg(
  mode: TournamentMode,
  firstLeg: readonly BotPolicy[],
  candidatePolicy: BotPolicy,
  baselinePolicy: BotPolicy,
): BotPolicy[] {
  if (mode === "population" || mode === "focal-seat") {
    return Array.from({ length: firstLeg.length }, () => baselinePolicy);
  }
  return firstLeg.map((policy): BotPolicy =>
    policy.id === candidatePolicy.id ? baselinePolicy : candidatePolicy
  );
}

export function runSelfPlayBenchmark(options: SelfPlayBenchmarkOptions): SelfPlayBenchmarkResult {
  if (!Number.isInteger(options.games) || options.games < 1) throw new Error("games must be a positive integer");
  factionsForPlayerCount(options.playerCount);
  const startSeed = options.startSeed ?? 1;
  const results = Array.from({ length: options.games }, (_, index) => runSelfPlayGame({
    playerCount: options.playerCount,
    seed: startSeed + index,
    maxCommands: options.maxCommandsPerGame,
  }));
  const winners: Record<string, number> = {};
  for (const result of results) {
    if (!result.winner) continue;
    const key = result.winner.kind === "faction" ? result.winner.faction : "特工（个人）";
    winners[key] = (winners[key] ?? 0) + 1;
  }
  return {
    playerCount: options.playerCount,
    games: options.games,
    completed: results.filter((result) => result.status === "completed").length,
    stalled: results.filter((result) => result.status === "stalled").length,
    commandLimited: results.filter((result) => result.status === "commandLimit").length,
    averageCommands: average(results.map((result) => result.commands)),
    averageTurns: average(results.map((result) => result.turns)),
    rejectedCommands: results.reduce((total, result) => total + result.rejectedCommands, 0),
    winners,
    results,
  };
}

function summarizeGame(
  games: GameSessionService,
  roomCode: string,
  options: SelfPlayGameOptions,
  policies: readonly BotPolicy[],
  memories: ReadonlyMap<string, BotMemory>,
  commands: number,
  rejectedCommands: number,
  status: SelfPlayGameResult["status"],
  disagreements: BotDisagreement[],
  decryptRejections: SelfPlayGameResult["decryptRejections"],
  lastRejection?: string,
): SelfPlayGameResult {
  const state = games.getState(roomCode);
  const reactionWindow = currentReactionWindow(state);
  const policyByPlayerId = new Map<string, BotPolicy>(
    policies.map((policy, index) => [`bot-${index + 1}`, policy] as const),
  );
  return {
    seed: options.seed,
    playerCount: options.playerCount,
    winner: state.winner,
    commands,
    turns: state.auditLog.filter((entry) => entry.includes("回合开始")).length,
    deaths: Object.values(state.players).filter((player) => !player.alive).length,
    rejectedCommands,
    status,
    finalPhase: state.phase,
    waitingFor: reactionWindow?.responderOrder[reactionWindow.nextResponderIndex]
      ?? state.pendingSecretOrder?.targetPlayerId
      ?? state.activePlayerId,
    lastPublicEvent: state.auditLog.at(-1),
    lastRejection,
    decryptRejections,
    participants: state.seatOrder.map((id, index) => {
      const policy = policyByPlayerId.get(id);
      if (!policy) throw new Error(`missing policy assignment for ${id}`);
      return {
        id,
        seat: index + 1,
        faction: state.players[id].faction,
        policy: policy.id,
        won: didPlayerWin(state.winner, id, state.players[id].faction),
        beliefCalibration: beliefCalibrationForObserver(
          games,
          roomCode,
          id,
          policy,
          memories.get(id),
        ),
      };
    }),
    disagreements,
  };
}

function describeDisagreement(
  seed: number,
  commandNumber: number,
  projection: ReturnType<GameSessionService["project"]>,
  state: GameState,
  policies: readonly [BotPolicy, BotPolicy],
  decisions: readonly [BotDecision | undefined, BotDecision | undefined],
  memories: readonly [BotMemory, BotMemory],
  livePolicies: readonly BotPolicy[],
  liveMemories: ReadonlyMap<string, BotMemory>,
): BotDisagreement {
  return {
    seed,
    commandNumber,
    actorId: projection.own.id,
    faction: projection.own.faction,
    phase: projection.phase,
    reactionKind: projection.reactionWindow?.kind,
    ownHand: projection.own.hand.map((card) => ({
      name: card.name,
      color: card.color,
      transmission: card.transmission,
    })),
    actualFactions: Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [id, player.faction]),
    ),
    transmission: projection.transmission
      ? {
          method: projection.transmission.method,
          recipientId: projection.transmission.intendedRecipientId,
          faceUp: projection.transmission.faceUp,
          recipientMustAccept: projection.transmission.recipientMustAccept,
          cardName: projection.transmission.card?.name,
          cardColor: projection.transmission.card?.color,
        }
      : undefined,
    intelligenceCounts: Object.fromEntries(projection.players.map((player) => {
      const counts = { red: 0, blue: 0, black: 0, physical: player.intelligence.length };
      for (const card of player.intelligence) {
        if (card.color === "红" || card.color === "红蓝") counts.red += 1;
        if (card.color === "蓝" || card.color === "红蓝") counts.blue += 1;
        if (card.color === "黑") counts.black += 1;
      }
      return [player.id, counts];
    })),
    legalActionTypes: [...new Set(projection.legalActions.map((action) => action.type))],
    policies: [policies[0].id, policies[1].id],
    decisions,
    decisionCards: [
      summarizeDecisionCard(decisions[0], projection),
      summarizeDecisionCard(decisions[1], projection),
    ],
    beliefs: policies.map((policy, index) =>
      factionBeliefsForPolicy(memories[index]!, projection, policy)
    ) as [
      Record<string, FactionBelief>,
      Record<string, FactionBelief>,
    ],
    counterfactual:
      discardCounterfactual(projection, state, policies, decisions) ??
      receiptCounterfactual(
        seed,
        commandNumber,
        projection,
        state,
        policies,
        decisions,
        livePolicies,
        liveMemories,
      ) ??
      transferCounterfactual(
        seed,
        commandNumber,
        projection,
        state,
        policies,
        decisions,
        memories,
        livePolicies,
        liveMemories,
      ) ??
      lureCounterfactual(
        seed,
        commandNumber,
        projection,
        state,
        policies,
        decisions,
        memories,
        livePolicies,
        liveMemories,
      ) ??
      separationCounterfactual(
        seed,
        commandNumber,
        projection,
        state,
        policies,
        decisions,
        memories,
        livePolicies,
        liveMemories,
      ) ??
      secretOrderCounterfactual(
        seed,
        commandNumber,
        projection,
        state,
        policies,
        decisions,
        memories,
        livePolicies,
        liveMemories,
      ) ??
      interceptCounterfactual(
        seed,
        commandNumber,
        projection,
        state,
        policies,
        decisions,
        memories,
        livePolicies,
        liveMemories,
      ) ??
      probeCounterfactual(
        seed,
        commandNumber,
        projection,
        state,
        policies,
        decisions,
        memories,
        livePolicies,
        liveMemories,
      ),
    publicEvent: projection.auditLog.at(-1),
  };
}

function separationCounterfactual(
  seed: number,
  commandNumber: number,
  projection: ReturnType<GameSessionService["project"]>,
  state: GameState,
  policies: readonly [BotPolicy, BotPolicy],
  decisions: readonly [BotDecision | undefined, BotDecision | undefined],
  comparisonMemories: readonly [BotMemory, BotMemory],
  livePolicies: readonly BotPolicy[],
  liveMemories: ReadonlyMap<string, BotMemory>,
): BotDisagreement["counterfactual"] {
  const commandTypes = decisions.map((decision) => decision?.command.type);
  if (
    !commandTypes.some((commandType) =>
      commandType === "PLAY_SEPARATION" || commandType === "PLAY_FUNCTION_SEPARATION"
    ) ||
    commandTypes.some((commandType) => !commandType)
  ) return undefined;
  const actorIndex = state.seatOrder.indexOf(projection.own.id);
  if (actorIndex < 0) return undefined;
  const utilities = decisions.map((decision, branchIndex) => {
    if (!decision) return Number.NEGATIVE_INFINITY;
    const branchPolicies = [...livePolicies];
    branchPolicies[actorIndex] = policies[branchIndex]!;
    const branchMemories = new Map([...liveMemories].map(([id, memory]) => [
      id,
      structuredClone(memory),
    ]));
    branchMemories.set(projection.own.id, structuredClone(comparisonMemories[branchIndex]!));
    return runFullGameBranch(
      state,
      projection.own.id,
      decision.command,
      branchPolicies,
      branchMemories,
      seed * 10_000 + commandNumber,
    );
  }) as [number, number];
  const preferredPolicy = Math.abs(utilities[0] - utilities[1]) < 0.0001
    ? "tie"
    : utilities[0] > utilities[1]
      ? policies[0].id
      : policies[1].id;
  return {
    metric: "full-information-separation-branch",
    utilities,
    preferredPolicy,
  };
}

function lureCounterfactual(
  seed: number,
  commandNumber: number,
  projection: ReturnType<GameSessionService["project"]>,
  state: GameState,
  policies: readonly [BotPolicy, BotPolicy],
  decisions: readonly [BotDecision | undefined, BotDecision | undefined],
  comparisonMemories: readonly [BotMemory, BotMemory],
  livePolicies: readonly BotPolicy[],
  liveMemories: ReadonlyMap<string, BotMemory>,
): BotDisagreement["counterfactual"] {
  const commandTypes = decisions.map((decision) => decision?.command.type);
  if (
    !projection.transmission ||
    !commandTypes.includes("PLAY_LURE") ||
    commandTypes.some((commandType) => !commandType)
  ) return undefined;
  const actorIndex = state.seatOrder.indexOf(projection.own.id);
  if (actorIndex < 0) return undefined;
  const utilities = decisions.map((decision, branchIndex) => {
    if (!decision) return Number.NEGATIVE_INFINITY;
    const branchPolicies = [...livePolicies];
    branchPolicies[actorIndex] = policies[branchIndex]!;
    const branchMemories = new Map([...liveMemories].map(([id, memory]) => [
      id,
      structuredClone(memory),
    ]));
    branchMemories.set(projection.own.id, structuredClone(comparisonMemories[branchIndex]!));
    return runFullGameBranch(
      state,
      projection.own.id,
      decision.command,
      branchPolicies,
      branchMemories,
      seed * 10_000 + commandNumber,
    );
  }) as [number, number];
  const preferredPolicy = Math.abs(utilities[0] - utilities[1]) < 0.0001
    ? "tie"
    : utilities[0] > utilities[1]
      ? policies[0].id
      : policies[1].id;
  return {
    metric: "full-information-lure-branch",
    utilities,
    preferredPolicy,
  };
}

function transferCounterfactual(
  seed: number,
  commandNumber: number,
  projection: ReturnType<GameSessionService["project"]>,
  state: GameState,
  policies: readonly [BotPolicy, BotPolicy],
  decisions: readonly [BotDecision | undefined, BotDecision | undefined],
  comparisonMemories: readonly [BotMemory, BotMemory],
  livePolicies: readonly BotPolicy[],
  liveMemories: ReadonlyMap<string, BotMemory>,
): BotDisagreement["counterfactual"] {
  const commandTypes = decisions.map((decision) => decision?.command.type);
  if (
    !projection.transmission ||
    !commandTypes.includes("PLAY_TRANSFER") ||
    commandTypes.some((commandType) => !commandType)
  ) return undefined;
  const actorIndex = state.seatOrder.indexOf(projection.own.id);
  if (actorIndex < 0) return undefined;
  const utilities = decisions.map((decision, branchIndex) => {
    if (!decision) return Number.NEGATIVE_INFINITY;
    const branchPolicies = [...livePolicies];
    branchPolicies[actorIndex] = policies[branchIndex]!;
    const branchMemories = new Map([...liveMemories].map(([id, memory]) => [
      id,
      structuredClone(memory),
    ]));
    branchMemories.set(projection.own.id, structuredClone(comparisonMemories[branchIndex]!));
    return runFullGameBranch(
      state,
      projection.own.id,
      decision.command,
      branchPolicies,
      branchMemories,
      seed * 10_000 + commandNumber,
    );
  }) as [number, number];
  const preferredPolicy = Math.abs(utilities[0] - utilities[1]) < 0.0001
    ? "tie"
    : utilities[0] > utilities[1]
      ? policies[0].id
      : policies[1].id;
  return {
    metric: "full-information-transfer-branch",
    utilities,
    preferredPolicy,
  };
}

function discardCounterfactual(
  projection: ReturnType<GameSessionService["project"]>,
  state: GameState,
  policies: readonly [BotPolicy, BotPolicy],
  decisions: readonly [BotDecision | undefined, BotDecision | undefined],
): BotDisagreement["counterfactual"] {
  if (
    decisions[0]?.command.type !== "CHOOSE_DANGEROUS_DISCARD" ||
    decisions[1]?.command.type !== "CHOOSE_DANGEROUS_DISCARD"
  ) return undefined;
  const targetId = projection.activeFunctionAction?.targetPlayerId;
  const actor = state.players[projection.own.id];
  const target = targetId ? state.players[targetId] : undefined;
  const cards = decisions.map((decision) =>
    decisionPhysicalCard(decision, projection)
  );
  if (!actor || !target || !cards[0] || !cards[1]) return undefined;
  const aligned = actor.faction !== "特工" && actor.faction === target.faction;
  const disposition = aligned ? -1 : 1;
  const utilities = cards.map(
    (card) => disposition * handCardUtility(card!, target.faction),
  ) as [number, number];
  const preferredPolicy = Math.abs(utilities[0] - utilities[1]) < 0.0001
    ? "tie"
    : utilities[0] > utilities[1]
      ? policies[0].id
      : policies[1].id;
  return {
    metric: "full-information-discard-denial",
    targetFaction: target.faction,
    utilities,
    preferredPolicy,
  };
}

function receiptCounterfactual(
  seed: number,
  commandNumber: number,
  projection: ReturnType<GameSessionService["project"]>,
  state: GameState,
  policies: readonly [BotPolicy, BotPolicy],
  decisions: readonly [BotDecision | undefined, BotDecision | undefined],
  livePolicies: readonly BotPolicy[],
  liveMemories: ReadonlyMap<string, BotMemory>,
): BotDisagreement["counterfactual"] {
  const receiptCommands = new Set(["ACCEPT_INTELLIGENCE", "DECLINE_INTELLIGENCE"]);
  const commandTypes = decisions.map((decision) => decision?.command.type);
  if (
    !commandTypes[0] ||
    !commandTypes[1] ||
    commandTypes[0] === commandTypes[1] ||
    !receiptCommands.has(commandTypes[0]) ||
    !receiptCommands.has(commandTypes[1])
  ) return undefined;
  const transmission = state.transmission;
  if (!transmission || !projection.transmission) return undefined;
  const card = PHYSICAL_DECK.find((candidate) => candidate.id === transmission.cardId);
  const currentRecipientId = transmission.intendedRecipientId;
  const nextRecipientId = nextLivingRecipientAfterDecline(projection);
  if (!card || !nextRecipientId) return undefined;
  const recipientForCommand = (commandType: string | undefined) =>
    commandType === "ACCEPT_INTELLIGENCE" ? currentRecipientId : nextRecipientId;
  const recipientIds = commandTypes.map(recipientForCommand) as [string, string];
  const utilities = decisions.map((decision, branchIndex) =>
    runReceiptBranch(
      state,
      projection.own.id,
      decision!.command,
      livePolicies,
      liveMemories,
      seed * 10_000 + commandNumber * 2 + branchIndex,
    )
  ) as [number, number];
  const preferredPolicy = Math.abs(utilities[0] - utilities[1]) < 0.0001
    ? "tie"
    : utilities[0] > utilities[1]
      ? policies[0].id
      : policies[1].id;
  return {
    metric: "full-information-receipt-branch",
    recipientIds,
    cardName: card.name,
    cardColor: card.color,
    utilities,
    preferredPolicy,
  };
}

function secretOrderCounterfactual(
  seed: number,
  commandNumber: number,
  projection: ReturnType<GameSessionService["project"]>,
  state: GameState,
  policies: readonly [BotPolicy, BotPolicy],
  decisions: readonly [BotDecision | undefined, BotDecision | undefined],
  comparisonMemories: readonly [BotMemory, BotMemory],
  livePolicies: readonly BotPolicy[],
  liveMemories: ReadonlyMap<string, BotMemory>,
): BotDisagreement["counterfactual"] {
  const commandTypes = decisions.map((decision) => decision?.command.type);
  const eligibleCommands = new Set(["PLAY_SECRET_ORDER", "PASS_REACTION"]);
  if (
    projection.reactionWindow?.kind !== "secretOrder" ||
    !commandTypes.includes("PLAY_SECRET_ORDER") ||
    commandTypes.some((commandType) => !commandType || !eligibleCommands.has(commandType))
  ) {
    return undefined;
  }
  const actorIndex = state.seatOrder.indexOf(projection.own.id);
  if (actorIndex < 0) return undefined;
  const utilities = decisions.map((decision, branchIndex) => {
    if (!decision) return Number.NEGATIVE_INFINITY;
    const branchPolicies = [...livePolicies];
    branchPolicies[actorIndex] = policies[branchIndex]!;
    const branchMemories = new Map([...liveMemories].map(([id, memory]) => [
      id,
      structuredClone(memory),
    ]));
    branchMemories.set(projection.own.id, structuredClone(comparisonMemories[branchIndex]!));
    return runFullGameBranch(
      state,
      projection.own.id,
      decision.command,
      branchPolicies,
      branchMemories,
      seed * 10_000 + commandNumber,
    );
  }) as [number, number];
  const preferredPolicy = Math.abs(utilities[0] - utilities[1]) < 0.0001
    ? "tie"
    : utilities[0] > utilities[1]
      ? policies[0].id
      : policies[1].id;
  const declarations = decisions.map((decision) => {
    const command = decision?.command;
    if (command?.type !== "PLAY_SECRET_ORDER") return undefined;
    const card = PHYSICAL_DECK.find((candidate) => candidate.id === command.cardId);
    return {
      word: command.word,
      color: card && "variant" in card && card.variant.kind === "secretOrder"
        ? card.variant.mapping[command.word]
        : undefined,
    };
  });
  return {
    metric: "full-information-secret-order-branch",
    secretOrderWords: declarations.map((declaration) => declaration?.word) as [
      string | undefined,
      string | undefined,
    ],
    secretOrderColors: declarations.map((declaration) => declaration?.color) as [
      string | undefined,
      string | undefined,
    ],
    utilities,
    preferredPolicy,
  };
}

function interceptCounterfactual(
  seed: number,
  commandNumber: number,
  projection: ReturnType<GameSessionService["project"]>,
  state: GameState,
  policies: readonly [BotPolicy, BotPolicy],
  decisions: readonly [BotDecision | undefined, BotDecision | undefined],
  comparisonMemories: readonly [BotMemory, BotMemory],
  livePolicies: readonly BotPolicy[],
  liveMemories: ReadonlyMap<string, BotMemory>,
): BotDisagreement["counterfactual"] {
  const commandTypes = decisions.map((decision) => decision?.command.type);
  if (
    projection.transmission?.transferredRecipientCommitted !== true ||
    !commandTypes.includes("PLAY_INTERCEPT") ||
    !commandTypes.includes("PASS_REACTION")
  ) {
    return undefined;
  }
  const actorIndex = state.seatOrder.indexOf(projection.own.id);
  if (actorIndex < 0) return undefined;
  const utilities = decisions.map((decision, branchIndex) => {
    if (!decision) return Number.NEGATIVE_INFINITY;
    const branchPolicies = [...livePolicies];
    branchPolicies[actorIndex] = policies[branchIndex]!;
    const branchMemories = new Map([...liveMemories].map(([id, memory]) => [
      id,
      structuredClone(memory),
    ]));
    branchMemories.set(projection.own.id, structuredClone(comparisonMemories[branchIndex]!));
    return runFullGameBranch(
      state,
      projection.own.id,
      decision.command,
      branchPolicies,
      branchMemories,
      seed * 10_000 + commandNumber,
    );
  }) as [number, number];
  const preferredPolicy = Math.abs(utilities[0] - utilities[1]) < 0.0001
    ? "tie"
    : utilities[0] > utilities[1]
      ? policies[0].id
      : policies[1].id;
  return {
    metric: "full-information-intercept-branch",
    utilities,
    preferredPolicy,
  };
}

function probeCounterfactual(
  seed: number,
  commandNumber: number,
  projection: ReturnType<GameSessionService["project"]>,
  state: GameState,
  policies: readonly [BotPolicy, BotPolicy],
  decisions: readonly [BotDecision | undefined, BotDecision | undefined],
  comparisonMemories: readonly [BotMemory, BotMemory],
  livePolicies: readonly BotPolicy[],
  liveMemories: ReadonlyMap<string, BotMemory>,
): BotDisagreement["counterfactual"] {
  const commandTypes = decisions.map((decision) => decision?.command.type);
  const functionKind = projection.activeFunctionAction?.kind;
  if (
    !functionKind ||
    !["probe", "probeIdentity", "probeDrawDiscard"].includes(functionKind) ||
    !commandTypes.includes("PLAY_COUNTER") ||
    !commandTypes.includes("PASS_REACTION")
  ) {
    return undefined;
  }
  const actorIndex = state.seatOrder.indexOf(projection.own.id);
  if (actorIndex < 0) return undefined;
  const utilities = decisions.map((decision, branchIndex) => {
    if (!decision) return Number.NEGATIVE_INFINITY;
    const branchPolicies = [...livePolicies];
    branchPolicies[actorIndex] = policies[branchIndex]!;
    const branchMemories = new Map([...liveMemories].map(([id, memory]) => [
      id,
      structuredClone(memory),
    ]));
    branchMemories.set(projection.own.id, structuredClone(comparisonMemories[branchIndex]!));
    return runFullGameBranch(
      state,
      projection.own.id,
      decision.command,
      branchPolicies,
      branchMemories,
      seed * 10_000 + commandNumber,
    );
  }) as [number, number];
  const preferredPolicy = Math.abs(utilities[0] - utilities[1]) < 0.0001
    ? "tie"
    : utilities[0] > utilities[1]
      ? policies[0].id
      : policies[1].id;
  return {
    metric: "full-information-probe-counter-branch",
    utilities,
    preferredPolicy,
  };
}

function runFullGameBranch(
  sourceState: GameState,
  observerId: string,
  initialCommand: GameCommand,
  policies: readonly BotPolicy[],
  memories: Map<string, BotMemory>,
  randomSeed: number,
): number {
  const state = structuredClone(sourceState);
  const ids = Object.keys(state.players);
  const randoms = new Map(ids.map((id, index) => [
    id,
    createSeededBotRandom(randomSeed * 131 + index + 1),
  ]));
  dispatchGameCommand(state, observerId, initialCommand);
  let commands = 0;
  while (!state.winner && commands < 10_000) {
    let advanced = false;
    for (const [index, id] of ids.entries()) {
      const botProjection = projectGameForPlayer(state, id);
      const policy = policies[index] ?? LIVE_BOT_POLICY;
      const memory = memories.get(id) ?? createBotMemory(botProjection, policy);
      memories.set(id, memory);
      const command = chooseBotCommand(botProjection, memory, {
        policy,
        random: randoms.get(id),
      });
      if (!command) continue;
      dispatchGameCommand(state, id, command);
      commands += 1;
      advanced = true;
      break;
    }
    if (!advanced) break;
  }
  const finalProjection = projectGameForPlayer(state, observerId);
  return evaluatePublicPosition(finalProjection, actualFactionBeliefs(state));
}

function runReceiptBranch(
  sourceState: GameState,
  observerId: string,
  initialCommand: GameCommand,
  livePolicies: readonly BotPolicy[],
  liveMemories: ReadonlyMap<string, BotMemory>,
  randomSeed: number,
): number {
  const state = structuredClone(sourceState);
  const ids = Object.keys(state.players);
  const memories = new Map([...liveMemories].map(([id, memory]) => [
    id,
    structuredClone(memory),
  ]));
  const randoms = new Map(ids.map((id, index) => [
    id,
    createSeededBotRandom(randomSeed * 131 + index + 1),
  ]));
  dispatchGameCommand(state, observerId, initialCommand);
  let commands = 0;
  while (
    !state.winner &&
    (
      state.transmission !== undefined ||
      state.pendingPublicTextReceipt !== undefined ||
      state.phase === "resolvingReceipt"
    ) &&
    commands < 500
  ) {
    let advanced = false;
    for (const [index, id] of ids.entries()) {
      const botProjection = projectGameForPlayer(state, id);
      const policy = livePolicies[index] ?? LIVE_BOT_POLICY;
      const memory = memories.get(id) ?? createBotMemory(botProjection, policy);
      memories.set(id, memory);
      const command = chooseBotCommand(botProjection, memory, {
        policy,
        random: randoms.get(id),
      });
      if (!command) continue;
      dispatchGameCommand(state, id, command);
      commands += 1;
      advanced = true;
      break;
    }
    if (!advanced) break;
  }
  const finalProjection = projectGameForPlayer(state, observerId);
  return evaluatePublicPosition(
    finalProjection,
    actualFactionBeliefs(state),
  );
}

function actualFactionBeliefs(state: GameState): Record<string, FactionBelief> {
  return Object.fromEntries(
    Object.values(state.players).map((player) => [
      player.id,
      {
        军情: player.faction === "军情" ? 1 : 0,
        潜伏: player.faction === "潜伏" ? 1 : 0,
        特工: player.faction === "特工" ? 1 : 0,
      },
    ]),
  ) as Record<string, FactionBelief>;
}

function nextLivingRecipientAfterDecline(
  projection: ReturnType<GameSessionService["project"]>,
): string | undefined {
  const transmission = projection.transmission;
  if (!transmission) return undefined;
  if (transmission.method === "直达") return transmission.senderId;
  const currentIndex = projection.seatOrder.indexOf(transmission.intendedRecipientId);
  if (currentIndex < 0) return undefined;
  const step = transmission.direction === "counterclockwise" ? -1 : 1;
  for (let offset = 1; offset <= projection.seatOrder.length; offset += 1) {
    const index = (
      currentIndex + step * offset + projection.seatOrder.length
    ) % projection.seatOrder.length;
    const playerId = projection.seatOrder[index]!;
    if (projection.players.find((player) => player.id === playerId)?.alive) return playerId;
  }
  return undefined;
}

function summarizeDecisionCard(
  decision: BotDecision | undefined,
  projection: ReturnType<GameSessionService["project"]>,
): BotDisagreement["decisionCards"][number] {
  const command = decision?.command;
  if (!command || !("cardId" in command)) return undefined;
  const card = decisionPhysicalCard(decision, projection);
  return card
    ? {
        name: card.name,
        color: card.color,
        transmission: card.transmission,
      }
    : undefined;
}

function decisionPhysicalCard(
  decision: BotDecision | undefined,
  projection: ReturnType<GameSessionService["project"]>,
) {
  const command = decision?.command;
  if (!command || !("cardId" in command)) return undefined;
  return projection.own.hand.find((held) => held.id === command.cardId) ??
    projection.activeFunctionAction?.inspectedHand?.find(
      (held) => held.id === command.cardId,
    );
}

function didPlayerWin(winner: WinnerState | undefined, playerId: string, faction: string): boolean {
  if (!winner) return false;
  return winner.kind === "agent" ? winner.playerId === playerId : winner.faction === faction;
}

function policySummary(
  participants: readonly SelfPlayGameResult["participants"][number][],
  policy: string,
): PolicyPerformanceSummary {
  const entries = participants.filter((participant) => participant.policy === policy);
  return {
    ...winRateSummary(entries),
    byFaction: groupedWinRates(entries, (entry) => entry.faction),
    bySeat: groupedWinRates(entries, (entry) => String(entry.seat)),
    beliefCalibration: summarizeBeliefCalibration(entries),
  };
}

const CALIBRATION_FACTIONS = ["军情", "潜伏", "特工"] as const;

function beliefCalibrationForObserver(
  games: GameSessionService,
  roomCode: string,
  observerId: string,
  policy: BotPolicy,
  memory: BotMemory | undefined,
): SelfPlayGameResult["participants"][number]["beliefCalibration"] {
  if (!memory) return { observations: 0, brierSum: 0, correctTopChoice: 0 };
  const projection = games.project(roomCode, observerId);
  const hiddenFactionProjection = {
    ...projection,
    players: projection.players.map((player) => ({
      ...player,
      faction: undefined,
    })),
  };
  const beliefs = factionBeliefsForPolicy(memory, hiddenFactionProjection, policy);
  const state = games.getState(roomCode);
  let observations = 0;
  let brierSum = 0;
  let correctTopChoice = 0;
  for (const targetId of state.seatOrder) {
    if (targetId === observerId) continue;
    const probabilities = beliefs[targetId];
    if (!probabilities) continue;
    const actual = state.players[targetId].faction;
    observations += 1;
    brierSum += CALIBRATION_FACTIONS.reduce(
      (sum, faction) =>
        sum + (probabilities[faction] - (faction === actual ? 1 : 0)) ** 2,
      0,
    );
    const predicted = CALIBRATION_FACTIONS.reduce((best, faction) =>
      probabilities[faction] > probabilities[best] ? faction : best
    );
    if (predicted === actual) correctTopChoice += 1;
  }
  return { observations, brierSum, correctTopChoice };
}

function summarizeBeliefCalibration(
  entries: readonly SelfPlayGameResult["participants"][number][],
): BeliefCalibrationSummary {
  const observations = entries.reduce(
    (sum, entry) => sum + entry.beliefCalibration.observations,
    0,
  );
  const brierSum = entries.reduce(
    (sum, entry) => sum + entry.beliefCalibration.brierSum,
    0,
  );
  const correctTopChoice = entries.reduce(
    (sum, entry) => sum + entry.beliefCalibration.correctTopChoice,
    0,
  );
  return {
    observations,
    brierSum,
    brierScore: brierSum / Math.max(1, observations),
    correctTopChoice,
    topChoiceAccuracy: correctTopChoice / Math.max(1, observations),
  };
}

function winRateSummary(
  entries: readonly SelfPlayGameResult["participants"][number][],
): WinRateSummary {
  const wins = entries.filter((participant) => participant.won).length;
  return { wins, entries: entries.length, winRate: wins / Math.max(1, entries.length) };
}

function groupedWinRates(
  entries: readonly SelfPlayGameResult["participants"][number][],
  keyFor: (entry: SelfPlayGameResult["participants"][number]) => string,
): Record<string, WinRateSummary> {
  const groups = new Map<string, SelfPlayGameResult["participants"][number][]>();
  for (const entry of entries) {
    const key = keyFor(entry);
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return Object.fromEntries([...groups].map(([key, group]) => [key, winRateSummary(group)]));
}

function winRateFor(
  participants: readonly SelfPlayGameResult["participants"][number][],
  policy: string,
): number {
  return policySummary(participants, policy).winRate;
}

function decisionStateKey(id: string, projection: ReturnType<GameSessionService["project"]>): string {
  return JSON.stringify([
    id,
    projection.phase,
    projection.auditLog.length,
    projection.reactionWindow?.currentResponderId,
    projection.transmission?.intendedRecipientId,
    projection.transmission?.receiptStage,
    projection.legalActions,
  ]);
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
