# AI lab

Offline bot evaluation lives here so tournaments and analysis are not part of
the production server runtime.

- `benchmark.ts`: deterministic self-play and paired policy tournaments
- `benchmark-cli.ts`: command-line entry point used by `npm run ai:benchmark`
- `campaign.ts` / `campaign-cli.ts`: chunked, resumable A/B campaigns with
  faction and seat breakdowns
- `benchmark.test.ts`: determinism, pairing, and non-interference checks
- `policies.ts`: evaluation-only candidate policy configurations

The live server bot remains under `src/server/bot/`. `LIVE_BOT_POLICY` pins
production to `tactical-v4`. It scores 调虎离山 by the change from the current
recipient to the forced next recipient, and first checks whether the current
recipient is likely to accept; if they would reject voluntarily, the bot saves
the card. Historical and candidate policies remain available for explicit
evaluation and rollback. `candidate-v8` is the earlier incremental 调虎离山
experiment without the voluntary-rejection check. `candidate-v7` remains
available as the earlier incremental 转移 experiment.

Initial five-player paired run (100 pairs, seeds 1-100): candidate-v8 37.2%
versus tactical-v3 35.4%, paired difference +1.8 percentage points with a 95%
confidence interval of [-3.2, +6.8]. The result was inconclusive and did not
justify promoting candidate-v8 by itself; tactical-v4 adds the deterministic
voluntary-rejection safeguard.

For a large five-player comparison, save an atomic checkpoint after each chunk:

```powershell
npm run ai:campaign -- 5 5000 1 --candidate candidate-v8 --baseline tactical-v3 --chunk-size 100 --checkpoint .ai-results/v8-v3.json
```

If the process stops, repeat the command with `--resume`. A checkpoint is only
accepted when player count, policies, target pairs, and seed range all match.
