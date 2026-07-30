import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { runPairedTournament } from "./benchmark";
import type { PolicyPerformanceSummary } from "./benchmark";
import {
  addTournamentChunk,
  assertCampaignConfig,
  createCampaignCheckpoint,
  summarizeCampaign,
  type TournamentCampaignCheckpoint,
  type TournamentCampaignConfig,
} from "./campaign";
import { CANDIDATE_V24, evaluationPolicyById } from "./policies";
import { LIVE_BOT_POLICY } from "../server/bot/strategy";

const parsed = parseArguments(process.argv.slice(2));
const playerCount = parseInteger(parsed.positional[0] ?? "5", "player count") as 2 | 5 | 6 | 7 | 8;
const targetPairs = parseInteger(parsed.positional[1] ?? "1000", "pair count");
const startSeed = parseInteger(parsed.positional[2] ?? "1", "start seed");
const candidate = evaluationPolicyById(parsed.options.candidate ?? CANDIDATE_V24.id);
const baseline = evaluationPolicyById(parsed.options.baseline ?? LIVE_BOT_POLICY.id);
if (candidate.id === baseline.id) throw new Error("candidate and baseline policies must differ");
const chunkSize = parseInteger(parsed.options["chunk-size"] ?? String(Math.min(100, targetPairs)), "chunk size");
const checkpointPath = parsed.options.checkpoint ? resolve(parsed.options.checkpoint) : undefined;
const mode = parseTournamentMode(parsed.options.mode ?? "mixed-seats");
const sourceFingerprint = runtimeSourceFingerprint();
const config: TournamentCampaignConfig = {
  playerCount,
  targetPairs,
  startSeed,
  candidatePolicyId: candidate.id,
  baselinePolicyId: baseline.id,
  mode,
  sourceFingerprint,
};
let checkpoint = loadOrCreateCheckpoint(config, checkpointPath, parsed.flags.has("resume"));
const startedAt = Date.now();

while (checkpoint.completedPairs < config.targetPairs) {
  assertSourceUnchanged(sourceFingerprint);
  const pairs = Math.min(chunkSize, config.targetPairs - checkpoint.completedPairs);
  const chunk = runPairedTournament({
    playerCount,
    pairs,
    startSeed: startSeed + checkpoint.completedPairs,
    candidatePolicy: candidate,
    baselinePolicy: baseline,
    mode,
  });
  assertSourceUnchanged(sourceFingerprint);
  checkpoint = addTournamentChunk(checkpoint, chunk);
  if (checkpointPath) writeCheckpoint(checkpointPath, checkpoint);
  const partial = summarizeCampaign(checkpoint);
  console.log(
    `progress=${checkpoint.completedPairs}/${config.targetPairs} pairs `
    + `difference=${percent(partial.pairedWinRateDifference)} `
    + `elapsed=${formatDuration(Date.now() - startedAt)}`,
  );
}

const result = summarizeCampaign(checkpoint);
console.log(`AI A/B: ${result.completedPairs} pairs (${result.completedPairs * 2} games), ${result.config.playerCount} players, mode=${result.config.mode}`);
console.log(`policies=${result.config.candidatePolicyId} vs ${result.config.baselinePolicyId}`);
console.log(
  `completed=${result.completedGames} stalled=${result.stalledGames} `
  + `commandLimit=${result.commandLimitedGames} rejected=${result.rejectedCommands}`,
);
console.log(`candidate=${formatWinRate(result.candidate)} baseline=${formatWinRate(result.baseline)}`);
console.log(`paired difference=${percent(result.pairedWinRateDifference)} 95% CI=[${percent(result.confidence95.low)}, ${percent(result.confidence95.high)}] verdict=${result.verdict}`);
console.log(`candidate by faction=${formatBreakdown(result.candidate.byFaction)}`);
console.log(`baseline by faction=${formatBreakdown(result.baseline.byFaction)}`);
console.log(`candidate by seat=${formatBreakdown(result.candidate.bySeat)}`);
console.log(`baseline by seat=${formatBreakdown(result.baseline.bySeat)}`);
console.log(`candidate beliefs=${formatCalibration(result.candidate.beliefCalibration)}`);
console.log(`baseline beliefs=${formatCalibration(result.baseline.beliefCalibration)}`);
if (checkpointPath) console.log(`checkpoint=${checkpointPath}`);

function loadOrCreateCheckpoint(
  expectedConfig: TournamentCampaignConfig,
  path: string | undefined,
  resume: boolean,
): TournamentCampaignCheckpoint {
  if (resume) {
    if (!path) throw new Error("--resume requires --checkpoint <path>");
    if (!existsSync(path)) throw new Error(`checkpoint does not exist: ${path}`);
    const saved = JSON.parse(readFileSync(path, "utf8")) as TournamentCampaignCheckpoint;
    assertCampaignConfig(saved, expectedConfig);
    return saved;
  }
  if (path && existsSync(path)) {
    throw new Error(`checkpoint already exists; pass --resume or choose another path: ${path}`);
  }
  return createCampaignCheckpoint(expectedConfig);
}

function writeCheckpoint(path: string, value: TournamentCampaignCheckpoint): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, path);
}

function formatBreakdown(values: Record<string, { wins: number; entries: number; winRate: number }>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, formatWinRate(value)])));
}

function formatWinRate(value: { wins: number; entries: number; winRate: number }): string {
  return `${value.wins}/${value.entries} (${percent(value.winRate)})`;
}

function formatCalibration(value: PolicyPerformanceSummary["beliefCalibration"]): string {
  return `brier=${value.brierScore.toFixed(4)} topChoice=${value.correctTopChoice}/${value.observations} (${percent(value.topChoiceAccuracy)})`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatDuration(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function parseInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function parseTournamentMode(value: string): TournamentCampaignConfig["mode"] {
  if (value === "focal-seat" || value === "mixed-seats" || value === "population") return value;
  throw new Error("mode must be 'focal-seat', 'mixed-seats', or 'population'");
}

function assertSourceUnchanged(expected: string): void {
  const current = runtimeSourceFingerprint();
  if (current !== expected) {
    throw new Error(
      `runtime source changed during campaign (${expected.slice(0, 12)} -> ${current.slice(0, 12)}); `
      + "the current chunk was discarded and must be rerun from a stable tree",
    );
  }
}

function runtimeSourceFingerprint(): string {
  const root = resolve(".");
  const paths = [
    ...runtimeFiles(resolve(root, "src")),
    resolve(root, "package.json"),
    resolve(root, "package-lock.json"),
  ].filter(existsSync).sort();
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update(relative(root, path).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function runtimeFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) {
    return /\.(?:ts|tsx)$/.test(path) ? [path] : [];
  }
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    runtimeFiles(resolve(path, entry.name))
  );
}

function parseArguments(args: string[]): {
  positional: string[];
  options: Record<string, string>;
  flags: Set<string>;
} {
  const positional: string[] = [];
  const options: Record<string, string> = {};
  const flags = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    if (key === "resume") {
      flags.add(key);
      continue;
    }
    const optionValue = args[index + 1];
    if (!optionValue || optionValue.startsWith("--")) throw new Error(`${value} requires a value`);
    options[key] = optionValue;
    index += 1;
  }
  return { positional, options, flags };
}
