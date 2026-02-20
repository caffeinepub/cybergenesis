# Specification

## Summary
**Goal:** Finalize the visual engine by implementing the Artist Workshop HDRI and biome-specific lighting configuration with dynamic pulse animations.

**Planned changes:**
- Replace Environment component HDRI with Artist Workshop HDRI (artist_workshop_1k.hdr) at intensity 1.0 and blur 0
- Implement biome-specific lighting configuration mapping 6 land types plus default fallback to env and emissive values
- Update pulse animation formula to use sin-based calculation with stored baseEmissive values per biome

**User-visible outcome:** Each biome (Mythic Void, Island Archipelago, Desert Dune, Volcanic Crag, Forest Valley, Mythic Aether) will have distinct environmental lighting and emissive glow intensity with smooth pulsing animations, creating more immersive and varied visual atmospheres across different land types.
