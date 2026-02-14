# Specification

## Summary
**Goal:** Fix `LandModel.tsx` emissive initialization and pulsing so each biome retains its unique baseline emissive brightness while still pulsing, and enable dithering consistently across land materials.

**Planned changes:**
- Update land material setup traversal in `frontend/src/components/LandModel.tsx` to assign each biome/mesh its intended `emissiveIntensity` first, then store the per-mesh baseline as `child.material.userData.baseEmissive = child.material.emissiveIntensity`.
- Refine the `useFrame` pulse logic to traverse via `group.current.traverse(...)` and apply pulsing as `material.emissiveIntensity = material.userData.baseEmissive * pulse` for meshes with `userData.baseEmissive` defined.
- Ensure `child.material.dithering = true` is applied to all processed land mesh materials during the same setup traversal.

**User-visible outcome:** Biome land models “breathe” with a shared pulse timing while preserving different absolute emissive brightness per biome (e.g., Snow remains brighter than Plains), with dithering enabled across land materials for smoother gradients.
