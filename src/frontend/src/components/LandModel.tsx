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

    console.log('[LandModel] Processing model with native PBR emissive workflow:', modelUrl);

    // SAFETY: Call updateMatrixWorld BEFORE Box3 calculation
    gltf.scene.updateMatrixWorld();

    // Native PBR Emissive Material Logic
    if (gltf.scene?.isObject3D) {
      gltf.scene.traverse((obj: any) => {
        if (obj.isMesh && obj.material) {
          obj.frustumCulled = true;

          // Handle both single material and material arrays
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

          materials.forEach((m: THREE.MeshStandardMaterial) => {
            // Enable dithering for all land meshes
            m.dithering = true;

            // CONDITIONAL EMISSIVE LOGIC
            if (obj.material.emissiveMap) {
              // Model HAS an emissive map
              m.emissiveMap = obj.material.emissiveMap;
              m.emissive = new THREE.Color(0xffffff);
              m.userData.baseEmissive = 2.2;
            } else {
              // Model HAS NO emissive map - DISABLE glow completely
              m.emissive = new THREE.Color(0x000000);
              m.userData.baseEmissive = 0.0;
            }

            console.log(`[LandModel] Emissive applied: hasMap=${!!obj.material.emissiveMap}, baseEmissive=${m.userData.baseEmissive}`);

            // Determine biome-specific environment settings
            const name = (obj.name || '').toUpperCase();

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
    console.log('[LandModel] Native PBR emissive processing completed');
  }, [gltf, camera, modelUrl]);

  // SYNCED PULSE IN useFrame - Subtle breathing effect
  useFrame((state) => {
    if (!group.current) return;

    // Calculate a subtle synchronized pulse factor (0.25 amplitude)
    const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 0.8) * 0.25;

    // Traverse and apply pulse to all materials with baseEmissive
    group.current.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        // Handle both single material and material arrays
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

        materials.forEach((m: THREE.MeshStandardMaterial) => {
          if (m.userData.baseEmissive !== undefined && m.userData.baseEmissive > 0) {
            m.emissiveIntensity = m.userData.baseEmissive * pulse;
          }
        });
      }
    });
  });

  return <primitive ref={group} object={gltf.scene} />;
}
