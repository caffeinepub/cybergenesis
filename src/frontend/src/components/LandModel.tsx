import { useEffect, useMemo, useRef } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
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

    // V.10.1.PBR Material Logic
    if (gltf.scene?.isObject3D) {
      gltf.scene.traverse((obj: any) => {
        if (obj.isMesh && obj.material) {
          obj.frustumCulled = true;
          const m = obj.material as THREE.MeshStandardMaterial;

          // Glow List: Emissive 2.0 for specific biomes
          const name = (obj.name || '').toUpperCase();
          const isGlowBiome = 
            name.includes('MYTHIC_VOID') ||
            name.includes('MYTHIC_AETHER') ||
            name.includes('FOREST_VALLEY') ||
            name.includes('DESERT_DUNE') ||
            name.includes('ISLAND_ARCHIPELAGO') ||
            name.includes('VOLCANIC_CRAG');

          if (isGlowBiome) {
            if (m.map) {
              m.emissiveMap = m.map;
            }
            m.emissive = new THREE.Color(0xffffff);
            m.emissiveIntensity = 2.0;
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
    console.log('[LandModel] V.10.1.PBR processing completed and locked');
  }, [gltf, camera, modelUrl]);

  if (!gltf || !gltf.scene) {
    console.warn('[LandModel] No valid scene to render');
    return null;
  }

  return <primitive object={gltf.scene} />;
}
