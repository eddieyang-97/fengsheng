import { runPairedTournament, runSelfPlayBenchmark } from "./bot-benchmark";

const mode = process.argv[2] === "ab" ? "ab" : "self-play";
const offset = mode === "ab" ? 1 : 0;
const playerCount = parseInteger(process.argv[2 + offset] ?? "2", "player count") as 2 | 5 | 6 | 7 | 8;
const games = parseInteger(process.argv[3 + offset] ?? "100", mode === "ab" ? "pair count" : "game count");
const startSeed = parseInteger(process.argv[4 + offset] ?? "1", "start seed");

if (mode === "ab") {
  const result = runPairedTournament({ playerCount, pairs: games, startSeed });
  console.log(`AI A/B: ${result.pairs} pairs (${result.games} games), ${result.playerCount} players`);
  console.log(`completed=${result.completed} stalled=${result.stalled} commandLimit=${result.commandLimited}`);
  console.log(`candidate=${result.candidate.wins}/${result.candidate.entries} (${percent(result.candidate.winRate)}) baseline=${result.baseline.wins}/${result.baseline.entries} (${percent(result.baseline.winRate)})`);
  console.log(`paired difference=${percent(result.pairedWinRateDifference)} 95% CI=[${percent(result.confidence95.low)}, ${percent(result.confidence95.high)}] verdict=${result.verdict}`);
} else {
  const result = runSelfPlayBenchmark({ playerCount, games, startSeed });

  console.log(`AI self-play: ${result.games} games, ${result.playerCount} players`);
  console.log(`completed=${result.completed} stalled=${result.stalled} commandLimit=${result.commandLimited}`);
  console.log(`avgCommands=${result.averageCommands.toFixed(1)} avgTurns=${result.averageTurns.toFixed(1)} rejected=${result.rejectedCommands}`);
  console.log(`winners=${JSON.stringify(result.winners)}`);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function parseInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}
