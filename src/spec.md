# Specification

## Summary
**Goal:** Fix Canvas dithering placement and calibrate lighting/Bloom parameters for optimal visual quality.

**Planned changes:**
- Remove incorrect dithering code (lines 320-321) from CubeVisualization.tsx and add dithering property to Canvas gl prop
- Reduce envMap intensity for 5 main biomes from 2.0 to 1.5 in LandModel.tsx
- Update base emissive intensity to 3.2 and adjust pulse animation timing/range in LandModel.tsx
- Fine-tune Bloom post-processing parameters (threshold: 2.1, luminanceSmoothing: 0.5, intensity: 0.32, radius: 0.7) in CubeVisualization.tsx

**User-visible outcome:** Improved 3D rendering quality with proper dithering, balanced lighting that reduces excessive glow from environment maps, smoother emissive animations, and sharper detail retention by preventing specular highlights from being caught in the Bloom effect.
