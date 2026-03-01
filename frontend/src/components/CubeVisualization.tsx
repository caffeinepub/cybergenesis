import { Suspense, useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import LandModel from './LandModel';

interface CubeVisualizationProps {
  biome?: string;
}

const BIOME_MODEL_MAP: Record<string, string> = {
  FOREST_VALLEY: 'https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/FOREST_VALLEY_KTX2.glb',
  ISLAND_ARCHIPELAGO: 'https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/ISLAND_ARCHIPELAGO.glb',
  SNOW_PEAK: 'https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/SNOW_PEAK.glb',
  DESERT_DUNE: 'https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/DESERT_DUNE.glb',
  VOLCANIC_CRAG: 'https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/VOLCANIC_CRAG.glb',
  MYTHIC_VOID: 'https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/MYTHIC_VOID.glb',
  MYTHIC_AETHER: 'https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/MYTHIC_AETHER.glb',
};

// STEP 3: Monolithic ACES v1 + CAS Sharpening + Specular Glints composite shader
const COMPOSITE_SHADER = {
  uniforms: {
    baseTexture: { value: null as THREE.Texture | null },
    bloomTexture: { value: null as THREE.Texture | null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    varying vec2 vUv;

    // 1. Luminance helper for specular detection
    float luminance(vec3 v) {
        return dot(v, vec3(0.2126, 0.7152, 0.0722));
    }

    // 2. ACES v1 Narkowicz (PlayCanvas Standard)
    vec3 toneMapACES(vec3 x) {
        const float a = 2.51;
        const float b = 0.03;
        const float c = 2.43;
        const float d = 0.59;
        const float e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
        // --- SHARPENING ---
        float sharpness = 0.15;
        vec2 texSize = vec2(1024.0);
        vec3 center = texture2D(baseTexture, vUv).rgb;
        vec3 left   = texture2D(baseTexture, vUv - vec2(1.0/texSize.x, 0.0)).rgb;
        vec3 right  = texture2D(baseTexture, vUv + vec2(1.0/texSize.x, 0.0)).rgb;
        vec3 up     = texture2D(baseTexture, vUv - vec2(0.0, 1.0/texSize.y)).rgb;
        vec3 down   = texture2D(baseTexture, vUv + vec2(0.0, 1.0/texSize.y)).rgb;
        
        vec3 baseRGB = center + sharpness * (4.0 * center - left - right - up - down);
        vec3 bloomRGB = texture2D(bloomTexture, vUv).rgb;

        // --- SPECULAR GLINTS (The "Sparks") ---
        // Threshold 2.5 ensures only extreme HDR reflections (metal/glass sparks) glint.
        float glintThreshold = 2.5; 
        float glintStrength = 3.0; 
        float highlight = max(0.0, luminance(baseRGB) - glintThreshold) * glintStrength;
        vec3 finalBloom = bloomRGB + (baseRGB * highlight);
        
        // --- COMBINE & TONE MAPPING ---
        vec3 color = (baseRGB + finalBloom) * 1.0; // Exposure 1.0
        vec3 mapped = toneMapACES(color);
        
        // --- FINAL sRGB OUTPUT (Gamma 2.2) ---
        gl_FragColor = vec4(pow(mapped, vec3(1.0 / 2.2)), 1.0);
    }
  `,
};

// Camera layer setup: enable both Layer 0 (default) and Layer 1 (bloom targets)
function CameraLayerSetup() {
  const { camera } = useThree();

  useEffect(() => {
    // Layer 0 is enabled by default; explicitly enable it to be safe
    camera.layers.enable(0);
    // Layer 1 is used for selective bloom targets (emissive meshes)
    camera.layers.enable(1);
    console.log('[CameraLayerSetup] Camera now sees Layer 0 and Layer 1');
  }, [camera]);

  return null;
}

// Camera-linked directional key light
function KeyLightSync() {
  const keyLight = useRef<THREE.DirectionalLight>(null);

  useFrame(({ camera }) => {
    if (keyLight.current) {
      keyLight.current.position.set(
        camera.position.x + 10,
        camera.position.y + 15,
        camera.position.z + 10
      );
    }
  });

  return (
    <directionalLight
      ref={keyLight}
      name="KeyLight"
      intensity={Math.PI * 0.8}
      color="#ffffff"
    />
  );
}

// Full FBM Shader with 4-color neon palette
const BackgroundSphere = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 1.0, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float time;
    uniform vec2 resolution;
    
    #define NUM_OCTAVES 6

    float random(vec2 pos) {
        return fract(sin(dot(pos.xy, vec2(13.9898, 78.233))) * 43758.5453123);
    }

    float noise(vec2 pos) {
        vec2 i = floor(pos);
        vec2 f = fract(pos);
        float a = random(i + vec2(0.0, 0.0));
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    float fbm(vec2 pos) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i=0; i<NUM_OCTAVES; i++) {
            float dir = mod(float(i), 2.0) > 0.5 ? 1.0 : -1.0;
            v += a * noise(pos - 0.05 * dir * time);
            pos = rot * pos * 2.0 + shift;
            a *= 0.5;
        }
        return v;
    }

    void main(void) {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        
        vec3 c1 = vec3(0.2, 0.0, 0.4);
        vec3 c2 = vec3(0.0, 0.8, 1.0);
        vec3 c3 = vec3(0.9, 0.1, 0.4);
        vec3 c4 = vec3(0.0, 0.0, 0.05);

        float time2 = time * 0.2;

        vec2 q = vec2(0.0);
        q.x = fbm(p + 0.00 * time2);
        q.y = fbm(p + vec2(1.0));
        
        vec2 r = vec2(0.0);
        r.x = fbm(p + 1.0 * q + vec2(1.7, 1.2) + 0.15 * time2);
        r.y = fbm(p + 1.0 * q + vec2(8.3, 2.8) + 0.126 * time2);
        
        float f = fbm(p + r);

        vec3 color = mix(c1, c2, clamp((f * f) * 4.0, 0.0, 1.0));
        color = mix(color, c3, clamp(length(q), 0.0, 1.0));
        color = mix(color, c4, clamp(length(r.x), 0.0, 1.0));

        color = (f * f * f * 1.5 + 0.5 * f) * color;

        gl_FragColor = vec4(pow(color, vec3(3.0)) * 6.0, 1.0);
    }
  `;

  const uniforms = useMemo(() => ({
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) }
  }), []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.getElapsedTime();
      const canvas = state.gl.domElement;
      materialRef.current.uniforms.resolution.value.set(canvas.width, canvas.height);
    }
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        transparent={false}
      />
    </mesh>
  );
};

