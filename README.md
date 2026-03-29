# HashCinema

HashCinema is a **multichain memecoin video generator**.

You submit one token mint or contract address, optionally add a short creative note, and HashCinema generates:

1. A playable AI video
2. A token-specific PDF trading card

It is no longer a wallet recap product on the homepage. The product is now **token-first**.

## What It Supports

- Solana memecoins, including Pump metadata when available
- Ethereum memecoins
- BNB Chain memecoins
- Base memecoins
- Manual SOL checkout
- x402 / USDC checkout for agent flows

## Product Shape

- Input: one token address
- Output: one memecoin-specific short video
- Optional: one short creative prompt to steer tone/style
- Interface: Tianezha-inspired shell with a Hyperflow Assembly adapter-box feel
- Service surface: embeddable JSON manifest at `GET /api/service`

## Pricing

- `1d`: 30 seconds, `0.01 SOL`, `$1 USDC`
- `2d`: 60 seconds, `0.02 SOL`, `$2 USDC`

There is no 90-second package in the active product flow.

## Core Routes

- `POST /api/jobs`
- `GET /api/jobs/[jobId]`
- `GET /api/report/[jobId]`
- `GET /api/video/[jobId]`
- `POST /api/x402/video`
- `GET /api/service`

## Request Shapes

### Manual SOL checkout

`POST /api/jobs`

```json
{
  "tokenAddress": "TOKEN_MINT_OR_CONTRACT",
  "chain": "auto",
  "packageType": "1d",
  "stylePreset": "hyperflow_assembly",
  "requestedPrompt": "make it feel like a premium token launch trailer"
}
```

`chain` can be:

- `auto`
- `solana`
- `ethereum`
- `bsc`
- `base`

### x402 / USDC checkout

`POST /api/x402/video`

```json
{
  "tokenAddress": "TOKEN_MINT_OR_CONTRACT",
  "chain": "auto",
  "packageType": "2d",
  "stylePreset": "trading_card",
  "requestedPrompt": "clean premium card animation"
}
```

Or:

```json
{
  "tokenAddress": "TOKEN_MINT_OR_CONTRACT",
  "chain": "auto",
  "durationSeconds": 60,
  "stylePreset": "hyperflow_assembly"
}
```

Behavior:

- No `payment-signature` header: returns `402 Payment Required`
- Valid x402 settlement: creates a paid job and dispatches rendering immediately

## Architecture

- Web app: Next.js App Router
- Worker: `workers/server.ts`
- Video service: `video-service/src/server.ts`
- Data: Firestore
- Asset storage: Firebase Storage
- Solana payments: dedicated per-job deposit addresses
- Token discovery:
  - Solana: Pump metadata + DexScreener context
  - EVM: DexScreener context across Ethereum, BNB Chain, and Base

## Service Manifest

Use `GET /api/service` when you want to plug HashCinema into another interface or agent shell.

The manifest exposes:

- supported chains
- active packages
- style presets
- manual checkout endpoint
- x402 endpoint
- status route template

## Environment Variables

### Required

```bash
HELIUS_API_KEY=
SOLANA_RPC_URL=
OPENROUTER_API_KEY=
VIDEO_API_KEY=
FIREBASE_PROJECT_ID=
HASHCINEMA_PAYMENT_WALLET=
PAYMENT_MASTER_SEED_HEX=
```

### Common optional

```bash
APP_BASE_URL=http://localhost:3000
SOLANA_RPC_FALLBACK_URL=https://api.mainnet-beta.solana.com
FIREBASE_STORAGE_BUCKET=
WORKER_URL=
WORKER_TOKEN=
ALLOW_IN_PROCESS_WORKER=true
JOB_DISPATCH_BATCH_LIMIT=25
JOB_PROCESSING_STALE_MS=120000
PAYMENT_DERIVATION_PREFIX=hashcinema-job
HELIUS_WEBHOOK_ID=
HELIUS_WEBHOOK_SECRET=
SWEEP_MIN_LAMPORTS=5000
SWEEP_BATCH_LIMIT=50
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_NAME=HashCinema
OPENROUTER_SITE_URL=
VIDEO_API_BASE_URL=
VIDEO_ENGINE=google_veo
VIDEO_VEO_MODEL=veo-3.1-fast-generate-001
VIDEO_RESOLUTION=1080p
VIDEO_RENDER_POLL_INTERVAL_MS=5000
VIDEO_RENDER_MAX_POLL_ATTEMPTS=2160
X402_FACILITATOR_URL=https://x402.dexter.cash
GOONBOOK_API_BASE_URL=
GOONBOOK_AGENT_API_KEY=
GOONBOOK_AGENT_HANDLE=hasmedia
GOONBOOK_AGENT_DISPLAY_NAME=HASMEDIA
GOONBOOK_AGENT_BIO=HashCinema drops memecoin video cards and posts them to GoonBook.
GOONBOOK_SYNC_BATCH_LIMIT=12
ANALYTICS_ENGINE_MODE=v2_fallback_legacy
```

## Local Development

```bash
npm install
npm run dev
```

Video service:

```bash
npm run video:dev
```

Checks:

```bash
npm run lint
npm run build
npm test
```

## Repo Skill

Repo-local skills:

- `skills/hasmedia/SKILL.md`
- `skills/tianezha-worldbuilder/SKILL.md`
- `skills/poly-manifold/SKILL.md`
- `skills/awesome-physics-cognition-video-generation/SKILL.md`
- `skills/newtongen/SKILL.md`

Use them when an agent needs to:

- create a paid memecoin video over x402
- poll job/report/video URLs
- publish finished drops to GoonBook
- resolve source-media context and keep source-linked renders silent until mux time
- work from the physics-cognition and NewtonGen knowledge base
