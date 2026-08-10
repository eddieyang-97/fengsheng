import { runPairedTournament, runSelfPlayGame, type TournamentMode } from "./benchmark";
import { LIVE_BOT_POLICY, type BotPolicy } from "../server/bot/strategy";

const playerCount = parseInteger(process.argv[2] ?? "5", "player count") as 2 | 5 | 6 | 7 | 8;
const pairs = parseInteger(process.argv[3] ?? "100", "pair count");
const startSeed = parseInteger(process.argv[4] ?? "41001", "start seed");
const penalties = (process.argv[5] ?? "0,1,2,4,8,16,32,64")
  .split(",")
  .filter(Boolean)
  .map(parseNonNegativeNumber);
const diagnosticGames = parseInteger(process.argv[6] ?? String(pairs), "diagnostic game count");
const modes: readonly TournamentMode[] = ["focal-seat", "mixed-seats", "population"];

for (const penalty of penalties) {
  const candidate: BotPolicy = {
    ...LIVE_BOT_POLICY,
    id: `agent-known-black-penalty-${penalty}`,
    agentKnownBlackReceiptPenalty: penalty,
  };
  const disagreements = Array.from({ length: diagnosticGames }, (_, index) =>
    runSelfPlayGame({
      playerCount,
      seed: startSeed + index,
      comparePolicies: [LIVE_BOT_POLICY, candidate],
    }).disagreements
  ).flat();
  const receiptDisagreements = disagreements.filter(({ decisions }) => {
    const types = decisions.map((decision) => decision?.command.type);
    return types.includes("ACCEPT_INTELLIGENCE") && types.includes("DECLINE_INTELLIGENCE");
  });
  console.log(
    `penalty=${penalty} disagreements=${disagreements.length} ` +
    `accept-vs-decline=${receiptDisagreements.length}`,
  );
  if (penalty === 0) continue;
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
      `candidate=${percent(result.candidate.winRate)} baseline=${percent(result.baseline.winRate)} ` +
      `agent=${formatFaction(result.candidate.byFaction["特工"])} ` +
      `baselineAgent=${formatFaction(result.baseline.byFaction["特工"])} ` +
      `rejected=${result.rejectedCommands}`,
    );
  }
}

function parseInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`invalid penalty '${value}'`);
  return parsed;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatFaction(value: { wins: number; entries: number; winRate: number } | undefined): string {
  return value ? `${value.wins}/${value.entries}(${percent(value.winRate)})` : "n/a";
}
