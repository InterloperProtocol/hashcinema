# HASHCINEMA `/render` Backend Contract (Google Veo)

Last updated: March 10, 2026  
Contract version: `render.veo.v1`

## Purpose
This document defines the backend contract expected by HASHCINEMA when calling the video service `POST /render` endpoint, including Veo-specific fields. It is designed so the video service can map the request directly into Google Veo generation calls.

Client source of truth:
- `/lib/video/client.ts`
- `/lib/video/veo.ts`

## Endpoints

1. `POST /render`
- Starts a render job (or returns immediate video URL if synchronous mode is enabled).

2. `GET /render/{id}`
- Returns render status and final assets.

Optional:
3. `GET /render/status/{id}`
- Also acceptable if returned as `statusUrl` from `POST /render`.

## Authentication

`Authorization: Bearer <VIDEO_API_KEY>`

## Request Schema (`POST /render`)

```json
{
  "jobId": "string",
  "wallet": "string",
  "durationSeconds": 30,
  "withSound": true,
  "hookLine": "string",
  "scenes": [
    {
      "sceneNumber": 1,
      "visualPrompt": "string",
      "narration": "string",
      "durationSeconds": 8,
      "imageUrl": "https://...",
      "includeAudio": true
    }
  ],
  "videoEngine": "generic | google_veo",

  "provider": "google_veo",
  "prompt": "string",
  "metadata": {
    "provider": "google_veo",
    "model": "veo-3",
    "prompt": "string",
    "styleHints": ["memetic", "cinematic"],
    "tokenMetadata": [
      {
        "mint": "string",
        "symbol": "string",
        "name": "string | null",
        "imageUrl": "https://...",
        "tradeCount": 3,
        "buyCount": 2,
        "sellCount": 1,
        "solVolume": 1.234,
        "lastSeenTimestamp": 1730000000
      }
    ],
    "sceneMetadata": [
      {
        "sceneNumber": 1,
        "durationSeconds": 8,
        "narration": "string",
        "visualPrompt": "string",
        "imageUrl": "https://... | null"
      }
    ],
    "storyMetadata": {
      "wallet": "string",
      "rangeDays": 1,
      "packageType": "1d | 2d | 3d",
      "durationSeconds": 30,
      "analytics": {
        "pumpTokensTraded": 5,
        "buyCount": 20,
        "sellCount": 15,
        "solSpent": 3.2,
        "solReceived": 2.9,
        "estimatedPnlSol": -0.3,
        "bestTrade": "string",
        "worstTrade": "string",
        "styleClassification": "string"
      }
    }
  },
  "googleVeo": {
    "...": "same object as metadata"
  }
}
```

Notes:
- For `videoEngine=generic`, Veo-specific fields may be omitted.
- For `videoEngine=google_veo`, backend should treat `metadata` and `googleVeo` as equivalent payloads; `metadata` is the canonical key, `googleVeo` is compatibility mirror.

## Required vs Optional

Always required:
- `jobId`, `wallet`, `durationSeconds`, `withSound`, `hookLine`, `scenes`, `videoEngine`

Required when `videoEngine=google_veo`:
- `provider` (must be `google_veo`)
- `prompt`
- `metadata.model`
- `metadata.sceneMetadata`
- `metadata.storyMetadata`

Recommended for highest quality:
- `metadata.tokenMetadata` with image URLs
- `scenes[].imageUrl` whenever available

## Response Schema (`POST /render`)

Either synchronous:
```json
{
  "videoUrl": "https://...",
  "thumbnailUrl": "https://... | null"
}
```

Or asynchronous:
```json
{
  "id": "render-id",
  "jobId": "render-id-or-job-id",
  "statusUrl": "https://.../render/render-id"
}
```

## Response Schema (`GET /render/{id}`)

```json
{
  "status": "queued | processing | complete | completed | ready | failed | error",
  "renderStatus": "queued | processing | complete | completed | ready | failed | error",
  "videoUrl": "https://... | null",
  "thumbnailUrl": "https://... | null",
  "error": "string | null"
}
```

The client treats `complete/completed/ready` (or any payload with `videoUrl`) as success.

## Error Contract

On non-2xx:
```json
{
  "error": "human readable message",
  "code": "optional_machine_code"
}
```

Recommended status codes:
- `400` malformed payload
- `401` bad/missing auth
- `429` rate limited
- `500` provider/internal failure
- `504` provider timeout

## Mapping to Google Veo Calls

Backend mapping guide:

1. **Model selection**
- `metadata.model` -> Veo model field (for example `veo-3`).

2. **Prompt construction**
- Prefer `metadata.prompt`.
- If absent, fallback to top-level `prompt`.
- If still absent, synthesize from `hookLine + scenes`.

3. **Scene control**
- `metadata.sceneMetadata` and top-level `scenes` define per-scene timing and narrative.
- Backend may stitch multi-scene Veo outputs or run single prompt with timeline directives.

4. **Reference image conditioning**
- Use `metadata.tokenMetadata[].imageUrl` and `scenes[].imageUrl` as reference images / style anchors.
- Preserve token-image affinity where possible (scene token continuity).

5. **Audio / voiceover**
- `withSound=true`: generate/attach audio track.
- `scenes[].narration` is canonical voiceover text input.

6. **Safety + style**
- `metadata.styleHints` informs tone and edit style.
- Backend applies provider safety filters and falls back gracefully if a scene fails.

## Backend Processing Expectations

1. Validate payload and auth.
2. Persist render job with status `queued`.
3. Translate payload to Veo request(s).
4. Poll provider until terminal state.
5. Store final `videoUrl` + optional `thumbnailUrl`.
6. Return terminal status via `GET /render/{id}`.

## Idempotency

`jobId` should be treated as idempotency key:
- repeated `POST /render` with same `jobId` returns existing render job state instead of duplicate generation.

## Compatibility Notes

- The client sends both:
  - top-level primitive scene fields (`hookLine`, `scenes`)
  - rich Veo bundle (`metadata` / `googleVeo`)
- Backend should prioritize Veo bundle when `videoEngine=google_veo`.
