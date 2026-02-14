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
  // View-Space shader: gradient stays fixed to screen center during rotation
  const vertexShader = `
    varying vec3 vViewPosition;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    varying vec3 vViewPosition;
    void main() {
      // 1. Perspective-aware distance
      float dist = length(vViewPosition.xy) / abs(vViewPosition.z);
      
      // 2. Tighter multiplier for a focused center
      dist = dist * 1.5; 

      // 3. Cinematic Palette
      vec3 deepVoid = vec3(0.0, 0.0, 0.0);       // Pitch black
      vec3 royalViolet = vec3(0.15, 0.02, 0.45); // Muted transition violet
      vec3 corePurple = vec3(1.5, 0.2, 5.0);     // Hot pink/purple core

      // 4. Smooth Vignette Logic:
      // Core fades fast, but the black edges only fully take over at the far corners (1.2)
      vec3 color = mix(corePurple, royalViolet, smoothstep(0.0, 0.3, dist));
      color = mix(color, deepVoid, smoothstep(0.35, 1.2, dist));

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  useEffect(() => {
    console.log('[Studio Vignette] BackgroundSphere shader active with compact pink core and deep black corners');
  }, []);

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[500, 32, 32]} />
      <shaderMaterial 
        fragmentShader={fragmentShader} 
        vertexShader={vertexShader} 
        side={THREE.BackSide} 
        fog={false}
        depthWrite={false}
        dithering={true}
      />
    </mesh>
  );
}

function SceneSetup() {
  const { scene } = useThree();

  useEffect(() => {
    // REQ-3: Set scene.background to null so shader sphere is visible
    scene.background = null;
    
    // REQ-3: Deep Space fog color 0x05010a
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

    // REQ-2: Ultra-Soft Mode Bloom - threshold 1.1, intensity 0.45, radius 0.65
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
      0.45, // intensity (Perfect balance for Deep Nebula shader)
      0.65, // radius (Wide, soft dispersion of light)
      1.1   // threshold (Protects land textures from glowing)
    );
    bloomPassRef.current = bloomPass;
    
    // REQ-2: Set luminanceSmoothing if supported (feature detection)
    if ('luminanceSmoothing' in bloomPass) {
      (bloomPass as any).luminanceSmoothing = 0.4;
      console.log('[Deep Nebula Bloom] UnrealBloomPass initialized with Ultra-Soft Mode: threshold=1.1, intensity=0.45, radius=0.65, luminanceSmoothing=0.4');
    } else {
      console.log('[Deep Nebula Bloom] UnrealBloomPass initialized with Ultra-Soft Mode: threshold=1.1, intensity=0.45, radius=0.65 (luminanceSmoothing not supported in this version)');
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
      console.log('[Deep Nebula Bloom] Composer disposed');
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
          // REQ-3: Tone mapping exposure set to 0.6
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMappingExposure = 0.6;
          
          // Ensure opaque clear alpha is set (default behavior)
          gl.setClearAlpha(1);
          
          console.log('[Deep Nebula] Renderer initialized with toneMappingExposure=0.6');
        }}
      >
        <Suspense fallback={null}>
          {/* REQ-3: Apply null background and Deep Space fog to scene */}
          <SceneSetup />
          
          {/* View-Space shader background sphere with Studio Vignette */}
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
          
          {/* REQ-2: Native UnrealBloomPass with Ultra-Soft Mode settings */}
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
