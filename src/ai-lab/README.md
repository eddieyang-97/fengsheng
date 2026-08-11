# AI lab

Offline bot evaluation lives here so tournaments and analysis are not part of
the production server runtime.

- `benchmark.ts`: deterministic self-play, paired policy tournaments, and
  final pre-reveal belief-calibration metrics
- `benchmark-cli.ts`: command-line entry point used by `npm run ai:benchmark`
- `decrypt-rejection-sweep-cli.ts`: empirical calibration and policy sweep for
  the 破译→拒绝 假情报 posterior
- `campaign.ts` / `campaign-cli.ts`: chunked, resumable A/B campaigns with
  faction, seat, and belief-calibration breakdowns
- `benchmark.test.ts`: determinism, pairing, and non-interference checks
- `policies.ts`: evaluation-only candidate policy configurations

The live server bot remains under `src/server/bot/`. `LIVE_BOT_POLICY` pins
production to `tactical-v14`. Its `tactical-v5` base contains acceptance-aware
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

V11 promotes candidate-v30's final-receipt 掉包 scoring. It compares the full
replacement receipt against accepting or declining the current intelligence,
so a locked bot no longer spends 掉包 to replace one black intelligence with
another, and an unlocked bot preserves 掉包 when declining already avoids the
same bad receipt. Three 100-pair five-player evaluations were neutral: mixed
seats -0.2 percentage points, focal seat 0.0, and population -0.2, with no
stalls, command-limit failures, or rejected commands. Direct diagnostics found
that most changed decisions preserved 掉包 by declining or accepting instead.
The change is promoted as a narrow dominance correction. `tactical-v10`
remains the immediate rollback policy.

V12 promotes candidate-v38's faction-threat targeting for 危险情报. A team bot
normally pressures the opposing team before a quiet 特工; a 特工 normally
pressures the larger faction. Visible near-win progress overrides faction size,
including a five-intelligence 特工 or a faction player with two matching
colors. Scores are normalized across the legal targets for the same physical
card, so the feature changes only the target and never whether 危险情报 is
played. Development results were focal +1.0 percentage point, mixed +1.0, and
population +0.2. Reserved-seed validation scored focal +0.5, mixed +0.1, and
population -0.1 (one win in 1,000 entries), with no stalls, command-limit
failures, or rejected commands. The narrow target-ordering behavior is promoted
as the requested strategic policy; `tactical-v11` is the rollback policy.
V12 also preserves 秘密下达 when the active target has at most one hand card,
where color control cannot justify spending the function card.

V13 treats an intentional 公开文本 exchange as hostile by default for both
target selection and faction inference. The sole cooperative pattern is a red
or blue 公开文本 matching the user's faction, handed to the immediately
upstream living player who can transmit it back on their next turn. Older
versioned policies retain their original heuristic; `tactical-v12` is the
rollback policy.

V14 gives a 特工 with at least four true intelligence a strong priority to
receive any nonlethal visible or hidden intelligence. A materially stronger
concrete outcome, such as forcing a known 假情报 onto another player for a kill,
can still override receipt; `tactical-v13` is the rollback policy.

V15 is evaluation-only. It estimates how each player perceives the bot's
identity using only public evidence and a marginal over that observer's likely
private faction. A hidden 直达 sent to the bot is treated as more likely to be
假情报 when the sender probably perceives the bot as a different faction, and
less likely when the sender probably perceives the bot as an ally. A hidden
密电 sent directly after that sender gave the bot a +1 试探 outcome is likewise
treated as likelier 真情报; the signal is weakened for a two-card pre-send hand,
ignored when the transmitted card was their only option, and superseded by a
known 秘密下达 color constraint.

V16 is evaluation-only. When a real red or blue 直达 is accepted by C after A
has publicly revealed or strongly signaled the matching faction, it treats B's
choice to send that color away from A as evidence that B differs from A. It
also records that B likely perceives C as an ally. The signal is ignored when
B had no card choice or 秘密下达 forced the color, and weakened when B had only
one alternative card.

