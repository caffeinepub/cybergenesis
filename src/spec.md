# Specification

## Summary
**Goal:** Add a shader-based radial gradient background to the CubeVisualization scene using an inverted sphere mesh, without using CSS or texture assets.

**Planned changes:**
- In `frontend/src/components/CubeVisualization.tsx`, create a large inverted `THREE.SphereGeometry(50, 32, 32)` background mesh rendered from inside the sphere.
- Use `THREE.ShaderMaterial` to produce a radial gradient in the fragment shader based on UV distance from (0.5, 0.5), blending from deep purple/blue at the center `(0.1, 0.1, 0.25)` to black at the edges `(0, 0, 0)` using `distance * 1.5`.
- Update scene setup so `scene.background = null` and set `scene.fog = new THREE.FogExp2(0x000000, 0.003)` to preserve floor fade-out behavior.
- Preserve the existing renderer tone mapping exposure: keep `gl.toneMappingExposure` set to `0.6`.

**User-visible outcome:** The cube scene displays a moody purple/blue glow centered behind the model that fades to black at the edges, while lighting, bloom, and floor fog behavior remain consistent.
