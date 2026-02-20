import { useEffect, useMemo, useRef } from 'react';
import { useLoader, useThree, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import * as THREE from 'three';

interface LandModelProps {
  modelUrl: string;
  biome?: string;
}

export default function LandModel({ modelUrl, biome }: LandModelProps) {
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

    console.log('[LandModel] Processing model with biome-specific lighting and max anisotropy:', modelUrl, 'Biome:', biome);

    // SAFETY: Call updateMatrixWorld BEFORE Box3 calculation
    gltf.scene.updateMatrixWorld();

    // Get maximum anisotropy capability
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
    console.log('[LandModel] Maximum anisotropy capability:', maxAnisotropy);

    // Determine land type from biome prop
    const landType = biome || 'DEFAULT';

    // Biome-specific lighting configuration
    const settings: Record<string, { env: number; emissive: number }> = {
      MYTHIC_VOID: { env: 3.0, emissive: 7.5 },
      ISLAND_ARCHIPELAGO: { env: 3.0, emissive: 6.0 },
      DESERT_DUNE: { env: 1.0, emissive: 6.2 },
      VOLCANIC_CRAG: { env: 1.5, emissive: 6.6 },
      FOREST_VALLEY: { env: 1.0, emissive: 2.5 },
      MYTHIC_AETHER: { env: 1.0, emissive: 5.5 },
      DEFAULT: { env: 1.0, emissive: 3.2 }
    };

    const config = settings[landType] || settings.DEFAULT;
    console.log('[LandModel] Applying biome config:', landType, config);

    // Native PBR Emissive Material Logic + Texture Anisotropy + Biome-specific settings
    if (gltf.scene?.isObject3D) {
      gltf.scene.traverse((obj: any) => {
        if (obj.isMesh && obj.material) {
          obj.frustumCulled = true;

          // Handle both single material and material arrays
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

          materials.forEach((m: THREE.MeshStandardMaterial) => {
            // Enable dithering for all land meshes
            m.dithering = true;

            // Apply biome-specific envMapIntensity
            m.envMapIntensity = config.env;

            // CONDITIONAL EMISSIVE LOGIC with biome-specific baseEmissive
            if (m.emissiveMap) {
              // Model HAS an emissive map
              m.emissive = new THREE.Color(0xffffff);
              m.userData.baseEmissive = config.emissive;
              console.log(`[LandModel] Emissive enabled: baseEmissive=${config.emissive}, envMapIntensity=${config.env}`);
            } else {
              // Model HAS NO emissive map - DISABLE glow completely
              m.emissive = new THREE.Color(0x000000);
              m.userData.baseEmissive = 0.0;
              console.log(`[LandModel] No emissive map detected, glow disabled`);
            }

            // Apply maximum anisotropic filtering to ALL textures
            const textures = [
              m.map,
              m.emissiveMap,
              m.normalMap,
              m.metalnessMap,
              m.roughnessMap
            ];

            textures.forEach(tex => {
              if (tex) {
                tex.anisotropy = maxAnisotropy;
                tex.needsUpdate = true;
              }
            });

            console.log(`[LandModel] Anisotropy applied to textures: ${textures.filter(t => t).length} textures updated`);
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
      console.log('[LandModel] Camera auto-fitted to model bounds');
    }

    isInitialized.current = true;
  }, [gltf, gl, camera, modelUrl, biome]);

  // Smart pulse animation using stored baseEmissive values
  useFrame((state) => {
    if (!gltf?.scene) return;

    const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 0.8) * 0.25;

    gltf.scene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];

        materials.forEach((m: THREE.MeshStandardMaterial) => {
          // Only apply pulse to materials with emissive map or color
          if (m.emissiveMap || (m.emissive && !m.emissive.equals(new THREE.Color(0x000000)))) {
            m.emissiveIntensity = (m.userData.baseEmissive || 3.2) * pulse;
          }
        });
      }
    });
  });

  return (
    <group ref={group}>
      <primitive object={gltf.scene} />
    </group>
  );
}