V17 is evaluation-only. A deliberate counterclockwise 密电 toward the bot from
any player already inferred to have high affinity toward it is treated as more
likely true, with weaker confidence when the sender had limited card choice. It
also adds further shared-faction and perceived-alliance evidence. A +1 试探 is
one way to establish that affinity, but is not required. This applies only when
clockwise would have reached a different living player, so two-player and
equivalent collapsed routes add no signal.

V18 is evaluation-only. When a high-confidence ally already has more matching
real intelligence than the bot and at most one black intelligence, matching
real intelligence receives an extra concentration bonus toward that ally. The
same preference applies when starting a transmission, declining onward, or
redirecting with 转移/离间, so the faction pursues its closest credible win
rather than spreading progress evenly across teammates.

V19 is the live production policy. 秘密下达 receives an additional preservation cost when
the target already has high inferred affinity toward the bot, because that
player's ordinary transmission pattern should already favor the bot and the
order adds little new identity signaling. The cost is proportional to affinity,
so a sufficiently decisive tactical order can still override it.

The disagreement evaluator now plays both 秘密下达 branches through game end
with identical downstream policies and randomness. An initial strong affinity
penalty changed 13 decisions in 300 games on seeds 32001-32300, but the branch
audit favored using the order twice, preserving it once, and tied ten times;
one skipped order flipped a win into a loss. Reducing the penalty to a modest
reluctance changed only five marginal orders on the same seeds, and all five
full-game branches tied. A final 500-pair mixed-seat run on seeds 33501-34000
was exactly neutral: both policies won 927/2500 entries with identical faction
and seat results. All games completed without stalls, command limits, or
rejected commands.

The frozen V19 policy then passed validation against production V14. On seeds
40001-41000 it gained +2.00 percentage points in 1000 focal-seat pairs (95%
interval -0.40 to +4.40) and +3.74 points in 1000 mixed-seat pairs (95%
interval +1.95 to +5.53). The untouched holdout on seeds 50001-51000 confirmed
both modes: +4.50 points focal-seat (95% interval +1.94 to +7.06) and +5.64
points mixed-seat (95% interval +3.86 to +7.42). Holdout gains covered both
team factions, 特工, and every seat in mixed play; calibration also improved.
All 8000 validation and holdout games completed without stalls, command limits,
or rejected commands, satisfying the promotion gate for V19.

The decrypt-rejection sweep makes the previously fixed 0.70 posterior
configurable per evaluation policy. It also records the actual hidden card at
the command boundary whenever a player completes 破译 and immediately rejects.
Across 300 five-player development games (seeds 30001-30300), 262 of 264 such
cards were 假情报: 99.24%, Wilson 95% interval [97.28%, 99.79%]. A 0.99
candidate changed 12 decisions across 100 development games, but 100-pair
focal-seat, mixed-seat, and population comparisons were all exactly neutral in
wins. The live value therefore remains 0.70 for now: 0.99 is much better
empirically calibrated, but its sparse decision changes have not demonstrated
gameplay value or harm. Run the audit or full sweep with:

```powershell
npm run ai:decrypt-sweep -- 5 300 30001 audit
npm run ai:decrypt-sweep -- 5 100 30001 0.4,0.55,0.7,0.85,0.99
```

The known-black receipt sweep isolates the extra cost assigned when a 特工 can
freely accept or reject visible 假情报. The current score values the first black
at +1 overall, so penalties 0-1 retain acceptance, penalties 2-61 reject the
ordinary first black while preserving the four-true-intelligence endgame
priority, and penalties 62+ reject in both situations. In a 200-pair
five-player comparison (seeds 43001-43200), penalty 2 was +1.0 percentage point
in focal-seat play (95% CI [-1.4, 3.4]), +1.5 in mixed seats ([-1.02, 4.02]),
and -0.9 in population play ([-1.79, -0.01]). It improved 特工 results but did
not qualify as a global production upgrade, so the live penalty remains zero.
Run a fresh sweep with:

```powershell
npm run ai:agent-black-sweep -- 5 200 43001 0,2,64 200
```

V9 remains evaluation-only. It adds
假情报-only 直达 faction evidence and strong opposing-faction evidence when a
knowingly lethal 锁定 resolves without 掉包 or 离间 changing responsibility.
危险情报 discard selection reads the privately inspected target hand and uses
conservative color denial, favoring enemy faction colors such as 红 cards for a
军情 bot while preserving useful cards when the target is likely an ally.
The independent 500-pair result did not establish an improvement over V8, so
these changes are not part of the production policy.

