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
production to `tactical-v10`. Its `tactical-v5` base contains acceptance-aware
调虎离山 and 锁定 scoring: if the current outcome will happen voluntarily, the
bot preserves the function card. V6 adds scoring for 危险情报 transmission
visibility and concrete follow-up plans, and preserves 掉包 when another
accepting recipient would receive only a routine upgrade. V7 adds
confidence-adjusted conservation for targeted 公开文本, 危险情报, and 秘密下达
while leaving information-gathering 试探 and self-benefit 增援/机密文件
unpenalized. V8 scores the forced return to the sender when declining 直达,
allowing a bot to take a safe card instead of returning harmful intelligence
to an ally, or to return a winning card to an ally immediately.

V10 adds a color-first 危险情报 discard policy. It first favors cards whose
transmission color benefits a likely opponent, then uses function-card value as
a conservative tie-breaker only when the target is more likely an opponent.
This promotes candidate-v24 without including any unrelated inference changes.
`tactical-v8` remains the immediate rollback policy.

V9 remains evaluation-only. It adds
假情报-only 直达 faction evidence and strong opposing-faction evidence when a
knowingly lethal 锁定 resolves without 掉包 or 离间 changing responsibility.
危险情报 discard selection reads the privately inspected target hand and uses
conservative color denial, favoring enemy faction colors such as 红 cards for a
军情 bot while preserving useful cards when the target is likely an ally.
The independent 500-pair result did not establish an improvement over V8, so
these changes are not part of the production policy.

The selectable policy registry retains tactical versions for rollback and only
the active experimental candidates v14-v17 and v19-v29. Historical candidates
v3-v13 were retired after their results were recorded below; their
implementations remain available through Git history.

> Historical measurement notice: the original mixed-policy harness executed
> policies by stable player ID but attributed final policy labels by shuffled
> seat order. This made pre-fix candidate/baseline win rates and their faction
> and seat breakdowns unreliable. The figures below are retained as experiment
> history, not promotion evidence. Any surviving candidate must be revalidated
> with the source-bound schema-v3 harness before promotion. The narrow
> tactical-v8's forced-return behavior remains in the live tactical-v10 policy
> because it was promoted from direct decision review and deterministic tactical
> dominance rather than its aggregate paired result.

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

`candidate-v17` evaluates declining intelligence by the expected utility of
the next player's receipt instead of treating every non-terminal decline as
equivalent. A declined 直达 is a forced return to its sender; voluntary receipts
after 文本 or 密电 are acceptance-weighted. In 100 five-player pairs (seeds
7001-7100), candidate-v17 scored 37.0% versus tactical-v7's 38.0% (-1.0
percentage point, 95% CI [-2.17, +0.17]). The matching two-player run scored
51.0% versus 49.0% (+2.0 points, 95% CI [-0.76, +4.76]). Both results are
inconclusive, so the policy remains evaluation-only.

`candidate-v19` treats visible 直达 transmissions targeting the observing bot
as stronger intentional faction evidence for both 真情报 and 假情报, discounting
the signal when 秘密下达 forced the color. A 500-pair five-player run (seeds
12001-12500) scored 37.04% versus tactical-v8's 37.84% (-0.80 percentage
points, 95% CI [-2.62, +1.02]) and slightly worsened belief calibration, so it
was not promoted.

`candidate-v20` isolates the requested 假情报 signal and leaves 直达真情报
uninferred when the bot itself is the private target. An initial 100-pair run
(seeds 13001-13100) scored 38.6% versus 36.0% (+2.6 points, 95% CI
[+0.13, +5.07]). An independent 500-pair confirmation (seeds 14001-14500)
regressed toward neutral: 37.20% versus 36.84% (+0.36 points, 95% CI
[-1.03, +1.75]). Its belief calibration improved slightly (Brier 0.1936 versus
0.1950; top-choice accuracy 84.47% versus 84.31%). The narrow inference was
combined with conscious lethal-lock inference in tactical-v9; candidate-v20
remains available to isolate the transmission-only contribution.

A 100-pair five-player comparison of tactical-v9 against tactical-v8 (seeds
16001-16100) was neutral in gameplay: 38.0% versus 38.2% (-0.2 percentage
points, 95% CI [-3.12, +2.72]). Belief calibration improved in this sample:
Brier 0.1929 versus 0.2063 and top-choice accuracy 84.7% versus 82.6%. The
lethal-lock inference is intentionally restricted to an original, successfully
resolved lock whose card was not replaced and whose target was not redirected.

