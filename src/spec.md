# Specification

## Summary
**Goal:** Apply the V.10.1.PBR visual reconstruction and stability lock updates to CubeVisualization and LandModel for consistent tone mapping, lighting, and safe PBR material handling.

**Planned changes:**
- Update `frontend/src/components/CubeVisualization.tsx` Canvas `onCreated` renderer settings (ACESFilm tone mapping, sRGB output color space, exposure 0.6), adjust the specified light intensities/colors, set `Environment` preset to `"sunset"` with `environmentIntensity={1.0}`, and sync the KeyLight position to the camera every frame with offsets (+10, +15, +10).
- Update `frontend/src/components/LandModel.tsx` to call `gltf.scene.updateMatrixWorld()` before Box3 calculations; guard traversal with `if (gltf.scene?.isObject3D)`; implement Glow List emissive behavior (emissiveMap from map when present, emissive white, intensity 2.0); apply biome-based `envMapIntensity` rules (2.0 / 1.3 / 1.0); enforce the roughness/metalness PBR guard; and remove any `m.needsUpdate = true` inside traversal.
- Enforce global stability constraints across touched renderer components: remove any light `castShadow={true}` usage and do not add any `gl.dispose()` cleanup logic.

**User-visible outcome:** The 3D cube visualization and land model render with the specified V.10.1.PBR tone mapping, lighting/environment, and stable PBR material behavior (including biome emissive and reflection intensity rules) without enabling shadows or adding manual WebGL disposal.
