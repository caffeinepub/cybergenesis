# Specification

## Summary
**Goal:** Perform a brute-force 3D background visibility diagnostic in `CubeVisualization` to ensure the background sphere is not being clipped and is clearly visible.

**Planned changes:**
- Update `SceneSetup` in `frontend/src/components/CubeVisualization.tsx` to set `camera.far = 2000` for a `THREE.PerspectiveCamera`, then call `camera.updateProjectionMatrix()`.
- Modify the `BackgroundSphere` implementation in `frontend/src/components/CubeVisualization.tsx` to bypass the custom shader and render with a solid red `<meshBasicMaterial color="red" side={THREE.BackSide} fog={false} />`.
- Increase the `BackgroundSphere` `SphereGeometry` radius from `50` to `500` while keeping the geometry inverted and preserving `renderOrder={-1}` and `frustumCulled={false}`.

**User-visible outcome:** The 3D scene renders with a large, solid red background sphere that should be clearly visible behind the scene, enabling straightforward verification that camera far-plane clipping and shader/fog issues are not hiding the background.
