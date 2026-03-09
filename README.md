# HASHCINEMA

HASHCINEMA generates:
- 1 cinematic recap video
- 1 combined Pump memecoin report (PDF)

Payments are crypto-native and wallet-based:
- one platform wallet
- memo = `jobId`
- Helius webhook auto-detection

No deposit wallet generation.

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
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
HASHCINEMA_PAYMENT_WALLET=
```

Optional:

```bash
APP_BASE_URL=http://localhost:3000
SOLANA_RPC_FALLBACK_URL=https://api.mainnet-beta.solana.com
FIREBASE_STORAGE_BUCKET=
WORKER_URL=
WORKER_TOKEN=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_NAME=HASHCINEMA
OPENROUTER_SITE_URL=
VIDEO_API_BASE_URL=
ANALYTICS_ENGINE_MODE=v2_fallback_legacy
```

## API

- `POST /api/jobs`
  - creates job
  - returns `jobId`, `priceSol`, `paymentWallet`, `memo`, `solanaPayUrl`
- `GET /api/jobs/[jobId]`
  - returns `status`, `progress`, job/report/video payload
- `POST /api/helius-webhook`
  - parses tx, destination, amount, memo
  - validates memo->job and amount >= `priceSol`
  - idempotently confirms payment and starts worker
- `GET /api/report/[jobId]`
- `GET /api/video/[jobId]`

## Payment Flow

1. User creates job
2. UI shows platform wallet + memo (`jobId`) + Solana Pay QR
3. User sends SOL to platform wallet with memo
4. Helius webhook hits `/api/helius-webhook`
5. Backend verifies:
   - destination is platform wallet
   - amount >= required price
   - memo maps to valid job
   - signature is confirmed
6. Job transitions to `payment_confirmed`
7. Worker pipeline starts and status becomes `processing`
8. Job finishes at `complete`

## Worker Pipeline

1. fetch wallet transactions
2. filter Pump memecoin activity
3. compute analytics
4. generate report + personalization
5. generate cinematic script + video
6. upload assets
7. mark complete

## Local Development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```
