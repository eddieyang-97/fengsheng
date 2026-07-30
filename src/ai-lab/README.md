# AI lab

Offline bot evaluation lives here so tournaments and analysis are not part of
the production server runtime.

- `benchmark.ts`: deterministic self-play, paired policy tournaments, and
  final pre-reveal belief-calibration metrics
- `benchmark-cli.ts`: command-line entry point used by `npm run ai:benchmark`
- `campaign.ts` / `campaign-cli.ts`: chunked, resumable A/B campaigns with
  faction, seat, and belief-calibration breakdowns
- `benchmark.test.ts`: determinism, pairing, and non-interference checks
- `policies.ts`: evaluation-only candidate policy configurations

The live server bot remains under `src/server/bot/`. `LIVE_BOT_POLICY` pins
production to `tactical-v7`. Its `tactical-v5` base contains acceptance-aware
调虎离山 and 锁定 scoring: if the current outcome will happen voluntarily, the
bot preserves the function card. V6 adds scoring for 危险情报 transmission
visibility and concrete follow-up plans, and preserves 掉包 when another
accepting recipient would receive only a routine upgrade. V7 adds
confidence-adjusted conservation for targeted 公开文本, 危险情报, and 秘密下达
while leaving information-gathering 试探 and self-benefit 增援/机密文件
unpenalized. `tactical-v6` remains the immediate rollback and A/B policy.

Historical and candidate policies remain available for explicit evaluation and
rollback. `candidate-v8` is the earlier incremental 调虎离山 experiment without
the voluntary-rejection check. `candidate-v7` remains available as the earlier
incremental 转移 experiment. `candidate-v9` combines `tactical-v4` with
incremental 转移 scoring. `candidate-v10` layers that 转移 experiment over live
`tactical-v5`. `candidate-v11` adds weak faction evidence when a completed,
non-redirected function action measurably helps or harms the bot's own hand. It
ignores self-actions, neutral outcomes, and all such inference for 特工. It is
the default evaluation candidate but is not live.

`candidate-v12` isolates the method-aware 危险情报 change over `tactical-v5`.
`candidate-v13` isolates the conservative 掉包 change over `tactical-v5`.
`candidate-v14` applies passive-route acceptance modeling to card, method, and
direction selection. It changed 607 decisions in a 100-game disagreement sample
and scored 35.8% versus tactical-v6's 36.4% in 100 five-player pairs, so it was
not promoted. `candidate-v15` preserves v6's physical-card choice and applies
route modeling only within that card; it scored 37.4% versus 37.2% in the same
size sample and remained inconclusive.

`candidate-v16` is the conservative route candidate: it preserves both v6's
physical card and transmission method, using route modeling only for direction
or the target of 直达. A 500-pair five-player confirmation (seeds 4001-4500)
completed all 1,000 games without stalls or rejected commands. Candidate-v16
scored 37.12% versus tactical-v6's 37.20% (-0.08 percentage points, 95% CI
[-2.72, +2.56]). It remains evaluation-only because the result was neutral and
inconclusive.

A 100-pair five-player comparison (seeds 2001-2100) of the refined
`tactical-v6` against `tactical-v5` completed all 200 games without stalls or
rejected commands. V6 scored 37.6% versus 37.2% (+0.4 percentage points, 95% CI
[-2.8, +3.6]); the result is inconclusive. The matching two-player comparison
was 50.5% versus 49.5% (+1.0 points, 95% CI [-1.0, +3.0]), also inconclusive.
Disagreement review found and corrected two overgeneralizations before this
final run: conservative 掉包 now applies only when another player is receiving,
and a five-card 特工's near-certain acceptance is included when scoring
危险情报 as 直达.

To inspect policy disagreements with card names and receipt commitment state:

```powershell
npm run ai:benchmark -- disagreements 5 100 2001 tactical-v5 tactical-v6
```

Initial five-player paired run (100 pairs, seeds 1-100): candidate-v8 37.2%
versus tactical-v3 35.4%, paired difference +1.8 percentage points with a 95%
confidence interval of [-3.2, +6.8]. The result was inconclusive and did not
justify promoting candidate-v8 by itself; tactical-v4 adds the deterministic
voluntary-rejection safeguard.

Five-player `candidate-v9` diagnostics (100 games, seeds 1-100) found 41
disagreements with `tactical-v4`. In 35 cases, the live policy spent 转移 while
`candidate-v9` accepted the current intelligence instead. A 100-pair
swapped-seat comparison completed all 200 games without stalls or rejected
commands: candidate-v9 36.4% versus tactical-v4 36.8%, paired difference -0.4
percentage points with a 95% confidence interval of [-3.1, +2.3]. This is
inconclusive, so candidate-v9 is retained for analysis but not promoted.

The next 转移 hypothesis should compare a redirect against the best free legal
alternative, including declining to the next recipient, rather than comparing
only against leaving the intelligence with its current recipient.

For the 锁定 change, a 100-pair isolated comparison of candidate-v10 against
candidate-v9 completed all 200 games without stalls or rejected commands:
38.4% versus 35.0%, paired difference +3.4 percentage points with a 95%
confidence interval of [-1.0, +7.8]. Against the then-live tactical-v4, the
same sample was 37.8% versus 35.6% (+2.2 points, 95% CI [-2.0, +6.4]). Both
results are statistically inconclusive, but the no-op avoidance is a
deterministic dominance fix, so that rule alone was promoted as tactical-v5;
incremental 转移 was not.

Belief calibration is reported from each bot's final pre-reveal beliefs. The
multiclass Brier score measures probability quality (lower is better), while
top-choice accuracy measures whether the most likely faction is correct.

For candidate-v11, a 100-pair five-player comparison against tactical-v5
completed all 200 games without stalls or rejected commands. Candidate win rate
was 38.6% versus 36.6% (+2.0 percentage points, 95% CI [-0.8, +4.8]), which was
inconclusive. Belief calibration did not improve: Brier score was 0.1951 versus
0.1934, and top-choice accuracy was 84.45% versus 84.50%. The candidate remains
available for analysis but was not promoted because the simple action-outcome
signal is too noisy in its current form.

For a large five-player comparison, save an atomic checkpoint after each chunk:

```powershell
npm run ai:campaign -- 5 5000 1 --candidate candidate-v11 --baseline tactical-v5 --chunk-size 100 --checkpoint .ai-results/v11-v5.json
```

If the process stops, repeat the command with `--resume`. A checkpoint is only
accepted when player count, policies, target pairs, and seed range all match.
Calibration-aware checkpoints use schema version 2; older checkpoints are not
resumable.