function SceneSetup() {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = null;
    scene.fog = new THREE.FogExp2(0x05010a, 0.0015);
    console.log('[Scene Setup] Background set to null, Deep Space fog applied');
  }, [scene]);

  return null;
}

/**
 * Selective Bloom via dual-composer + layer technique:
 * 1. bloomComposer renders ONLY Layer 1 (emissive meshes) → writes to render target (not screen)
 * 2. finalComposer renders full scene (Layer 0 + 1) and composites bloom texture on top
 *    via monolithic ACES v1 + CAS Sharpening + Specular Glints shader
 *
 * STEP 1: NoToneMapping + LinearSRGBColorSpace (tone mapping handled in shader)
 * STEP 2: Bloom intensity=0.8, radius=0.65, threshold=0.1, luminanceSmoothing=0.1
 * STEP 3: ACES v1 Narkowicz + CAS Sharpening + Specular Glints in composite shader
 * STEP 4: HueSaturationPass removed — CompositePass is the final pass
 */
function SelectiveBloomEffect() {
  const { gl, scene, camera, size } = useThree();

  const bloomComposerRef = useRef<EffectComposer | null>(null);
  const finalComposerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);

  useEffect(() => {
    gl.setClearAlpha(1);

    // ── Bloom Composer (Layer 1 only, renders to off-screen target) ──
    const bloomComposer = new EffectComposer(gl);
    bloomComposer.renderToScreen = false;
    bloomComposerRef.current = bloomComposer;

    const bloomRenderPass = new RenderPass(scene, camera);
    bloomComposer.addPass(bloomRenderPass);

    // STEP 2: Bloom settings — intensity=0.8, radius=0.65, threshold=0.1
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width / 2, size.height / 2),
      0.8,   // intensity
      0.65,  // radius
      0.1    // luminanceThreshold
    );
    bloomPassRef.current = bloomPass;

    // STEP 2: Restore luminanceSmoothing=0.1 via runtime guard
    if ('luminanceSmoothing' in bloomPass) {
      (bloomPass as any).luminanceSmoothing = 0.1;
    }

    bloomComposer.addPass(bloomPass);

    // ── Final Composer (full scene + ACES v1 composite) ──
    const finalComposer = new EffectComposer(gl);
    finalComposer.renderToScreen = true;
    finalComposerRef.current = finalComposer;

    const finalRenderPass = new RenderPass(scene, camera);
    finalComposer.addPass(finalRenderPass);

    // STEP 3 & 4: Composite pass with monolithic ACES v1 + Sharpening + Glints shader
    // This is the FINAL pass — no HueSaturationPass after it
    const compositePass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComposer.renderTarget2.texture },
        },
        vertexShader: COMPOSITE_SHADER.vertexShader,
        fragmentShader: COMPOSITE_SHADER.fragmentShader,
        defines: {},
      }),
      'baseTexture'
    );
    compositePass.needsSwap = true;
    finalComposer.addPass(compositePass);

    // STEP 4: HueSaturationPass is intentionally NOT added — CompositePass is the final pass

    console.log('[SelectiveBloom] Dual-composer initialized: ACES v1 + CAS Sharpening + Specular Glints, luminanceSmoothing=0.1');

    return () => {
      bloomPassRef.current?.dispose();
      bloomPassRef.current = null;
      bloomComposerRef.current?.dispose();
      bloomComposerRef.current = null;
      finalComposerRef.current?.dispose();
      finalComposerRef.current = null;
      console.log('[SelectiveBloom] Composers disposed');
    };
  }, [gl, scene, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle resize
  useEffect(() => {
    if (bloomComposerRef.current) {
      bloomComposerRef.current.setSize(size.width, size.height);
    }
    if (finalComposerRef.current) {
      finalComposerRef.current.setSize(size.width, size.height);
    }
    if (bloomPassRef.current) {
      bloomPassRef.current.resolution.set(size.width / 2, size.height / 2);
    }
  }, [size]);

  // FINAL TECHNICAL PATCH: BUFFER & LAYER SYNC
  useFrame((state) => {
    const { gl, camera } = state;
    if (!bloomComposerRef.current || !finalComposerRef.current) return;

    // STEP 1: Render Bloom (Only crystals/glow)
    camera.layers.set(1);
    bloomComposerRef.current.render();

    // STEP 2: Link active bloom buffer to our Composite Shader
    // This is the fix for the black screen - getting the texture from 'readBuffer'
    const currentBloomTexture = bloomComposerRef.current.readBuffer.texture;
    const compositePass = finalComposerRef.current.passes[1] as any;
    if (compositePass?.uniforms?.bloomTexture) {
      compositePass.uniforms.bloomTexture.value = currentBloomTexture;
    }

    // STEP 3: Render Final Scene (Background + Land + Glow)
    gl.autoClear = true;
    camera.layers.set(0); // Bring back BackgroundSphere
    camera.layers.enable(1); // Keep Crystals/Glow
    finalComposerRef.current.render();
  }, 1);

  return null;
}

