import { runPairedTournament, runSelfPlayBenchmark, runSelfPlayGame } from "./benchmark";
import { evaluationPolicyById } from "./policies";
import { LIVE_BOT_POLICY } from "../server/bot/strategy";

const mode = process.argv[2] === "ab"
  ? "ab"
  : process.argv[2] === "disagreements"
    ? "disagreements"
    : "self-play";
const offset = mode === "self-play" ? 0 : 1;
const playerCount = parseInteger(process.argv[2 + offset] ?? "2", "player count") as 2 | 5 | 6 | 7 | 8;
const games = parseInteger(process.argv[3 + offset] ?? "100", mode === "ab" ? "pair count" : "game count");
const startSeed = parseInteger(process.argv[4 + offset] ?? "1", "start seed");

if (mode === "ab") {
  const result = runPairedTournament({
    playerCount,
    pairs: games,
    startSeed,
    candidatePolicy: evaluationPolicyById("candidate-v29"),
  });
  console.log(`AI A/B: ${result.pairs} pairs (${result.games} games), ${result.playerCount} players`);
  console.log(
    `completed=${result.completed} stalled=${result.stalled} `
    + `commandLimit=${result.commandLimited} rejected=${result.rejectedCommands}`,
  );
  console.log(`candidate=${result.candidate.wins}/${result.candidate.entries} (${percent(result.candidate.winRate)}) baseline=${result.baseline.wins}/${result.baseline.entries} (${percent(result.baseline.winRate)})`);
  console.log(`candidate beliefs=brier ${result.candidate.beliefCalibration.brierScore.toFixed(4)}, top-choice ${percent(result.candidate.beliefCalibration.topChoiceAccuracy)}`);
  console.log(`baseline beliefs=brier ${result.baseline.beliefCalibration.brierScore.toFixed(4)}, top-choice ${percent(result.baseline.beliefCalibration.topChoiceAccuracy)}`);
  console.log(`paired difference=${percent(result.pairedWinRateDifference)} 95% CI=[${percent(result.confidence95.low)}, ${percent(result.confidence95.high)}] verdict=${result.verdict}`);
} else if (mode === "disagreements") {
  const firstPolicy = evaluationPolicyById(process.argv[6] ?? LIVE_BOT_POLICY.id);
  const secondPolicy = evaluationPolicyById(process.argv[7] ?? "candidate-v29");
  const decisiveOnly = process.argv.includes("--decisive");
  const ranked = process.argv.includes("--ranked");
  const results = Array.from({ length: games }, (_, index) => runSelfPlayGame({
    playerCount,
    seed: startSeed + index,
    comparePolicies: [firstPolicy, secondPolicy],
  }));
  const disagreements = results.flatMap((result) => result.disagreements);
  const categoryCounts = new Map<string, number>();
  for (const entry of disagreements) {
    const category = `${entry.decisions[0]?.command.type ?? "none"} → ${entry.decisions[1]?.command.type ?? "none"}`;
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  const categories = [...categoryCounts].map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count);
  const counterfactuals = disagreements.flatMap((entry) =>
    entry.counterfactual ? [entry.counterfactual] : []
  );
  console.log(`AI disagreements: ${games} games, ${playerCount} players, ${disagreements.length} decisions`);
  console.log(`completed=${results.filter((result) => result.status === "completed").length} stalled=${results.filter((result) => result.status === "stalled").length}`);
  console.log(`categories=${JSON.stringify(categories.slice(0, 12))}`);
  for (const metric of [...new Set(counterfactuals.map((entry) => entry.metric))]) {
    const entries = counterfactuals.filter((entry) => entry.metric === metric);
    const firstPolicyWins = entries.filter(
      (entry) => entry.preferredPolicy === firstPolicy.id,
    ).length;
    const secondPolicyWins = entries.filter(
      (entry) => entry.preferredPolicy === secondPolicy.id,
    ).length;
    const counterfactualTies = entries.filter(
      (entry) => entry.preferredPolicy === "tie",
    ).length;
    const meanSecondPolicyGain = entries.reduce(
      (sum, entry) => sum + entry.utilities[1] - entry.utilities[0],
      0,
    ) / Math.max(1, entries.length);
    const orderedGains = entries
      .map((entry) => entry.utilities[1] - entry.utilities[0])
      .sort((left, right) => left - right);
    const medianSecondPolicyGain = orderedGains.length === 0
      ? 0
      : orderedGains.length % 2 === 1
        ? orderedGains[Math.floor(orderedGains.length / 2)]!
        : (
            orderedGains[orderedGains.length / 2 - 1]! +
            orderedGains[orderedGains.length / 2]!
          ) / 2;
    const worstSecondPolicyGain = orderedGains[0] ?? 0;
    const bestSecondPolicyGain = orderedGains.at(-1) ?? 0;
    console.log(
      `counterfactual metric=${metric} count=${entries.length} `
      + `${firstPolicy.id}=${firstPolicyWins} ${secondPolicy.id}=${secondPolicyWins} `
      + `ties=${counterfactualTies} meanSecondPolicyGain=${meanSecondPolicyGain.toFixed(3)} `
      + `medianSecondPolicyGain=${medianSecondPolicyGain.toFixed(3)} `
      + `range=[${worstSecondPolicyGain.toFixed(3)}, ${bestSecondPolicyGain.toFixed(3)}]`,
    );
  }
  const decisiveDisagreements = disagreements.filter((entry) =>
    entry.counterfactual && entry.counterfactual.preferredPolicy !== "tie"
  );
  const reportedDisagreements = ranked
    ? decisiveDisagreements
        .sort((left, right) =>
          counterfactualGain(left) - counterfactualGain(right)
        )
        .slice(0, 20)
    : decisiveOnly
    ? decisiveDisagreements
    : disagreements.slice(0, 10);
  for (const entry of reportedDisagreements) {
    console.log(JSON.stringify(entry));
  }
} else {
  const result = runSelfPlayBenchmark({ playerCount, games, startSeed });

  console.log(`AI self-play: ${result.games} games, ${result.playerCount} players`);
  console.log(`completed=${result.completed} stalled=${result.stalled} commandLimit=${result.commandLimited}`);
  console.log(`avgCommands=${result.averageCommands.toFixed(1)} avgTurns=${result.averageTurns.toFixed(1)} rejected=${result.rejectedCommands}`);
  console.log(`winners=${JSON.stringify(result.winners)}`);
}

function counterfactualGain(
  disagreement: ReturnType<typeof runSelfPlayGame>["disagreements"][number],
): number {
  const utilities = disagreement.counterfactual?.utilities;
  return utilities ? utilities[1] - utilities[0] : 0;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function parseInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}
