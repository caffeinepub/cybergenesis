# Specification

## Summary
**Goal:** Rewrite the Golden Archive MapView with identity projection coordinate system, precise boundary enforcement, and cinematic drone navigation physics.

**Planned changes:**
- Replace map instantiation with identity projection using custom spatial reference (resolutions: 32, 16, 8, 4, 2, 1) and strict boundaries (maxExtent [0, -1922, 3408, 0])
- Update ImageLayer to use webp source with forceRenderOnMoving for smooth rendering during navigation
- Implement cinematic drone entry animation (zoom 3, pitch 55°, bearing 15°, 3500ms duration with 500ms delay)
- Update map container to use fixed positioning with 100dvh height and touchAction: none for proper mobile viewport handling

**User-visible outcome:** Users experience a smooth, cinematic drone-style entry animation when viewing the Golden Archive map, with enforced boundaries preventing navigation outside the map area and improved rendering performance during movement.
