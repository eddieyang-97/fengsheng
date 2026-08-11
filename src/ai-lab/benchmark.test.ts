import { describe, expect, it } from "vitest";

import { runPairedTournament, runSelfPlayBenchmark, runSelfPlayGame } from "./benchmark";
import { CANDIDATE_V23, CANDIDATE_V28, CANDIDATE_V29, CANDIDATE_V43, CANDIDATE_V44, CANDIDATE_V57 } from "./policies";
import { LIVE_BOT_POLICY, TACTICAL_V2, TACTICAL_V3, TACTICAL_V12, TACTICAL_V14, TACTICAL_V18, TACTICAL_V19, TACTICAL_V20 } from "../server/bot/strategy";

const INCREMENTAL_TRANSFER_POLICY = {
  ...TACTICAL_V3,
  id: "test-incremental-transfer",
  incrementalTransfer: true,
};

describe("AI self-play benchmark", () => {
  it("completes a live-policy smoke sample without rejected projected commands", () => {
    const result = runSelfPlayBenchmark({
      playerCount: 5,
      games: 5,
      startSeed: 1,
    });

    expect(result.completed).toBe(5);
    expect(result.stalled).toBe(0);
    expect(result.commandLimited).toBe(0);
    expect(result.rejectedCommands).toBe(0);
  });

  it("records the hidden color when a player rejects immediately after 破译", () => {
    const result = runSelfPlayGame({ playerCount: 5, seed: 30003 });

    expect(result.decryptRejections).toEqual({ total: 1, black: 1 });
  });

  it("finishes deterministic duel batches without stalling or rejected commands", () => {
    const first = runSelfPlayBenchmark({ playerCount: 2, games: 5, startSeed: 1 });
    const second = runSelfPlayBenchmark({ playerCount: 2, games: 5, startSeed: 1 });

    expect(first.results).toEqual(second.results);
    expect(first.completed).toBe(5);
    expect(first.stalled).toBe(0);
    expect(first.commandLimited).toBe(0);
    expect(first.rejectedCommands).toBe(0);
  });

  it("compares baseline and candidate in deterministic swapped-seat pairs", () => {
    const first = runPairedTournament({ playerCount: 2, pairs: 5, startSeed: 21 });
    const second = runPairedTournament({ playerCount: 2, pairs: 5, startSeed: 21 });

    expect(first).toEqual(second);
    expect(first.games).toBe(10);
    expect(first.completed).toBe(10);
    expect(first.stalled).toBe(0);
    expect(first.rejectedCommands).toBe(0);
    expect(first.candidate.entries).toBe(10);
    expect(first.baseline.entries).toBe(10);
    expect(first.candidate.beliefCalibration.observations).toBe(10);
    expect(first.baseline.beliefCalibration.observations).toBe(10);
    expect(first.candidate.beliefCalibration.brierScore).toBeGreaterThanOrEqual(0);
    expect(first.candidate.beliefCalibration.topChoiceAccuracy).toBeGreaterThanOrEqual(0);
    expect(first.candidate.beliefCalibration.topChoiceAccuracy).toBeLessThanOrEqual(1);
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
          entry.policy === CANDIDATE_V29.id ? LIVE_BOT_POLICY.id : CANDIDATE_V29.id
        ),
      );
    }
  });

  it("compares whole-policy populations on matching seeds and factions", () => {
    const result = runPairedTournament({
      playerCount: 5,
      pairs: 2,
      startSeed: 41,
      candidatePolicy: CANDIDATE_V23,
      baselinePolicy: TACTICAL_V3,
      mode: "population",
    });

    expect(result.mode).toBe("population");
    expect(result.pairDifferenceMoments.count).toBe(2);
    for (let index = 0; index < result.results.length; index += 2) {
      const candidateGame = result.results[index]!;
      const baselineGame = result.results[index + 1]!;
      expect(candidateGame.seed).toBe(baselineGame.seed);
      expect(candidateGame.participants.map((entry) => entry.faction)).toEqual(
        baselineGame.participants.map((entry) => entry.faction),
      );
      expect(new Set(candidateGame.participants.map((entry) => entry.policy))).toEqual(
        new Set([CANDIDATE_V23.id]),
      );
      expect(new Set(baselineGame.participants.map((entry) => entry.policy))).toEqual(
        new Set([TACTICAL_V3.id]),
      );
    }
  });

  it("compares a rotating focal seat against fixed baseline opponents", () => {
    const result = runPairedTournament({
      playerCount: 5,
      pairs: 6,
      startSeed: 51,
      candidatePolicy: CANDIDATE_V23,
      baselinePolicy: TACTICAL_V3,
      mode: "focal-seat",
    });

    expect(result.mode).toBe("focal-seat");
    expect(result.candidate.entries).toBe(6);
    expect(result.baseline.entries).toBe(6);
    expect(result.pairDifferenceMoments.count).toBe(6);
    for (let index = 0; index < result.results.length; index += 2) {
      const candidateGame = result.results[index]!;
      const baselineGame = result.results[index + 1]!;
      const focalCandidate = candidateGame.participants.find(
        (entry) => entry.policy === CANDIDATE_V23.id,
      )!;
      const focalBaseline = baselineGame.participants.find(
        (entry) => entry.id === focalCandidate.id,
      )!;
      expect(candidateGame.seed).toBe(baselineGame.seed);
      expect(candidateGame.participants.map((entry) => entry.faction)).toEqual(
        baselineGame.participants.map((entry) => entry.faction),
      );
      expect(focalBaseline).toMatchObject({
        id: focalCandidate.id,
        seat: focalCandidate.seat,
        faction: focalCandidate.faction,
        policy: TACTICAL_V3.id,
      });
      expect(candidateGame.participants.filter((entry) => entry.id !== focalCandidate.id).every(
        (entry) => entry.policy === TACTICAL_V3.id,
      )).toBe(true);
      expect(baselineGame.participants.every((entry) => entry.policy === TACTICAL_V3.id)).toBe(true);
    }
  });

  it("records policy disagreements without changing tactical-v2 game outcomes", () => {
    const ordinary = runSelfPlayBenchmark({ playerCount: 5, games: 1, startSeed: 101 });
    const observed = runSelfPlayGame({
      playerCount: 5,
      seed: 101,
      comparePolicies: [TACTICAL_V2, INCREMENTAL_TRANSFER_POLICY],
    });

    expect(observed.winner).toEqual(ordinary.results[0]?.winner);
    expect(observed.commands).toBe(ordinary.results[0]?.commands);
    expect(observed.disagreements.length).toBeGreaterThan(0);
    expect(observed.disagreements[0]).toMatchObject({
      seed: 101,
      policies: [TACTICAL_V2.id, INCREMENTAL_TRANSFER_POLICY.id],
    });
    expect(observed.disagreements.every((entry) =>
      JSON.stringify(entry.decisions[0]?.command) !== JSON.stringify(entry.decisions[1]?.command)
    )).toBe(true);
  });

  it("scores 危险情报 discard disagreements with hidden full-information value", () => {
    const result = runSelfPlayGame({
      playerCount: 5,
      seed: 30001,
      comparePolicies: [TACTICAL_V2, CANDIDATE_V23],
    });
    const evaluated = result.disagreements.filter((entry) => entry.counterfactual);

    expect(evaluated.length).toBeGreaterThan(0);
    expect(evaluated.every((entry) =>
      entry.counterfactual?.metric === "full-information-discard-denial" &&
      entry.counterfactual.utilities.every(Number.isFinite)
    )).toBe(true);
  });

  it("scores accept-versus-decline disagreements by resolving both receipt branches", () => {
    const result = runSelfPlayGame({
      playerCount: 5,
      seed: 30005,
      policies: Array.from({ length: 5 }, () => TACTICAL_V12),
      comparePolicies: [TACTICAL_V12, CANDIDATE_V28],
    });
    const evaluated = result.disagreements.find((entry) =>
      entry.counterfactual?.metric === "full-information-receipt-branch"
    );

    expect(evaluated?.counterfactual).toMatchObject({
      metric: "full-information-receipt-branch",
      cardColor: "黑",
    });
    expect(evaluated?.counterfactual?.recipientIds).toHaveLength(2);
    expect(evaluated?.counterfactual?.utilities.every(Number.isFinite)).toBe(true);
  });

  it("scores 秘密下达 use-versus-preserve disagreements through the end of the game", () => {
    const result = runSelfPlayGame({
      playerCount: 5,
      seed: 32013,
      policies: Array.from({ length: 5 }, () => TACTICAL_V14),
      comparePolicies: [TACTICAL_V18, TACTICAL_V19],
    });
    const evaluated = result.disagreements.find((entry) =>
      entry.counterfactual?.metric === "full-information-secret-order-branch"
    );

    expect(evaluated?.counterfactual?.utilities.every(Number.isFinite)).toBe(true);
    expect(evaluated?.counterfactual?.preferredPolicy).toMatch(/^(tactical-v18|tactical-v19|tie)$/);
  });

  it("scores incoming 试探 counter-versus-pass disagreements through the end of the game", () => {
    const result = runSelfPlayGame({
      playerCount: 5,
      seed: 61569,
      policies: Array.from({ length: 5 }, () => TACTICAL_V19),
      comparePolicies: [CANDIDATE_V43, CANDIDATE_V44],
    });
    const evaluated = result.disagreements.find((entry) =>
      entry.counterfactual?.metric === "full-information-probe-counter-branch"
    );

    expect(evaluated?.counterfactual?.utilities.every(Number.isFinite)).toBe(true);
    expect(evaluated?.counterfactual?.preferredPolicy).toMatch(/^(candidate-v43|candidate-v44|tie)$/);
  });

  it("scores post-转移 截获-versus-pass disagreements through the end of the game", () => {
    const result = runSelfPlayGame({
      playerCount: 5,
      seed: 110099,
      policies: Array.from({ length: 5 }, () => TACTICAL_V20),
      comparePolicies: [TACTICAL_V20, CANDIDATE_V57],
    });
    const evaluated = result.disagreements.find((entry) =>
      entry.counterfactual?.metric === "full-information-intercept-branch"
    );

    expect(evaluated?.counterfactual?.utilities.every(Number.isFinite)).toBe(true);
    expect(evaluated?.counterfactual?.preferredPolicy).toMatch(/^(tactical-v20|candidate-v57|tie)$/);
  });
});