The selectable policy registry retains tactical versions for rollback and only
the active experimental candidates v14-v17, v19-v33, and v40-v50. Historical candidates
v3-v13 were retired after their results were recorded below; their
implementations remain available through Git history.

Candidates v40-v42 add private, alternative-aware faction inference for a bot
targeted by 危险情报. Because the target knows its own complete pre-discard hand,
it ranks the selected card by its value to the target: deliberately removing
the most valuable option is opposing evidence, while sparing it and removing
the least valuable option is allied evidence. Automatic one-card discards,
redirected actions, equal-value choices, and observations by players who did
not know the inspected hand produce no signal. V40, v41, and v42 use maximum
evidence weights 0.8, 0.4, and 0.2 respectively.

Weight 0.4 was best on the 100-pair development sample (seeds 47001-47100):
focal +1.0 percentage point, mixed +1.8, population +0.2, with improved Brier
calibration. A frozen 200-pair validation (seeds 48001-48200) did not reproduce
the gameplay gain: focal -0.5, mixed 0.0, population -0.1, all inconclusive.
The feature therefore remains evaluation-only and tactical-v19 remains live.

`candidate-v31` replaces 公开文本 离间's target-affinity shortcut with an
exchange model. The resolving function card is already public and is included
in every player projection. When the bot is the proposed target, the candidate
uses its exact remaining hand after spending 离间; for other players it uses a
conservative unknown-hand estimate. It values the card received by the target,
the random card lost, and the value delivered to the original source. In 200
five-player development games it disagreed with tactical-v11 only twice: once
to preserve a favorable allied exchange, and once to redirect an opponent's
公开文本 to itself when its exact hand made that favorable. Three preliminary
100-pair runs were neutral (focal seat 0.0 percentage points, mixed seats -0.2,
population 0.0) with no stalls, command-limit failures, or rejected commands.
It remains evaluation-only because the decision is too rare for those aggregate
results to justify promotion by themselves.

`candidate-v32` replaces the assumption that every incoming 试探 is harmful
with an information-safe hidden-variant expectation. During the reaction window
the responder does not receive the face-down physical card or whether it is an
identity or draw/discard variant. The candidate instead starts from the public
nine-card composition, removes only probes it legitimately knows from its own
hand or its own earlier plays, values its cheapest possible discard, and uses
the inferred affinity of the prober when comparing identity announcement with
random card transfer. In 200 five-player development games it disagreed with
tactical-v11 eleven times, always preserving 识破 by passing. Preliminary
100-pair focal-seat, mixed-seat, and population runs were all exactly neutral
in wins, with no stalls, command-limit failures, or rejected commands. It
remains evaluation-only pending more targeted evidence about those rare passes.

Candidates v43-v46 isolate incoming hidden 试探 treatment on top of live V19.
V43 uses candidate-v32's public hidden-variant expectation without an additional
intent adjustment. V44-v46 add source-faction affinity weights of 4, 8, and 12:
likely allies are progressively less likely to be countered, while likely
opponents are progressively more likely to be countered. In 500 games against
V43, V44 changed 11 incoming-probe decisions; full-game branch continuations
favored V44 three times, V43 twice, and tied six times. Larger weights produced
no additional decisive branch wins. Paired 500-seed focal and mixed evaluations
against V19 were exactly neutral, while a 500-seed population evaluation gave
V44 945/2500 seat-wins versus V19's 944/2500 (difference +0.04 percentage
points, 95% CI [-0.04, +0.12]) with zero stalls or rejections. Production
therefore remains V19: V44 is the preferred experiment, but its aggregate gain
is not established.

