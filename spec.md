# Specification

## Summary
**Goal:** Fine-tune crystal glass visual appearance by adjusting Bloom post-processing values and biome emissive intensity.

**Planned changes:**
- In `CubeVisualization.tsx`, set Bloom `intensity` to `0.15`, `radius` to `0.5`, and `luminanceThreshold` to `0.1`
- In `LandModel.tsx`, set `emissiveIntensity` to `1.0` for every biome entry in `biomeConfigs` (previously `1.5`), leaving `pulse` and all other properties unchanged

**User-visible outcome:** The crystal cube will display a subtler bloom glow, and all biome land models will render with slightly reduced emissive intensity.
