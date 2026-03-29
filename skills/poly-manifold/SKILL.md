---
name: poly-manifold
description: This skill should be used when working with the poly-manifold Rust library or when needing manifold-aware optimization, Euclidean/Sphere/SPD geometry, or geometry-constrained machine learning code.
---

# poly-manifold

Use the cloned repository at `external/poly-manifold` as the reference implementation for manifold-aware work.

## Use this skill when

- Adding or reviewing code that depends on Euclidean, sphere, or SPD manifold constraints.
- Designing optimization or geometry utilities for physics or ML workflows.
- Translating manifold math into reusable Rust crates or path dependencies.

## Work from the reference repo

- Inspect `external/poly-manifold/README.md` for the crate layout and examples.
- Reuse the documented crate split for `manifold-core`, `manifold-spaces`, and `manifold-autodiff`.
- Prefer the existing examples for Euclidean space, sphere optimization, and SPD geodesics before inventing new API shapes.

## Practical guidance

- Keep dependencies path-based when mirroring the crate structure.
- Prefer `cargo test --workspace` after edits.
- Preserve type safety and explicit geometry primitives over ad hoc matrix helpers.

