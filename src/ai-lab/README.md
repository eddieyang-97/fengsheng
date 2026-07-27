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
production to `tactical-v5`. It retains `tactical-v4`'s acceptance-aware
调虎离山 scoring and adds the symmetric rule for 锁定: if the current recipient
is already likely to accept voluntarily, the bot saves 锁定 instead of spending
it to guarantee the same outcome. It still uses 锁定 to force an intelligence
the recipient is likely to reject.

Historical and candidate policies remain available for explicit evaluation and
rollback. `candidate-v8` is the earlier incremental 调虎离山 experiment without
the voluntary-rejection check. `candidate-v7` remains available as the earlier
incremental 转移 experiment. `candidate-v9` combines `tactical-v4` with
incremental 转移 scoring. `candidate-v10` layers that 转移 experiment over live
`tactical-v5`. `candidate-v11` adds weak faction evidence when a completed,
non-redirected function action measurably helps or harms the bot's own hand. It
ignores self-actions, neutral outcomes, and all such inference for 特工. It is
the default evaluation candidate but is not live.

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
