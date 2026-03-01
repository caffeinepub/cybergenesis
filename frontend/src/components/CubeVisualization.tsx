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

// Composite shader: blends bloom render target onto the final scene
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
    void main() {
      gl_FragColor = texture2D(baseTexture, vUv) + vec4(1.0) * texture2D(bloomTexture, vUv);
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
        for (int i = 0; i < NUM_OCTAVES; i++) {
            float dir = mod(float(i), 2.0) > 0.5 ? 1.0 : -1.0;
            v += a * noise(pos - 0.05 * dir * time * 0.2);
            pos = rot * pos * 2.0 + shift;
            a *= 0.5;
        }
        return v;
    }

    void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        
        vec3 c1 = vec3(0.2, 0.4, 0.9);
        vec3 c2 = vec3(1.0, 0.1, 0.6);
        vec3 c3 = vec3(0.3, 0.0, 0.5);
        vec3 c4 = vec3(0.0, 0.0, 0.02);

        float time2 = time * 0.2;
        vec2 q = vec2(fbm(p + 0.0 * time2), fbm(p + vec2(1.0)));
        vec2 r = vec2(fbm(p + q + vec2(1.7, 1.2) + 0.15 * time2), fbm(p + q + vec2(8.3, 2.8) + 0.126 * time2));
        float f = fbm(p + r);

        vec3 color = mix(c1, c2, clamp(f * 1.2, 0.0, 1.0));
        color = mix(color, c3, clamp(length(q) * 1.1, 0.0, 1.0));
        
        float blackMask = smoothstep(0.2, 0.8, length(r.x) * 0.7);
        color = mix(color, c4, blackMask);

        color = (f * f * f * 1.5 + 0.5 * f) * color;
        
        gl_FragColor = vec4(pow(color, vec3(2.0)) * 5.0, 1.0);
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
 *
 * Camera sees both Layer 0 and Layer 1 (set in CameraLayerSetup).
 * HueSaturation is applied via a custom ShaderPass after compositing.
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

    // Bloom settings: intensity=0.15, radius=0.5, luminanceThreshold=0.1
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width / 2, size.height / 2),
      0.15,  // intensity
      0.5,   // radius
      0.1    // luminanceThreshold
    );
    bloomPassRef.current = bloomPass;
    bloomComposer.addPass(bloomPass);

    // ── Final Composer (full scene + bloom composite + HueSaturation) ──
    const finalComposer = new EffectComposer(gl);
    finalComposer.renderToScreen = true;
    finalComposerRef.current = finalComposer;

    const finalRenderPass = new RenderPass(scene, camera);
    finalComposer.addPass(finalRenderPass);

    // Composite pass: merges base scene with bloom render target
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

    // HueSaturation pass: +10% saturation boost after bloom composite
    const hueSaturationPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          hue: { value: 0.0 },
          saturation: { value: 0.1 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float hue;
          uniform float saturation;
          varying vec2 vUv;

          vec3 rgb2hsl(vec3 c) {
            float maxC = max(c.r, max(c.g, c.b));
            float minC = min(c.r, min(c.g, c.b));
            float l = (maxC + minC) * 0.5;
            float s = 0.0;
            float h = 0.0;
            if (maxC != minC) {
              float d = maxC - minC;
              s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
              if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
              else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
              else h = (c.r - c.g) / d + 4.0;
              h /= 6.0;
            }
            return vec3(h, s, l);
          }

          float hue2rgb(float p, float q, float t) {
            if (t < 0.0) t += 1.0;
            if (t > 1.0) t -= 1.0;
            if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
            if (t < 1.0/2.0) return q;
            if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
            return p;
          }

          vec3 hsl2rgb(vec3 c) {
            if (c.y == 0.0) return vec3(c.z);
            float q = c.z < 0.5 ? c.z * (1.0 + c.y) : c.z + c.y - c.z * c.y;
            float p = 2.0 * c.z - q;
            return vec3(
              hue2rgb(p, q, c.x + 1.0/3.0),
              hue2rgb(p, q, c.x),
              hue2rgb(p, q, c.x - 1.0/3.0)
            );
          }

          void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec3 hsl = rgb2hsl(texel.rgb);
            hsl.x = fract(hsl.x + hue);
            hsl.y = clamp(hsl.y * (1.0 + saturation), 0.0, 1.0);
            gl_FragColor = vec4(hsl2rgb(hsl), texel.a);
          }
        `,
      })
    );
    finalComposer.addPass(hueSaturationPass);

    console.log('[SelectiveBloom] Dual-composer initialized: Layer1-only bloom + HueSaturation(+0.1)');

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

  useFrame(() => {
    if (!bloomComposerRef.current || !finalComposerRef.current) return;

    // Step 1: Render only Layer 1 (emissive/bloom targets) into bloom render target
    camera.layers.set(1);
    bloomComposerRef.current.render();

    // Step 2: Restore camera to see both layers, render full scene + composite bloom
    camera.layers.enable(0);
    camera.layers.enable(1);
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
          // AgX Tone Mapping with exposure 1.2 to compensate for AgX softness
          gl.toneMapping = THREE.AgXToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMappingExposure = 1.2;
          gl.setClearAlpha(1);
          console.log('[Renderer] AgXToneMapping, toneMappingExposure=1.2');
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

          {/* Selective Bloom (Layer 1 only) + HueSaturation(+0.1) */}
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
