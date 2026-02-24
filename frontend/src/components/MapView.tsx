import React, { useRef, useEffect, useState } from 'react';
import { useActor } from '../hooks/useActor';
import { useQuery } from '@tanstack/react-query';
import type { LandData } from '@/backend';
import { X } from 'lucide-react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';

interface MapViewProps {
  landData: LandData;
  onClose: () => void;
}

// Extend Window interface for Maptalks
declare global {
  interface Window {
    maptalks?: any;
  }
}

const MapView: React.FC<MapViewProps> = ({ landData, onClose }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const hasAnimated = useRef(false);
  const [maptalksSdkLoaded, setMaptalksSdkLoaded] = useState(false);
  const { actor } = useActor();
  const { identity } = useInternetIdentity();

  // Fetch all lands for the map
  const { data: lands } = useQuery<LandData[]>({
    queryKey: ['landData'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.getLandData();
    },
    enabled: !!actor,
  });

  const userPrincipal = identity?.getPrincipal().toString();

  // Load Maptalks.js via CDN
  useEffect(() => {
    const loadMaptalks = async () => {
      if (window.maptalks) {
        setMaptalksSdkLoaded(true);
        return;
      }

      // Load CSS
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://cdn.jsdelivr.net/npm/maptalks@1.0.0-rc.28/dist/maptalks.css';
      document.head.appendChild(cssLink);

      // Load JS
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/maptalks@1.0.0-rc.28/dist/maptalks.min.js';
      script.async = false;

      script.onload = () => {
        setTimeout(() => {
          if (window.maptalks) {
            setMaptalksSdkLoaded(true);
          }
        }, 100);
      };

      script.onerror = () => {
        console.error('Failed to load Maptalks.js');
      };

      document.head.appendChild(script);
    };

    loadMaptalks();
  }, []);

  // Biome color mapping for neon rays
  const getBiomeColor = (biome: string): string => {
    switch (biome) {
      case 'MYTHIC_VOID':
        return '#9933FF';
      case 'MYTHIC_AETHER':
        return '#00FFFF';
      case 'ISLAND_ARCHIPELAGO':
        return '#00aaff';
      case 'FOREST_VALLEY':
        return '#00ff41';
      case 'SNOW_PEAK':
        return '#ffffff';
      case 'DESERT_DUNE':
        return '#FF8800';
      case 'VOLCANIC_CRAG':
        return '#ff3300';
      default:
        return '#ffffff';
    }
  };

  // Initialize Maptalks map (only after SDK is loaded)
  useEffect(() => {
    if (mapRef.current) {
      return;
    }

    if (!maptalksSdkLoaded || !window.maptalks || !mapContainerRef.current || !lands) {
      return;
    }

    try {
      // REQ-2: Map initialization with 2056×2056 identity projection
      const map = new window.maptalks.Map(mapContainerRef.current, {
        center: [1028, -1028],
        zoom: 2,
        pitch: 0,
        bearing: 0,
        devicePixelRatio: window.devicePixelRatio || 2,
        spatialReference: {
          projection: 'identity',
          resolutions: [32, 16, 8, 4, 2, 1, 0.5],
          fullExtent: { top: 0, left: 0, bottom: -2056, right: 2056 },
        },
        draggable: true,
        dragPan: true,
        dragRotate: false,
        dragPitch: false,
        touchZoomRotate: false,
        dragInertia: true,
        panLimit: true,
        panLimitViscosity: 0,
      });

      // REQ-1: ImageLayer with new 2056×2056 asset
      const imageLayer = new window.maptalks.ImageLayer(
        'base-layer',
        [
          {
            url: 'https://raw.githubusercontent.com/dobr312/cyberland/main/CyberMap/IMG_0133.webp',
            extent: [0, -2056, 2056, 0],
            opacity: 1,
            renderer: 'canvas',
            crossOrigin: 'anonymous',
          },
        ],
        {
          forceRenderOnMoving: true,
        }
      );

      imageLayer.addTo(map);

      // REQ-5: Create neon ray markers using 1028-offset formula
      const markers: any[] = [];

      lands.forEach((land) => {
        const isOwner = land.principal.toString() === userPrincipal;
        const biomeColor = getBiomeColor(land.biome);

        // 1028-offset coordinate formula for 2056×2056 space
        const mapX = 1028 + (land.coordinates.lon / 180) * 1028;
        const mapY = 1028 + (land.coordinates.lat / 90) * 1028;

        const beamWidth = isOwner ? 2.5 : 0.8;
        const beamHeight = 150;
        const opacity = isOwner ? 1.0 : 0.3;

        const rayHTML = `
          <div style="
            width: ${beamWidth}px;
            height: ${beamHeight}px;
            background: linear-gradient(to top, ${biomeColor}, transparent);
            opacity: ${opacity};
            box-shadow: 0 0 ${beamWidth * 4}px ${biomeColor}, 0 0 ${beamWidth * 8}px ${biomeColor};
            transform: translateX(-50%);
            pointer-events: none;
          "></div>
        `;

        const marker = new window.maptalks.ui.UIMarker([mapX, -mapY], {
          content: rayHTML,
          verticalAlignment: 'bottom',
          eventsPropagation: false,
        });

        markers.push(marker);
        marker.addTo(map);
      });

      markersRef.current = markers;

      // REQ-3 & REQ-4: Bulletproof pinning + cinematic drone flight on first idle
      map.on('idle', () => {
        const container = mapContainerRef.current;
        if (container && container.clientWidth > 0 && !hasAnimated.current) {
          const vW = container.clientWidth;
          const vH = container.clientHeight;
          const mapSize = 2056;

          // Manual "cover" resolution calculation
          const targetRes = Math.min(mapSize / vW, mapSize / vH);
          const minZoomLevel = Math.log2(32 / targetRes);

          // Pin edges: set minZoom and snap current zoom
          map.setMinZoom(minZoomLevel);
          map.setZoom(minZoomLevel);

          // Find owner land for drone flight target
          const ownerLand = lands.find((l) => l.principal?.toString() === userPrincipal);

          // Integrated animation — no separate useEffect
          if (ownerLand) {
            const lon = ownerLand.coordinates.lon;
            const lat = ownerLand.coordinates.lat;
            const targetX = 1028 + (lon / 180) * 1028;
            const targetY = 1028 + (lat / 90) * 1028;

            setTimeout(() => {
              map.animateTo(
                {
                  center: [targetX, -targetY],
                  zoom: minZoomLevel + 2,
                },
                {
                  duration: 3500,
                  easing: 'out',
                }
              );
            }, 200);
          }

          hasAnimated.current = true;
        }
      });

      mapRef.current = map;
    } catch (error) {
      console.error('Error initializing Maptalks map:', error);
    }

    // Cleanup on unmount
    return () => {
      if (markersRef.current.length > 0) {
        markersRef.current.forEach((marker) => {
          try {
            marker.remove();
          } catch (e) {
            // ignore
          }
        });
        markersRef.current = [];
      }

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.error('Error removing map:', e);
        }
        mapRef.current = null;
      }
    };
  }, [maptalksSdkLoaded, lands, userPrincipal]);

  // Show loading screen
  if (!maptalksSdkLoaded || !lands) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: '#000' }}
        className="flex items-center justify-center"
      >
        <div className="text-[#00ffff] text-xl animate-pulse font-orbitron">
          {!maptalksSdkLoaded ? 'Загрузка библиотеки Maptalks...' : 'Загрузка данных земель...'}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 1000,
        backgroundColor: '#000',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-10 right-10 glassmorphism px-6 py-3 rounded-lg border border-[#00ffff]/50 hover:border-[#00ffff] transition-all duration-300 group"
        style={{
          zIndex: 100,
          boxShadow: '0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)',
        }}
      >
        <X className="w-6 h-6 text-[#00ffff] group-hover:text-white transition-colors" />
      </button>

      {/* Map container */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100vw',
          height: '100dvh',
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: '#000',
          zIndex: 0,
        }}
      />
    </div>
  );
};

export default MapView;