Candidates v47-v50 correct the stronger practical concern that even a hostile
试探 usually costs less than spending a scarce 识破. They retain V43's hidden
variant expectation, remove the extra source-affinity multiplier, and assign
explicit incoming-probe counter costs of 4, 8, 12, and 16. Across 500 fixed-seed
disagreement games against V43, V47's saved counters won seven full-game branches
and lost two; V48 won ten and lost three. V49-v50 changed four more decisions but
added no decisive wins, making V48 the preferred conservative threshold. Against
live V19 over separate 500-pair evaluations, V48 was -0.20 percentage points in
focal-seat mode, +0.16 in mixed-seats, and exactly neutral in population mode;
all intervals were inconclusive and all 3,000 games completed without stalls or
rejections. V48 remains evaluation-only pending stronger aggregate evidence.

`candidate-v33` extends candidate-v32 through the resolved identity-probe
choice. Instead of using hand count, it compares the inferred cost of revealing
its faction to the prober with the exact expected value of transferring a
random card from its current hand. Deterministic scenarios cover both useful
directions: announce to a likely ally rather than donating a card, and give a
low-value card to an opponent when concealing identity is worth more. A
500-game diagnostic run on the live-policy trajectory produced no natural
choice disagreements because tactical-v11 usually counters 试探 before this
branch. Three 100-pair comparisons of candidate-v33 against candidate-v32 were
exactly neutral in focal-seat, mixed-seat, and population modes, with no stalls,
command-limit failures, or rejected commands. V33 remains evaluation-only.

`candidate-v34` scores 截获 as an incremental choice: the forced receipt by the
interceptor is compared with the expected value of leaving the intelligence
with its current recipient. A voluntary recipient is assumed to decline when
the intelligence is unfavorable to them, while 锁定, 转移 commitment, and other
forced receipts are valued as committed outcomes. Deterministic scenarios
cover both directions: preserving 截获 when a committed ally would benefit, and
intercepting to deny a useful receipt to a known opponent even when the card is
neutral for the bot. In 200 development games it changed 99 decisions, mostly
adding interceptions (83) but also preserving the card (11). Preliminary
100-pair results were focal seat -2.0 percentage points, mixed seats +1.4, and
population 0.0, with no stalls, command-limit failures, or rejected commands.
Because the focal bot regressed and the policy greatly increased 截获 use, V34
remains evaluation-only and is not suitable for production promotion as-is.

`candidate-v35` retains V34's displaced-receipt comparison but charges 60% of
the physical 截获 card's transmission value as an opportunity cost. This both
preserves useful cards and prefers a less valuable 截获 when several are legal.
Against V34, a 200-game diagnostic changed 21 decisions: 11 passes, seven
switches to 调虎离山, and three cheaper-card selections. Initial development
results against tactical-v11 were focal seat 0.0 percentage points, mixed seats
+0.6, and population +0.6. A larger late-development sample scored focal -0.6,
mixed +0.64, and population +0.32. Proper validation on reserved seeds scored
focal +0.5, mixed -0.4, and population 0.0; population belief calibration also
worsened. Every run completed without stalls, command-limit failures, or
rejected commands. A 200-game live-policy audit found 96 changed decisions,
including 76 new interceptions. V34 and V35 are retired from the selectable
registry because the broad behavioral change failed the non-regression gate.
The one-time holdout range remains unused.

`candidate-v36` tested the recorded 转移 hypothesis by scoring the forced
target receipt as an absolute outcome with an explicit card cost, allowing the
normal action chooser to compare it directly with free 接受情报 and 不接受
actions. A 200-game diagnostic changed 63 decisions, all preserving 转移: 60
accepted and three declined instead. Despite that clean scope, development
regressed: focal seat -1.0 percentage point, mixed seats -2.4 (with the 95%
confidence interval favoring tactical-v11), and population 0.0. This suggests
转移 has useful risk-control or commitment value when hidden intelligence has
near-zero mean utility. V36 was retired before validation; simply adding a
generic card cost is not an adequate model of that option value.

Candidates v37-v39 developed faction-level offensive targeting. V37 applied
the model to both 危险情报 and draw/discard 试探; development was focal 0.0,
mixed -1.0, and population 0.0. Isolation showed that v38's 危险情报-only rule
was non-negative in development and essentially neutral in validation, so it
was promoted as tactical-v12. V39's 试探-only rule regressed to focal -1.0 and
mixed -0.2 in development. The 试探 extension is retired because its
faction-dependent draw/discard effect needs card-specific reasoning rather than
a generic threat preference.

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
