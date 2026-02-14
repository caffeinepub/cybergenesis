import { useEffect, useMemo, useRef } from 'react';
import { useLoader, useThree, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import * as THREE from 'three';

interface LandModelProps {
  modelUrl: string;
}

export default function LandModel({ modelUrl }: LandModelProps) {
  const { gl, camera } = useThree();
  const fittedRef = useRef(false);
  const isInitialized = useRef(false);
  const group = useRef<THREE.Group>(null);

  // Initialize KTX2Loader with CDN-hosted basis transcoder
  const ktx2Loader = useMemo(() => {
    const loader = new KTX2Loader();
    loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.176.0/examples/jsm/libs/basis/');
    loader.detectSupport(gl);
    return loader;
  }, [gl]);

  // Load GLTF model with KTX2 support
  const gltf = useLoader(
    GLTFLoader,
    modelUrl,
    (loader) => {
      loader.setKTX2Loader(ktx2Loader);
    }
  );

  useEffect(() => {
    if (!gltf || !gltf.scene || isInitialized.current) return;

    console.log('[LandModel] Processing model:', modelUrl);

    // SAFETY: Call updateMatrixWorld BEFORE Box3 calculation
    gltf.scene.updateMatrixWorld();

    // V.10.1.PBR Material Logic with UNIQUE emissive baseline preservation
    if (gltf.scene?.isObject3D) {
      gltf.scene.traverse((obj: any) => {
        if (obj.isMesh && obj.material) {
          obj.frustumCulled = true;

          // Handle both single material and material arrays
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

          materials.forEach((m: THREE.MeshStandardMaterial) => {
            // Enable dithering for all land meshes
            m.dithering = true;

            // Determine biome-specific emissive intensity FIRST
            const name = (obj.name || '').toUpperCase();
            let baselineIntensity = 0.0;

            // SNOW_PEAK gets the brightest glow
            if (name.includes('SNOW_PEAK')) {
              baselineIntensity = 2.0;
            }
            // MYTHIC biomes get strong glow
            else if (name.includes('MYTHIC_VOID') || name.includes('MYTHIC_AETHER')) {
              baselineIntensity = 1.8;
            }
            // VOLCANIC_CRAG gets intense glow
            else if (name.includes('VOLCANIC_CRAG')) {
              baselineIntensity = 1.6;
            }
            // FOREST_VALLEY gets moderate glow
            else if (name.includes('FOREST_VALLEY')) {
              baselineIntensity = 1.4;
            }
            // DESERT_DUNE and ISLAND_ARCHIPELAGO get subtle glow
            else if (name.includes('DESERT_DUNE') || name.includes('ISLAND_ARCHIPELAGO')) {
              baselineIntensity = 1.3;
            }

            // Apply emissive settings if this mesh should glow
            if (baselineIntensity > 0.0) {
              if (m.map) {
                m.emissiveMap = m.map;
              }
              m.emissive = new THREE.Color(0xffffff);
              
              // CRITICAL: Set the intensity FIRST
              m.emissiveIntensity = baselineIntensity;
              
              // THEN store it in userData for pulse scaling
              m.userData.baseEmissive = baselineIntensity;
              
              console.log(`[LandModel] ${name} emissive baseline: ${baselineIntensity}`);
            }

            // Environment Intensity (Reflection Boost)
            if (
              name.includes('MYTHIC_AETHER') ||
              name.includes('MYTHIC_VOID') ||
              name.includes('FOREST_VALLEY') ||
              name.includes('DESERT_DUNE') ||
              name.includes('ISLAND_ARCHIPELAGO')
            ) {
              m.envMapIntensity = 2.0;
            } else if (name.includes('VOLCANIC_CRAG')) {
              m.envMapIntensity = 1.3;
            } else {
              m.envMapIntensity = 1.0;
            }

            // PBR Guard: Do NOT manually set roughness/metalness if roughnessMap exists
            // Let textures drive the surface
          });
        }
      });
    }

    // Execute Box3 and camera auto-fit logic once
    if (!fittedRef.current && camera instanceof THREE.PerspectiveCamera) {
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5;

      camera.position.set(center.x, center.y, center.z + cameraZ);
      camera.lookAt(center);
      camera.updateProjectionMatrix();

      fittedRef.current = true;
      console.log('[LandModel] Camera auto-fit completed');
    }

    isInitialized.current = true;
    console.log('[LandModel] V.10.1.PBR processing completed with unique emissive baselines and dithering');
  }, [gltf, camera, modelUrl]);

  // Emissive pulse animation - scales each biome's UNIQUE baseline
  useFrame((state) => {
    if (!group.current) return;

    // Calculate a subtle synchronized pulse factor (all biomes breathe together)
    const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;

    // Traverse and scale each material's unique baseEmissive
    group.current.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        // Handle both single material and material arrays
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

        materials.forEach((m: THREE.MeshStandardMaterial) => {
          if (m.userData?.baseEmissive !== undefined) {
            // This correctly scales 2.0 for Snow, 1.3 for Plains, etc.
            m.emissiveIntensity = m.userData.baseEmissive * pulse;
          }
        });
      }
    });
  });

  if (!gltf || !gltf.scene) {
    console.warn('[LandModel] No valid scene to render');
    return null;
  }

  return <group ref={group}><primitive object={gltf.scene} /></group>;
}
