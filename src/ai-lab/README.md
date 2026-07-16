# AI lab

Offline bot evaluation lives here so tournaments and analysis are not part of
the production server runtime.

- `benchmark.ts`: deterministic self-play and paired policy tournaments
- `benchmark-cli.ts`: command-line entry point used by `npm run ai:benchmark`
- `benchmark.test.ts`: determinism, pairing, and non-interference checks
- `policies.ts`: evaluation-only candidate policy configurations

The live server bot remains under `src/server/bot/`. `LIVE_BOT_POLICY` pins
production to `tactical-v2`; candidate policies are evaluation-only until
benchmark evidence and gameplay review justify an explicit promotion.
