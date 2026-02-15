# Specification

## Summary
**Goal:** Apply the user-provided fragment shader verbatim to the CubeVisualization background sphere and correctly wire `time` and `resolution` uniforms.

**Planned changes:**
- Update `frontend/src/components/CubeVisualization.tsx` `BackgroundSphere` shader material to use the user-provided fragment shader code exactly as written (verbatim).
- Wire shader uniforms to match the shader variable names: `time` sourced from `state.clock.elapsedTime` and `resolution` sourced from the React Three Fiber canvas `size.width` and `size.height`, updating on resize.
- Ensure the shader renders on the existing centered background sphere (radius 300 at `[0,0,0]`) and is visible from inside by setting the material `side` to `THREE.BackSide` or `THREE.DoubleSide`.

**User-visible outcome:** The 3D scene background sphere displays the exact intended animated shader, correctly responding to time and the current canvas resolution without shader compilation errors.
