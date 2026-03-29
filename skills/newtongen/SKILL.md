---
name: newtongen
description: This skill should be used when building or evaluating NewtonGen-based text-to-video workflows, motion-controllable generation, or physics-consistent motion scripts.
---

# NewtonGen

Use the cloned repository at `external/NewtonGen` as the implementation reference for controllable, physics-consistent text-to-video motion.

## Use this skill when

- Adding or reviewing motion-aware text-to-video features.
- Controlling linear motion, rotation, resizing, oscillation, or other Newtonian dynamics.
- Reusing the project's inference scripts, learned dynamics, or evaluation pipeline.

## Work from the reference repo

- Inspect `external/NewtonGen/README.md` before changing the workflow.
- Use the `inference_*.py` scripts as the motion-control entry points.
- Reuse the `learned_dynamics` assets and `evaluation_PIS` evaluation path when matching the project's physics metrics.

## Practical guidance

- Keep the motion spec explicit.
- Preserve the separation between physics-clean video preparation, state labeling, inference, and evaluation.
- Prefer the project's native prompts and configuration shape over invented control knobs.

