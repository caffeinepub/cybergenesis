# Specification

## Summary
**Goal:** Replace only the `fragmentShader` string content of the `backgroundSphere` in `CubeVisualization.tsx` with a new FBM-based nebula shader.

**Planned changes:**
- Replace the `backgroundSphere` `fragmentShader` constant in `frontend/src/components/CubeVisualization.tsx` with the new GLSL FBM nebula shader code (using `random`, `noise`, `fbm` functions and blue/pink/purple color mixing driven by `time` and `resolution` uniforms).

**User-visible outcome:** The animated background of the cube visualization renders a dynamic blue/pink/purple nebula cloud effect instead of the previous background shader.
