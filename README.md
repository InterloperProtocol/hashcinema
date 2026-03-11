# HASHCINEMA

HASHCINEMA generates:
- 1 cinematic recap video
- 1 combined Pump memecoin report (PDF)

Payments are crypto-native and wallet-based:
- one dedicated payment address per job
- no memo required
- Helius webhook auto-detection
- durable worker dispatch retries (outbox-backed)

Dedicated deposit addresses are deterministically derived from `PAYMENT_MASTER_SEED_HEX`.

## Stack

- Next.js App Router + TypeScript + TailwindCSS
- Firebase App Hosting + Firestore + Firebase Storage
- Solana Web3.js + Helius API/Webhooks
- OpenRouter (`mistralai/mistral-small`)
- External video generation API
- Cloud Run worker (`workers/server.ts`)

## Pricing

- `1d`: `0.02 SOL` + 30s video
- `2d`: `0.03 SOL` + 60s video
- `3d`: `0.04 SOL` + 90s video

## Job State

- `awaiting_payment`
- `payment_detected`
- `payment_confirmed`
- `processing`
- `complete`
- `failed`

## Environment Variables

Required:

```bash
HELIUS_API_KEY=
SOLANA_RPC_URL=
OPENROUTER_API_KEY=
VIDEO_API_KEY=
HELIUS_WEBHOOK_SECRET=
FIREBASE_PROJECT_ID=
HASHCINEMA_PAYMENT_WALLET=
PAYMENT_MASTER_SEED_HEX=
```

`HASHCINEMA_PAYMENT_WALLET` is the revenue sweep destination wallet.

`FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` are optional when running on
Google Cloud with Application Default Credentials (Cloud Run service account).

Optional:

```bash
APP_BASE_URL=http://localhost:3000
SOLANA_RPC_FALLBACK_URL=https://api.mainnet-beta.solana.com
FIREBASE_STORAGE_BUCKET=
WORKER_URL=
WORKER_TOKEN=
ALLOW_IN_PROCESS_WORKER=true
JOB_DISPATCH_BATCH_LIMIT=25
WORKER_MAX_BODY_BYTES=32768
PAYMENT_DERIVATION_PREFIX=hashcinema-job
HELIUS_WEBHOOK_ID=
SWEEP_MIN_LAMPORTS=5000
SWEEP_BATCH_LIMIT=50
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_NAME=HASHCINEMA
OPENROUTER_SITE_URL=
VIDEO_API_BASE_URL=
VIDEO_ENGINE=generic
VIDEO_VEO_MODEL=veo-3
VIDEO_RENDER_POLL_INTERVAL_MS=5000
VIDEO_RENDER_MAX_POLL_ATTEMPTS=2160
ANALYTICS_ENGINE_MODE=v2_fallback_legacy
```

Video-service specific (`video-service/.env.example`):

```bash
PORT=8090
VIDEO_API_KEY=
VIDEO_SERVICE_BASE_URL=http://localhost:8090
VERTEX_PROJECT_ID=
VERTEX_LOCATION=us-central1
VERTEX_VEO_MODEL=veo-3
VEO_MAX_CLIP_SECONDS=8
VERTEX_POLL_INTERVAL_MS=5000
VERTEX_MAX_POLL_ATTEMPTS=180
RENDER_RECOVERY_INTERVAL_MS=30000
RENDER_STALE_MS=1200000
RENDER_RECOVERY_BATCH_LIMIT=20
FFMPEG_PATH=ffmpeg
```

## API

- `POST /api/jobs`
  - creates job
  - auto-subscribes the new dedicated payment address to Helius webhook monitoring
  - returns `jobId`, `priceSol`, `paymentAddress`, `amountSol`
- `GET /api/jobs/[jobId]`
  - returns `status`, `progress`, job/report/video payload + payment instructions (`paymentAddress`, `amountSol`, `remainingSol`)
