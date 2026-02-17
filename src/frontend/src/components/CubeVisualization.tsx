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
        // Universal Screen-Space coordinates
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        
        // Deep Indigo Base
        vec3 c1 = vec3(0.2, 0.0, 0.4);
        // Electric Cyan Highlight
        vec3 c2 = vec3(0.0, 0.8, 1.0);
        // Hot Magenta Highlight (Desaturated slightly for realism)
        vec3 c3 = vec3(0.9, 0.1, 0.4);
        // Pure Void Black (Crucial for contrast)
        vec3 c4 = vec3(0.0, 0.0, 0.05);

        float time2 = time * 0.2; // Slow down for elegance

        vec2 q = vec2(0.0);
        q.x = fbm(p + 0.00 * time2);
        q.y = fbm(p + vec2(1.0));
        
        vec2 r = vec2(0.0);
        r.x = fbm(p + 1.0 * q + vec2(1.7, 1.2) + 0.15 * time2);
        r.y = fbm(p + 1.0 * q + vec2(8.3, 2.8) + 0.126 * time2);
        
        float f = fbm(p + r);

        // Mix our colors using the FBM logic
        vec3 color = mix(c1, c2, clamp((f * f) * 4.0, 0.0, 1.0));
        color = mix(color, c3, clamp(length(q), 0.0, 1.0));
        color = mix(color, c4, clamp(length(r.x), 0.0, 1.0));

        color = (f * f * f * 1.5 + 0.5 * f) * color;

        // Increased contrast power (pow 3.0) to crush blacks and boost bloom
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
    // Set scene.background to null so shader plane is visible
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
      console.log('[Full FBM Bloom] UnrealBloomPass initialized: threshold=1.1, intensity=0.45, radius=0.65, luminanceSmoothing=0.4');
    } else {
      console.log('[Full FBM Bloom] UnrealBloomPass initialized: threshold=1.1, intensity=0.45, radius=0.65');
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
      console.log('[Full FBM Bloom] Composer disposed');
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
          
          // Note: Dithering is handled at the material level in LandModel.tsx (m.dithering = true)
          // This is the correct approach in Three.js as dithering is a material property, not a renderer property
          console.log('[Full FBM] Renderer initialized with toneMappingExposure=0.6 (dithering handled at material level in LandModel)');
        }}
      >
        <Suspense fallback={null}>
          {/* Apply null background and Deep Space fog to scene */}
          <SceneSetup />
          
          {/* Screen-Space Quad with full FBM 4-color neon shader */}
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
