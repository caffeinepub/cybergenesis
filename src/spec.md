# Specification

## Summary
**Goal:** Update the `BackgroundSphere` fragment shader in `CubeVisualization` to remove masking/squeezing so the nebula fills the entire radius-300 background sphere without circular borders.

**Planned changes:**
- In `frontend/src/components/CubeVisualization.tsx`, replace the entire fragment shader `void main()` block in `BackgroundSphere` with the exact user-provided GLSL code (including comments).
- Ensure the updated `void main()` no longer uses any `edgeMask` (or equivalent) and keeps time-based animation via `uTime`.

**User-visible outcome:** The animated nebula background visually covers the full inside of the background sphere (radius 300) without the “tiny sphere” border/vignette effect.
