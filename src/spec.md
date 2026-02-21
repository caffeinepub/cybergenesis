# Specification

## Summary
**Goal:** Add on-screen debug UI and foolproof inline CSS to MapView for tablet testing without DevTools access.

**Planned changes:**
- Replace map container className with hardcoded inline styles (100vw/100vh, absolute positioning, zIndex 0)
- Update map initialization to safe camera settings (center [1704, 961], zoom 1, pitch 0)
- Add on-screen debug UI overlay with lime green text at top-left showing real-time debug messages
- Capture map dimension, image load success, and image load error events to display in debug UI

**User-visible outcome:** Map displays with guaranteed full viewport dimensions and a visible on-screen debug overlay showing map initialization status and image loading events, enabling troubleshooting directly on tablet without browser DevTools.
