# Specification

## Summary
**Goal:** Calibrate global renderer dithering, tone mapping exposure, lighting intensities, bloom settings, and emissive baseline to reduce banding and improve PBR emissive look.

**Planned changes:**
- Add `dithering: true` to the existing `<Canvas gl={{ ... }} />` configuration in `frontend/src/components/CubeVisualization.tsx` without altering other `gl` properties or JSX structure.
- In `CubeVisualization.tsx` `onCreated`, set `gl.toneMappingExposure = 0.85` without changing other initialization logic.
- In `CubeVisualization.tsx`, update lighting numeric values only: `KeyLightSync` intensity to `Math.PI * 2.0` and `hemisphereLight` intensity to `1.2`.
- In `CubeVisualization.tsx`, update UnrealBloomPass calibration numeric values only: `threshold` to `1.5` and, when supported, `luminanceSmoothing` to `0.1`, without changing the postprocessing pipeline structure.
- In `frontend/src/components/LandModel.tsx`, within the existing `if (obj.material.emissiveMap)` block, change `m.userData.baseEmissive` from `2.0` to `2.2` without altering other logic.
- Ensure the final build output retains the `dithering: true` line in the committed/built `CubeVisualization.tsx` (no build/rewrite removing it).

**User-visible outcome:** The scene renders with reduced background banding (global dithering), adjusted exposure, tuned lighting and bloom behavior, and slightly stronger emissive response on land materials, with these calibrations reliably present in the final build.
