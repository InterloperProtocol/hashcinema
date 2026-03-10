# HASHCINEMA Codebase Review (March 10, 2026)

## What Was Fixed

1. **Webhook trust boundary hardened**
- Added shared-secret verification (`HELIUS_WEBHOOK_SECRET`) before processing webhook payloads.
- Webhook now verifies payment destination, memo, and lamports from on-chain RPC transaction data.

2. **Cumulative payment settlement**
- Added atomic cumulative settlement fields on jobs:
  - `requiredLamports`
  - `receivedLamports`
  - `paymentSignatures`
  - `lastPaymentAt`
- Partial payments now keep the job payable until threshold is met.
- Duplicate signatures are ignored idempotently.

3. **Manual non-QR payment UX**
- Added reusable `PaymentInstructionsCard` used on both `/` and `/job/[jobId]`.
- Supports copy wallet, amount, memo, and full payload for copy/paste send flows.
- Shows required/received/remaining SOL.

4. **Dedicated Fastify `/render` backend scaffold**
- Added `video-service` app with:
  - `POST /render`
  - `GET /render/:id`
  - `GET /render/status/:id`
- Implements idempotency by `jobId`, bearer auth, Veo contract validation, real Vertex Veo adapter, scene chunking, ffmpeg concat, and signed asset URLs.

5. **Lint hygiene**
- Removed existing unused-variable warnings in:
  - `lib/analytics/legacy-adapter.ts`
  - `lib/jobs/trigger.ts`

## Remaining Risks / Operational Notes

1. **Video pipeline dependencies**
- `video-service` requires `ffmpeg` on the runtime host (`FFMPEG_PATH`).
- Vertex Veo response shapes may evolve; adapter includes defensive URI extraction but should be monitored with provider contract tests in CI.

2. **Webhook auth rollout**
- If `HELIUS_WEBHOOK_SECRET` is not configured, webhook endpoint returns a server error to avoid accepting unauthenticated requests.

3. **Dependency audit (production)**
- `npm audit --omit=dev` reports **8 low-severity** findings in the Firebase/Google Cloud dependency tree.
- Recommended strategy:
  - Track Firebase Admin and Google Cloud SDK updates monthly.
  - Patch in-place when non-breaking fixes land.
  - Avoid forced downgrade/major rollback solely to suppress low findings.

## Verification Checklist

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run video:build`
- `npm run video:start` (with video-service env configured)
