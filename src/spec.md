# Specification

## Summary
**Goal:** Fix unintended emissive glow on models without emissive maps and enable dithering in the Cube visualization canvas.

**Planned changes:**
- Update `frontend/src/components/LandModel.tsx` material emissive handling so emissive glow is conditional: use the emissive map + white emissive (with `m.userData.baseEmissive = 2.0`) when present, otherwise set emissive to black and `m.userData.baseEmissive = 0.0`.
- Update `frontend/src/components/CubeVisualization.tsx` to add `dithering: true` to the `<Canvas gl={{ ... }} />` configuration without changing existing `gl` settings.

**User-visible outcome:** Models without emissive maps no longer glow white or pulse emissively, while models with emissive maps retain their intended glow; Cube visualization renders with dithering enabled.
