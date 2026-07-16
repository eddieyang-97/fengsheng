import { describe, expect, it } from "vitest";

import { runPairedTournament, runSelfPlayBenchmark } from "./bot-benchmark";

describe("AI self-play benchmark", () => {
  it("finishes deterministic duel batches without stalling", () => {
    const first = runSelfPlayBenchmark({ playerCount: 2, games: 5, startSeed: 1 });
    const second = runSelfPlayBenchmark({ playerCount: 2, games: 5, startSeed: 1 });

    expect(first.results).toEqual(second.results);
    expect(first.completed).toBe(5);
    expect(first.stalled).toBe(0);
    expect(first.commandLimited).toBe(0);
    expect(first.rejectedCommands).toBeGreaterThan(0);
  });

  it("compares baseline and candidate in deterministic swapped-seat pairs", () => {
    const first = runPairedTournament({ playerCount: 2, pairs: 5, startSeed: 21 });
    const second = runPairedTournament({ playerCount: 2, pairs: 5, startSeed: 21 });

    expect(first).toEqual(second);
    expect(first.games).toBe(10);
    expect(first.completed).toBe(10);
    expect(first.stalled).toBe(0);
    expect(first.candidate.entries).toBe(10);
    expect(first.baseline.entries).toBe(10);
    expect(first.confidence95.low).toBeLessThanOrEqual(first.pairedWinRateDifference);
    expect(first.confidence95.high).toBeGreaterThanOrEqual(first.pairedWinRateDifference);
    for (let index = 0; index < first.results.length; index += 2) {
      const firstLeg = first.results[index]!;
      const secondLeg = first.results[index + 1]!;
      expect(firstLeg.seed).toBe(secondLeg.seed);
      expect(firstLeg.participants.map((entry) => entry.faction)).toEqual(
        secondLeg.participants.map((entry) => entry.faction),
      );
      expect(firstLeg.participants.map((entry) => entry.policy)).toEqual(
        secondLeg.participants.map((entry) =>
          entry.policy === "candidate-v3" ? "tactical-v2" : "candidate-v3"
        ),
      );
    }
  });
});