An independent 500-pair tactical-v9 versus tactical-v8 run (seeds 19001-19500)
scored 36.96% versus 37.80% (-0.84 percentage points, 95% CI
[-2.52, +0.84]). Candidate-v21 reduced lethal-lock evidence from 2.5 to 1.2;
100-pair isolated samples were inconclusive both against no lock inference
(+0.4 points) and the stronger live weight (-0.6 points), so it was not
promoted.

Candidate-v22 isolates broad target-value 危险情报 discard scoring, while
candidate-v23 narrows the choice to faction-color denial. Their original
results were invalidated by the historical policy-attribution bug. Corrected
100-pair development runs on seeds 30001-30100 were inconclusive:

- v22: focal-seat +2.0 points, mixed-seats -0.6, population -0.2;
- v23: focal-seat +1.0 point, mixed-seats -1.0, population -0.2.

Across 100 development games, v23 changed 60 decisions from tactical-v8 and v22
differed from v23 38 times. The behavior is common enough for aggregate
evaluation, but neither model consistently improved across evaluation modes.
V22 and v23 remain experimental. Candidate-v24 combines v23's color-first rule
with a 35% function-value tie-breaker when the target is likely an opponent. Its
corrected 100-pair development results were focal +2.0 points, mixed 0.0, and
population 0.0. Independent five-player validation was focal 0.0, mixed +4.0,
and population 0.0; matching duel validation was focal +5.0, mixed +5.0, and
population 0.0. A frozen 200-pair five-player holdout scored focal +1.0, mixed
+1.3, and population -0.4, all statistically inconclusive. Every run completed
without stalls, command limits, or rejected commands. V24 was promoted as
tactical-v10 based on deterministic improvement over random discard, positive
individual-effect results, and no tested player-count regression.

Candidate-v25 re-evaluates full-strength hostility evidence from voluntarily
sending 假情报 by 直达, isolated over tactical-v10. Candidate-v26 reduces that
intentional evidence to half strength. Both improved five-player belief
calibration but failed the corrected development gate on seeds 30001-30100:
v25 scored focal -1.0 points, mixed +1.4, and population 0.0; v26 scored focal
-1.0, mixed +1.6, and population +0.2. Because both hurt the bot actually using
the policy in the focal comparison, neither advanced to validation.

Candidate-v27 isolates moderate knowingly lethal 锁定 evidence over tactical-v10.
Its corrected development results were focal +1.0 points, mixed +2.2, and
population -0.4. Belief calibration worsened in both mixed and population runs,
showing that a causally clear hostile act does not map cleanly to the remaining
exact faction roster. V27 remains experimental and did not advance.

Candidate-v28 re-evaluates acceptance-weighted decline routing over tactical-v10.
It changed 20 receipt decisions across 100 development games. Development was
non-negative at focal 0.0 points, mixed +0.2, and population 0.0, but independent
validation regressed to focal 0.0, mixed -0.4, and population -0.2. Calibration
improved while gameplay did not. V28 was rejected; tactical-v10 continues to
model only the deterministic forced return after declining 直达. A later
full-information receipt-branch audit on 200 development games found 33 direct
accept-versus-decline disagreements. After executing both commands and resolving
the complete receipt sequence through the normal engine and bots, v28 won 18
branches, tactical-v10 won 13, and two tied. However, v28's mean gain was
-9.133 despite a +12.320 median: its fewer losses were much more expensive.
This downside pattern explains why an apparently better local routing rule
failed match validation. The next routing candidate should guard against
catastrophic branch loss rather than further maximize the one-step mean.

Candidate-v29 replaces the earlier discard formulas with the direct Bayesian
expectation of full-information card denial: for each possible target faction,
it multiplies that belief probability by the signed value of removing the card.
It beat tactical-v10 in 10 of 15 direct counterfactual disagreements (five
losses, +1.48 mean denial value), but its development match results were focal
0.0 points, mixed -0.2, and population -0.2. V29 was not promoted because local
objective improvement did not translate into match improvement.

