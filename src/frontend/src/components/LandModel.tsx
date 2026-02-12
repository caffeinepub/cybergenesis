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
    // Use CDN-hosted basis transcoder from three.js examples
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

    // Complete material traversal with enhanced logic
    gltf.scene.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        obj.frustumCulled = true;
        const m = obj.material as THREE.MeshStandardMaterial;

        // 1. Preserve existing albedo remap: Fix overexposed white patches
        if (m.color.r >= 0.8 && m.color.g >= 0.8 && m.color.b >= 0.8) {
          m.color.setScalar(0.7);
        }

        // 2. Preserve selective emissive: Remove baked light or enhance true neon/lava elements
        const emissiveAvg = (m.emissive.r + m.emissive.g + m.emissive.b) / 3;
        if (emissiveAvg < 0.1) {
          // Remove baked light
          m.emissive.setHex(0x000000);
          m.emissiveIntensity = 0;
        } else {
          // Keep or enhance true neon/lava emissive elements
          m.emissiveIntensity = 2.0;
        }

        // 3. Preserve light map removal
        m.lightMap = null;
        m.lightMapIntensity = 0;

        // 4. Biome-aware envMapIntensity adjustment
        if (modelUrl.includes('VOID') || obj.name.includes('VOID')) {
          m.envMapIntensity = 0.8;
        } else {
          m.envMapIntensity = 0.3;
        }

        // Do not modify roughness or metalness - preserve GLB export values
        m.needsUpdate = true;
      }
    });

    // Execute Box3 and camera auto-fit logic once inside the guarded block
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

    // After processing, set isInitialized.current = true to lock further updates
    isInitialized.current = true;
    console.log('[LandModel] Model processing completed and locked');
  }, [gltf, camera, modelUrl]);

  if (!gltf || !gltf.scene) {
    console.warn('[LandModel] No valid scene to render');
    return null;
  }

  return <primitive object={gltf.scene} />;
}
