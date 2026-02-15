import { Suspense, useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
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
      intensity={Math.PI * 2.2}
      color="#ffffff"
    />
  );
}

function BackgroundSphere() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();

  // Simple vertex shader
  const vertexShader = `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // User-provided fragment shader EXACTLY as written
  const fragmentShader = `
#ifdef GL_ES
precision highp float;
#endif

#extension GL_OES_standard_derivatives : enable

#define NUM_OCTAVES 6

uniform float time;
uniform vec2 resolution;

mat3 rotX(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat3(
    1, 0, 0,
    0, c, -s,
    0, s, c
    );
}
mat3 rotY(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat3(
    c, 0, -s,
    0, 1, 0,
    s, 0, c
    );
}

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
    vec2 p = (gl_FragCoord.xy * 3.0 - resolution.xy) / min(resolution.x, resolution.y);
    p -= vec2(12.0, 0.0);

    float t = 0.0, d;

    float time2 = 100.0; // Fixed time offset from original code

    vec2 q = vec2(0.0);
    q.x = fbm(p + 0.00 * time2);
    q.y = fbm(p + vec2(1.0));
    vec2 r = vec2(0.0);
    r.x = fbm(p + 1.0 * q + vec2(1.7, 1.2) + 0.15 * time2);
    r.y = fbm(p + 1.0 * q + vec2(8.3, 2.8) + 0.126 * time2);
    float f = fbm(p + r);
    
    // MIX 1: Base Background (Deep Purple mixing into Black)
    vec3 color = mix(
        vec3(0.05, 0.0, 0.1), // OUR DEEP PURPLE
        vec3(0.0, 0.0, 0.0),  // OUR BLACK VOID
        clamp((f * f) * 5.5, 1.2, 15.5)
    );

    // MIX 2: Adding the Neon Layer
    color = mix(
        color,
        vec3(0.6, 0.0, 0.8),  // OUR BRIGHT NEON
        clamp(length(q), 2.0, 2.0)
    );

    // MIX 3: Adding the Highlights (Bright/White)
    color = mix(
        color,
        vec3(0.8, 0.4, 1.0),  // OUR BRIGHT HIGHLIGHT
        clamp(length(r.x), 0.0, 5.0)
    );

    color = (f * f * f * 1.0 + 0.5 * 1.7 * 0.0 + 0.9 * f) * color;

    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float alpha = 50.0 - max(pow(100.0 * distance(uv.x, -1.0), 0.0), pow(2.0 * distance(uv.y, 0.5), 5.0));
    
    // Using simple alpha logic from original
    gl_FragColor = vec4(color, 1.0); 
}
  `;

  // Initialize uniforms with correct names: time and resolution
  const uniforms = useMemo(
    () => ({
      time: { value: 0.0 },
      resolution: { value: new THREE.Vector2(size.width, size.height) },
    }),
    [size.width, size.height]
  );

  // Update time uniform each frame
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  // Update resolution uniform when size changes
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.resolution.value.set(size.width, size.height);
    }
  }, [size.width, size.height]);

  useEffect(() => {
    console.log('[BackgroundSphere] User-provided fragment shader active with time and resolution uniforms');
  }, []);

  return (
    <mesh 
      position={[0, 0, 0]} 
      renderOrder={-1}
      castShadow={false}
      receiveShadow={false}
    >
      <sphereGeometry args={[300, 32, 32]} />
      <shaderMaterial 
        ref={materialRef}
        fragmentShader={fragmentShader} 
        vertexShader={vertexShader}
        uniforms={uniforms}
        side={THREE.BackSide} 
        fog={false}
        depthWrite={false}
        dithering={true}
        transparent={false}
      />
    </mesh>
  );
}

function SceneSetup() {
  const { scene } = useThree();

  useEffect(() => {
    // Set scene.background to null so shader sphere is visible
    scene.background = null;
    
    // Deep Space fog color 0x05010a
    scene.fog = new THREE.FogExp2(0x05010a, 0.0015);
    
    console.log('[Scene Setup] Background set to null, Deep Space fog (0x05010a, density 0.0015) applied');
  }, [scene]);

  return null;
}

function BloomEffect() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const renderPassRef = useRef<RenderPass | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);

  useEffect(() => {
    // Ensure renderer uses opaque clear alpha
    gl.setClearAlpha(1);
    
    // Initialize EffectComposer with default settings
    const composer = new EffectComposer(gl);
    composer.renderToScreen = true;
    composerRef.current = composer;

    // Standard RenderPass with default clearing behavior
    const renderPass = new RenderPass(scene, camera);
    renderPassRef.current = renderPass;
    composer.addPass(renderPass);

    // Bloom configuration: threshold=1.1 (preserved as requested)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
      0.45, // intensity
      0.65, // radius
      1.1   // threshold (preserved)
    );
    bloomPassRef.current = bloomPass;
    
    // Set luminanceSmoothing if supported (feature detection)
    if ('luminanceSmoothing' in bloomPass) {
      (bloomPass as any).luminanceSmoothing = 0.4;
      console.log('[Domain Warp Bloom] UnrealBloomPass initialized: threshold=1.1, intensity=0.45, radius=0.65, luminanceSmoothing=0.4');
    } else {
      console.log('[Domain Warp Bloom] UnrealBloomPass initialized: threshold=1.1, intensity=0.45, radius=0.65');
    }
    
    composer.addPass(bloomPass);

    return () => {
      // Cleanup on unmount
      if (bloomPassRef.current) {
        bloomPassRef.current.dispose();
        bloomPassRef.current = null;
      }
      if (renderPassRef.current) {
        renderPassRef.current.dispose();
        renderPassRef.current = null;
      }
      if (composerRef.current) {
        composerRef.current.dispose();
        composerRef.current = null;
      }
      console.log('[Domain Warp Bloom] Composer disposed');
    };
  }, [gl, scene, camera, size.width, size.height]);

  // Handle resize
  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);
      
      // Update bloom pass resolution to 50% of new size
      if (bloomPassRef.current) {
        bloomPassRef.current.resolution.set(size.width / 2, size.height / 2);
      }
    }
  }, [size]);

  // Clean render loop - only composer.render(), no manual clearing
  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
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

  // Fullscreen state and container ref
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fullscreen toggle handler
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

  // Sync fullscreen state with browser fullscreen changes
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
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        onCreated={({ gl }) => {
          // Tone mapping exposure set to 0.6 (preserved as requested)
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMappingExposure = 0.6;
          
          // Ensure opaque clear alpha is set (default behavior)
          gl.setClearAlpha(1);
          
          console.log('[Domain Warp FBM] Renderer initialized with toneMappingExposure=0.6');
        }}
      >
        <Suspense fallback={null}>
          {/* Apply null background and Deep Space fog to scene */}
          <SceneSetup />
          
          {/* User-provided fragment shader background sphere with time and resolution uniforms */}
          <BackgroundSphere />
          
          <LandModel modelUrl={modelUrl} />
          
          {/* V.10.1.PBR Lighting Configuration */}
          <Environment preset="sunset" environmentIntensity={1.0} />
          <hemisphereLight 
            intensity={1.05} 
            color="#f7f7f7" 
            groundColor="#3a3a3a" 
          />
          <KeyLightSync />
          <directionalLight
            name="SunLight"
            position={[-10, 20, -15]}
            intensity={Math.PI * 0.5}
            color="#ffe4b5"
          />
          
          <OrbitControls makeDefault />
          
          {/* Native UnrealBloomPass with threshold=1.1 preserved */}
          <BloomEffect />
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
          // Minimize icon (exit fullscreen)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        ) : (
          // Maximize icon (enter fullscreen)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        )}
      </button>
    </div>
  );
}