- `POST /api/helius-webhook`
  - parses tx and destination transfers
  - validates webhook shared secret
  - verifies amount/destination from on-chain RPC data (not webhook body)
  - cumulatively settles partial payments by destination address until required amount is met
  - asynchronously triggers instant worker sweep for the paid job on every non-duplicate transfer
  - idempotently confirms payment and starts worker
- `GET /api/report/[jobId]`
- `GET /api/video/[jobId]`

Video backend contract reference:
- `docs/render-veo-contract.md`

## Payment Flow

1. User creates job
   - backend ensures the dedicated payment address is added to Helius webhook account addresses
2. UI shows dedicated payment address + amount + copy/paste payload + scannable address QR
3. User sends SOL to the dedicated address (manual send or scan)
4. Helius webhook hits `/api/helius-webhook`
5. Backend verifies:
   - webhook secret is valid
   - destination maps to a valid job payment address (on-chain)
   - signature is confirmed
   - payment may be cumulative across multiple signatures
6. Job transitions to `payment_confirmed` and enqueues durable dispatch
7. Worker dispatch is retried until accepted, then status becomes `processing`
8. Job finishes at `complete`
9. Each accepted transfer triggers non-blocking instant sweep attempt to revenue wallet
10. Scheduler-based sweep remains as fallback durability

## Worker Pipeline

1. fetch wallet transactions
2. filter Pump memecoin activity
3. compute analytics
4. generate report + personalization
5. generate cinematic script + video
6. upload assets
7. mark complete
8. worker `/dispatch` retries pending processing dispatches
9. worker `/sweep` can be triggered by Cloud Scheduler to sweep dedicated payment addresses to revenue wallet
10. worker `/sweep` accepts optional `{ "jobId": "<job-id>" }` to sweep one job immediately

## Local Development

```bash
npm install
npm run dev
```

Video-service (`/render`) local run:

```bash
npm run video:build
npm run video:start
# or
npm run video:dev
```

Quality checks:

```bash
npm run lint
npm run build
```

## Cloud Run Worker/Video Services (No App Hosting Deploy)

This repo now includes Cloud Build configs and Dockerfiles for both backend workloads:

- `video-service/Dockerfile`
- `workers/Dockerfile`
- `cloudbuild/video-service.yaml`
- `cloudbuild/worker.yaml`

Example image builds:

```bash
gcloud builds submit --project hashart-fun \
  --config cloudbuild/video-service.yaml \
  --substitutions _IMAGE=us-central1-docker.pkg.dev/hashart-fun/hashart-containers/hashart-video-service:latest .

gcloud builds submit --project hashart-fun \
  --config cloudbuild/worker.yaml \
  --substitutions _IMAGE=us-central1-docker.pkg.dev/hashart-fun/hashart-containers/hashart-worker:latest .
```

Example deploys:

```bash
gcloud run deploy hashart-video-service \
  --project hashart-fun \
  --region us-central1 \
  --image us-central1-docker.pkg.dev/hashart-fun/hashart-containers/hashart-video-service:latest

gcloud run deploy hashart-worker \
  --project hashart-fun \
  --region us-central1 \
  --image us-central1-docker.pkg.dev/hashart-fun/hashart-containers/hashart-worker:latest
```

Example Cloud Scheduler job for payment sweeps:

```bash
gcloud scheduler jobs create http hashart-payment-sweep \
  --project hashart-fun \
  --location us-central1 \
  --schedule "*/5 * * * *" \
  --http-method POST \
  --uri "https://<worker-service-url>/sweep" \
  --headers "Authorization=Bearer <WORKER_TOKEN>"
```

Example Cloud Scheduler job for dispatch retries:

```bash
gcloud scheduler jobs create http hashart-job-dispatch \
  --project hashart-fun \
  --location us-central1 \
  --schedule "*/1 * * * *" \
  --http-method POST \
  --uri "https://<worker-service-url>/dispatch" \
  --headers "Authorization=Bearer <WORKER_TOKEN>"
```

Firebase App Hosting is intentionally not deployed in this flow.
