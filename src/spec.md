# Specification

## Summary
**Goal:** Keep the Three.js canvas background transparent even after GLTF loading and Bloom/EffectComposer initialization.

**Planned changes:**
- In `frontend/src/components/CubeVisualization.tsx`, add `gl.setClearAlpha(0)` inside the `BloomEffect` component’s `useFrame` callback, within the existing `if (composerRef.current)` block.
- Ensure `gl.setClearAlpha(0)` runs before `composerRef.current.render()` and does not remove existing transparency-related steps (`gl.setClearColor(0x000000, 0)`, `gl.clear(true, true, true)`, and `<Canvas ... alpha: true>`).

**User-visible outcome:** The 3D model continues to render over a transparent canvas background (no black backdrop) when the GLTF finishes loading and Bloom is active, with fullscreen behavior unchanged.
