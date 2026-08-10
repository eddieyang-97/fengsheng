import { runPairedTournament, runSelfPlayGame, type TournamentMode } from "./benchmark";
import { LIVE_BOT_POLICY, type BotPolicy } from "../server/bot/strategy";

const playerCount = parseInteger(process.argv[2] ?? "5", "player count") as 2 | 5 | 6 | 7 | 8;
const pairs = parseInteger(process.argv[3] ?? "100", "pair count");
const startSeed = parseInteger(process.argv[4] ?? "30001", "start seed");
const sweepArgument = process.argv[5] ?? "0.4,0.55,0.7,0.85,1";
const auditOnly = sweepArgument === "audit";
const diagnoseOnly = sweepArgument.startsWith("diagnose:");
const probabilities = (auditOnly ? "" : sweepArgument.replace(/^diagnose:/, ""))
  .split(",")
  .filter(Boolean)
  .map((value) => parseProbability(value));
const modes: readonly TournamentMode[] = ["focal-seat", "mixed-seats", "population"];

const liveGames = Array.from({ length: pairs }, (_, index) => runSelfPlayGame({
  playerCount,
  seed: startSeed + index,
}));
const observed = liveGames.reduce(
  (total, game) => ({
    total: total.total + game.decryptRejections.total,
    black: total.black + game.decryptRejections.black,
  }),
  { total: 0, black: 0 },
);
console.log(
  `observed decrypt-rejections=${observed.total} black=${observed.black} ` +
  `rate=${percent(observed.black / Math.max(1, observed.total))} ` +
  `wilson95=[${wilson95(observed.black, observed.total).map(percent).join(",")}]`,
);

for (const probability of auditOnly ? [] : probabilities) {
  const candidate: BotPolicy = {
    ...LIVE_BOT_POLICY,
    id: `decrypt-rejection-${probability}`,
    decryptRejectionBlackProbability: probability,
  };
  const disagreements = liveGames.reduce((count, game) => count + runSelfPlayGame({
    playerCount,
    seed: game.seed,
    comparePolicies: [LIVE_BOT_POLICY, candidate],
  }).disagreements.length, 0);
  console.log(`probability=${probability.toFixed(2)} observed-decision-disagreements=${disagreements}`);
  if (diagnoseOnly) continue;
  for (const mode of modes) {
    const result = runPairedTournament({
      playerCount,
      pairs,
      startSeed,
      candidatePolicy: candidate,
      baselinePolicy: LIVE_BOT_POLICY,
      mode,
    });
    console.log(
      `  ${mode}: difference=${percent(result.pairedWinRateDifference)} ` +
      `CI=[${percent(result.confidence95.low)},${percent(result.confidence95.high)}] ` +
      `brier=${result.candidate.beliefCalibration.brierScore.toFixed(4)} ` +
      `baselineBrier=${result.baseline.beliefCalibration.brierScore.toFixed(4)} ` +
      `rejected=${result.rejectedCommands}`,
    );
  }
}

function parseInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function parseProbability(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`invalid probability '${value}'`);
  }
  return parsed;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function wilson95(successes: number, total: number): readonly [number, number] {
  if (total === 0) return [0, 1];
  const z = 1.96;
  const proportion = successes / total;
  const denominator = 1 + z ** 2 / total;
  const center = (proportion + z ** 2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt(
    proportion * (1 - proportion) / total + z ** 2 / (4 * total ** 2),
  ) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}