The forced-return-only subset of candidate-v17 changed just three decisions in
a 100-game five-player disagreement sample (seeds 9001-9100). All three avoided
a weaker self-receipt or unnecessary 破译 in favor of a strategically better
forced return. A paired 100-game sample had identical aggregate outcomes because
the states were rare. The narrow rule was promoted as tactical-v8 based on the
direct tactical dominance, while the broader acceptance-weighted routing remains
evaluation-only as candidate-v17.

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
inconclusive, so candidate-v9 was not promoted and has since been retired.

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

For the retired candidate-v11, a 100-pair five-player comparison against tactical-v5
completed all 200 games without stalls or rejected commands. Candidate win rate
was 38.6% versus 36.6% (+2.0 percentage points, 95% CI [-0.8, +4.8]), which was
inconclusive. Belief calibration did not improve: Brier score was 0.1951 versus
0.1934, and top-choice accuracy was 84.45% versus 84.50%. The candidate remains
available for analysis but was not promoted because the simple action-outcome
signal is too noisy in its current form.

For a large five-player comparison, save an atomic checkpoint after each chunk:

```powershell
npm run ai:campaign -- 5 5000 1 --candidate tactical-v9 --baseline tactical-v8 --chunk-size 100 --checkpoint .ai-results/v9-v8.json
```

If the process stops, repeat the command with `--resume`. A checkpoint is only
accepted when player count, policies, evaluation mode, target pairs, seed
range, and the runtime-source fingerprint all match. The campaign also checks
the fingerprint before and after every chunk; if another task changes source
during a chunk, that chunk is discarded rather than mixed into the result.
Source-bound checkpoints use schema version 3; older checkpoints are not
resumable.

Use all three evaluation modes before promoting a candidate:

```powershell
npm run ai:campaign -- 5 1000 40001 --candidate candidate-v23 --baseline tactical-v8 --mode focal-seat --checkpoint .ai-results/v23-v8-focal.json
npm run ai:campaign -- 5 1000 40001 --candidate candidate-v23 --baseline tactical-v8 --mode mixed-seats --checkpoint .ai-results/v23-v8-mixed.json
npm run ai:campaign -- 5 1000 40001 --candidate candidate-v23 --baseline tactical-v8 --mode population --checkpoint .ai-results/v23-v8-population.json
```

`focal-seat` replaces one rotating baseline seat with the candidate and compares
that player with the same seat in an all-baseline game. All opponents remain
baseline, so this is the cleanest measurement of the candidate's individual
effect. `mixed-seats` puts both policies in each game and swaps their seats in the
matching leg. `population` runs an all-candidate game and an all-baseline game
with the same seed, seats, and factions. Confidence intervals are clustered by
the seed pair rather than treating correlated player entries as independent.

Future candidate development uses fixed, non-overlapping seed ranges (earlier
ranges were already consumed while developing v14-v24):

- development: 30001-39999, for disagreement inspection and tuning;
- validation: 40001-49999, for confirming a frozen candidate;
- holdout: 50001-59999, used once for a promotion decision.

A policy is promoted only after deterministic scenario tests pass, both
evaluation modes show no important faction or player-count regression, an
independent validation is positive, and the final holdout interval is positive
or the change is justified by a narrow rules-level dominance case. Rare
decisions should additionally report how often they trigger and be reviewed
directly; aggregate win rate alone is not sufficient.

The disagreement runner now performs metric-specific full-information
counterfactuals and reports each metric separately so unlike utility scales are
never combined. For 危险情报 discard choices, it uses the hidden actual target
faction only in the offline evaluator and scores the value denied by each
policy's selected card. On seeds 30001-30100, tactical-v10 beat tactical-v8's
random choice 62-13 with one tie and +3.448 mean denial value. The
function-value tie-breaker also beat candidate-v23's color-only policy 28-4
with +3.825 mean value. This directly supports the tactical-v10 promotion while
remaining separate from live bot information.

For direct ACCEPT_INTELLIGENCE versus DECLINE_INTELLIGENCE disagreements, the
offline evaluator clones the actual hidden server state, executes each command,
and lets the normal command dispatcher and live bots resolve the entire receipt
sequence, including reaction cards, forced returns, and 公开文本 effects. It
then compares the resulting positions with the actual hidden factions. This is
still a shallow branch rather than a full-game rollout, so it is a diagnostic
rather than a promotion gate. Counterfactual summaries include win counts,
mean, median, and range because terminal utility values can dominate the mean.
