# Specification

## Summary
**Goal:** Rewrite `MapView.tsx` to use a new 2056×2056 map asset with correct spatial reference, manual cover-zoom edge-pinning, and a cinematic drone flight animation on first load.

**Planned changes:**
- Replace the map background ImageLayer with `IMG_0133.webp` (2056×2056) using extent `[0, -2056, 2056, 0]`
- Configure maptalks `SpatialReference` with identity projection, resolutions `[32, 16, 8, 4, 2, 1, 0.5]`, and fullExtent matching the 2056×2056 space
- Set initial map state: center `[1028, -1028]`, zoom 2, pitch 0, bearing 0, panLimit true, panLimitViscosity 0; disable dragRotate, dragPitch, touchZoomRotate
- Implement one-time "bulletproof" edge-pinning logic on first `map idle` event: compute `targetRes = Math.min(2056/vW, 2056/vH)`, derive `minZoomLevel = Math.log2(32/targetRes)`, then call `setMinZoom` and `setZoom` with the computed level
- Set wrapper and container background to `#000`
- After pinning, trigger a cinematic drone flight via `map.animateTo` (200ms delay, 3500ms duration, easing `out`, zoom `minZoomLevel + 2`) targeting the selected land's coordinates — fires only once per mount
- Update all UIMarker placements and animateTo center targets to use `mapX = 1028 + (lon/180)*1028` and `mapY = -(1028 + (lat/90)*1028)`

**User-visible outcome:** The map loads the new CyberMap image filling the full viewport with no black bars, markers are correctly distributed across the map, and on first load a smooth cinematic zoom animation flies to the selected land parcel.