export default function CubeVisualization({ biome }: CubeVisualizationProps) {
  const modelUrl = useMemo(() => {
    if (!biome) return null;
    const url = BIOME_MODEL_MAP[biome];
    console.log('[Biome Check]', biome);
    console.log('[Model URL]', url);
    return url || null;
  }, [biome]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen toggle error:', error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (!modelUrl) {
    console.warn('Biome missing for CubeVisualization, showing fallback');
    return (
      <div className="w-full h-full flex items-center justify-center text-cyan-400">
        3D model unavailable
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full group">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
          ...(({ dithering: true } as any))
        }}
        onCreated={({ gl }) => {
          // STEP 1: Disable built-in tone mapping — handled manually in ACES v1 shader
          gl.toneMapping = THREE.NoToneMapping;
          // STEP 1: Linear color space — gamma 2.2 applied manually in shader
          gl.outputColorSpace = THREE.LinearSRGBColorSpace;
          // STEP 1: No toneMappingExposure — exposure handled in shader (1.0)
          gl.setClearAlpha(1);
          // Prevent renderer from fighting with the composer's manual clear in useFrame
          gl.autoClear = false;
          console.log('[Renderer] NoToneMapping, LinearSRGBColorSpace — ACES v1 shader active, autoClear=false');
        }}
      >
        <Suspense fallback={null}>
          {/* Scene background and fog */}
          <SceneSetup />

          {/* Camera layer setup: enable Layer 0 and Layer 1 */}
          <CameraLayerSetup />

          {/* Screen-Space FBM background shader */}
          <BackgroundSphere />

          <LandModel modelUrl={modelUrl} biome={biome} />

          {/* Artist Workshop HDRI */}
          <Environment
            files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/artist_workshop_1k.hdr"
            environmentIntensity={1.0}
            blur={0}
          />

          {/* Hemisphere Light: plain 0.3, NO Math.PI */}
          <hemisphereLight
            intensity={0.3}
            color="#f7f7f7"
            groundColor="#3a3a3a"
          />

          {/* Camera-linked Directional Key Light: Math.PI * 0.8 */}
          <KeyLightSync />

          {/* Sunlight Directional Light: Math.PI * 0.4 */}
          <directionalLight
            name="SunLight"
            position={[-10, 20, -15]}
            intensity={Math.PI * 0.4}
            color="#ffe4b5"
          />

          <OrbitControls makeDefault />

          {/* Selective Bloom (Layer 1 only) + ACES v1 Composite (final pass) */}
          <SelectiveBloomEffect />
        </Suspense>
      </Canvas>

      {/* Glassmorphism fullscreen toggle button */}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 z-50 opacity-0 group-hover:opacity-100 p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white transition-all hover:bg-black/60 active:scale-95"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
        )}
      </button>
    </div>
  );
}
