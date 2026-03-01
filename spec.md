# Specification

## Summary
**Goal:** Fix the black screen bug in CubeVisualisation.tsx caused by incorrect buffer/layer sync in the bloom composer, and replace the MapView.tsx Maptalks implementation with a Leaflet-based one.

**Planned changes:**
- In `CubeVisualisation.tsx`, replace the `useFrame` callback inside `SelectiveBloomEffect` to correctly swap render buffers: render bloom on layer 1, link `readBuffer.texture` to the composite shader's `bloomTexture` uniform, then reset camera to layer 0 with layer 1 enabled for the final pass with `gl.autoClear = true`
- In `CubeVisualisation.tsx`, set `gl.autoClear = false` in the `onCreated` / renderer initialization block of the Canvas component
- Completely replace `frontend/src/components/MapView.tsx` with a Leaflet implementation using `L.CRS.Simple`, an image overlay from a remote `.webp` URL with 2560×2560 bounds, land plot polylines from center to each plot with biome-colored neon beams, and a close button

**User-visible outcome:** The 3D cube visualization no longer shows a black screen — the background sphere and bloom effects render correctly together. The map view now uses Leaflet with a pixel-grid coordinate system, displaying the cyberland map image with neon polylines per land plot.
