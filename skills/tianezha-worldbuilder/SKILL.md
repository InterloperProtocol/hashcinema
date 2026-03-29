---
name: tianezha-worldbuilder
description: This skill should be used when building or updating HashCinema prompt-story generation, source-linked music-video or scene-recreation flows, or the Tianezha worldbuilder knowledge base and continuity rules.
---

# Tianezha Worldbuilder

Use this skill to keep the HyperFlow prompt/story pipeline aligned with the worldbuilder contract.

## Core boxes

- Source media resolver: `lib/cinema/sourceMedia.ts`
- Story assembly: `lib/generators/story.ts`
- Prompt contract: `prompts/cinematic_prompt_template.md`
- Worldbuilder engine: `lib/worldbuilder/tianezha.ts`

## Use the worldbuilder

- Resolve source media first.
- Treat `sourceMediaUrl`, `sourceEmbedUrl`, `sourceTranscript`, and `sourceMediaProvider` as canonical context when present.
- Keep YouTube and Spotify jobs silent at generation time so the external track can be stitched in later.
- Carry transcript cadence into story cards, continuation prompts, and source-faithful narration cues.
- Keep the worldbuilder knowledge base aligned with `poly-manifold`, `Awesome Physics Cognition-based Video Generation`, and `NewtonGen`.

## Build the worldbuilder

- Derive the manifold, storyline, tests, verdict, and summary from the resolved source context.
- Preserve continuity rules instead of inventing new lore or replacing the source track.
- Prefer deterministic wording over improvisation when the brief is source-linked.

