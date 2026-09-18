# Add a Render worker blueprint for generation

The previously approved GSD bypass applies. Keep secrets out of the repo. Do not set live `FEATURE_GENERATION=true` in git.

1. Add a paid Docker worker to `render.yaml` with the same generation fingerprint vars as the API.
2. Add secret slots on the API (`AI_GATEWAY_API_KEY`, pricing, capabilities). Leave `FEATURE_GENERATION=false` until the operator starts the worker and pastes keys.
3. Fill missing local pricing rates in `.env` (gitignored) so a local worker can quote.
4. Do not invent quality-calibration files. Production `generationReady` still requires those artifacts or it stays `worker_unavailable`.
