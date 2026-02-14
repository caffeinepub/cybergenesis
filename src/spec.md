# Specification

## Summary
**Goal:** Apply the final “Studio Balance” background shader look and “Deep Space” fog tuning in `CubeVisualization` while preserving existing exposure and material settings.

**Planned changes:**
- Update `frontend/src/components/CubeVisualization.tsx` `BackgroundSphere` fragment shader to use `centerColor = vec3(1.6, 0.4, 3.2)`, keep `edgeColor = vec3(0.0, 0.0, 0.0)`, and change falloff to `float d = pow(distance, 1.8);` (continuing to mix via `mix(centerColor, edgeColor, d)`).
- Ensure `BackgroundSphere` material settings remain `fog={false}` and `side={THREE.BackSide}`.
- Update `SceneSetup` fog to `new THREE.FogExp2(0x05010a, 0.0015)`.
- Preserve renderer tone mapping exposure at `gl.toneMappingExposure = 0.6`.

**User-visible outcome:** The cube visualization displays the updated Studio Balance background gradient with the tuned Deep Space fog, without changing exposure behavior or breaking the build.
