# Specification

## Summary
**Goal:** Fix map orientation by implementing flipped Y-axis coordinates and optimize map physics for smooth panning and zooming.

**Planned changes:**
- Implement flipped Y-axis coordinate system with map center at [1704, -961] and extent [0, -1922, 3408, 0]
- Update ImageLayer extent to [0, -1922, 3408, 0] with canvas renderer and anonymous cross-origin support
- Position neon ray UIMarkers using flipped coordinates [land.x, -land.y]
- Configure map physics: zoom level 2 (range -1 to 5), enable dragPan, disable dragPitch, enable seamless mode
- Remove maxExtent constraint to allow free panning
- Remove green debug UI overlay
- Set close button z-index to 100 and add pointer-events: none to neon ray marker divs

**User-visible outcome:** The map displays in correct orientation (not upside down) with neon rays properly aligned to land positions. Users can smoothly pan and zoom across the map without bouncing or interaction blocking, and the debug overlay is removed for a clean view.
