# Specification

## Summary
**Goal:** Replace the existing Bloom implementation in `CubeVisualization.tsx` with native Three.js postprocessing using `three/examples/jsm`’s `EffectComposer`, `RenderPass`, and `UnrealBloomPass`, tuned to the specified performance and visual parameters.

**Planned changes:**
- Update `frontend/src/components/CubeVisualization.tsx` to remove any `@react-three/postprocessing` Bloom usage and instead import/use `EffectComposer`, `RenderPass`, and `UnrealBloomPass` from `three/examples/jsm`.
- Initialize `UnrealBloomPass` at 50% internal resolution (`new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2)`) and set bloom parameters to `threshold=1.1`, `strength=0.35`, `radius=0.35`.
- Integrate composer-based rendering so the render loop uses `composer.render()` (replacing direct renderer output) while keeping `toneMappingExposure` synced to `0.6` and leaving existing tone mapping/output color space unchanged.
- Manage composer lifecycle with React hooks, including unmount cleanup that disposes `composer`, `renderPass`, and `bloomPass` (without calling `gl.dispose()`), and without changing any existing lighting/PBR calibration.

**User-visible outcome:** The cube visualization renders with a tuned bloom/glow effect using native Three.js postprocessing, with improved performance via half-resolution bloom rendering and no changes to existing lighting or PBR calibration.
