# Specification

## Summary
**Goal:** Enable dithering in the 3D Canvas rendering by removing a blocking comment and adding the dithering flag to the Canvas gl configuration.

**Planned changes:**
- Remove the blocking comment on lines 323-325 in CubeVisualization.tsx that references dithering at the material level
- Add `dithering: true` to the Canvas component's gl prop object while preserving existing properties (antialias, powerPreference, alpha)

**User-visible outcome:** The 3D cube visualization will render with dithering enabled, potentially improving visual quality and reducing color banding artifacts.
