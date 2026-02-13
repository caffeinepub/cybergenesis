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
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;

    // DIAGNOSTIC: Increase radius from 50 to 500
    const geometry = new THREE.SphereGeometry(500, 32, 32);
    geometry.scale(-1, 1, 1); // Invert so we see the inside

    meshRef.current.geometry = geometry;

    console.log('[DIAGNOSTIC] BackgroundSphere created with radius=500, inverted geometry');

    return () => {
      geometry.dispose();
    };
  }, []);

  // DIAGNOSTIC: Replace shader with red meshBasicMaterial
  return (
    <mesh ref={meshRef} renderOrder={-1} frustumCulled={false}>
      <meshBasicMaterial color="red" side={THREE.BackSide} fog={false} />
    </mesh>
  );
}

function SceneSetup() {
  const { scene, camera } = useThree();

  useEffect(() => {
    // DIAGNOSTIC: Set camera far plane to 2000
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.far = 2000;
      camera.updateProjectionMatrix();
      console.log('[DIAGNOSTIC] Camera far plane set to 2000 and projection matrix updated');
    }

    // Set scene.background to null so sphere is visible
    scene.background = null;
    
    // Reduce fog density to 0.002
    scene.fog = new THREE.FogExp2(0x000000, 0.002);
    
    console.log('[DIAGNOSTIC] Scene setup complete - background=null, fog=0.002, camera.far=2000');
  }, [scene, camera]);

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

    // Add UnrealBloomPass with 50% resolution for mobile GPU performance
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
      0.35, // strength
      0.35, // radius
      1.1   // threshold
    );
    bloomPassRef.current = bloomPass;
    composer.addPass(bloomPass);

    console.log('[Stable Bloom] UnrealBloomPass initialized with diagnostic red background, threshold=1.1, strength=0.35, radius=0.35');

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
      console.log('[Stable Bloom] Composer disposed');
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
          // Keep tone mapping configuration unchanged at 0.6 exposure
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMappingExposure = 0.6;
          
          // Ensure opaque clear alpha is set (default behavior)
          gl.setClearAlpha(1);
        }}
      >
        <Suspense fallback={null}>
          {/* DIAGNOSTIC: Apply camera.far=2000, null background and black fog to scene */}
          <SceneSetup />
          
          {/* DIAGNOSTIC: Red meshBasicMaterial background sphere with radius=500 and frustumCulled=false */}
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
          
          {/* Native UnrealBloomPass with diagnostic red background */}
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
