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
      // Check if already loaded
      if (window.maptalks) {
        console.log('Maptalks already loaded');
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
        console.log('Maptalks.js loaded successfully');
        // Wait a bit to ensure the library is fully initialized
        setTimeout(() => {
          if (window.maptalks) {
            setMaptalksSdkLoaded(true);
          } else {
            console.error('Maptalks loaded but not available on window');
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
    // SECURITY: Strict Mode protection - prevent duplicate map instances
    if (mapRef.current) {
      console.log('Map already initialized, skipping duplicate initialization');
      return;
    }

    if (!maptalksSdkLoaded || !window.maptalks || !mapContainerRef.current || !lands) {
      console.log('Waiting for dependencies:', {
        maptalksSdkLoaded,
        maptalks: !!window.maptalks,
        container: !!mapContainerRef.current,
        lands: !!lands,
      });
      return;
    }

    console.log('Initializing Maptalks map with', lands.length, 'lands...');

    try {
      // GOLDEN ARCHIVE FIX #1: Identity Projection & The "Cage" (Boundaries)
      const map = new window.maptalks.Map(mapContainerRef.current, {
        center: [1704, -961],
        zoom: 1,
        minZoom: 0,
        maxZoom: 5,
        pitch: 45,
        bearing: 0,
        centerCross: false,
        devicePixelRatio: window.devicePixelRatio || 2,

        spatialReference: {
          projection: 'identity',
          resolutions: [32, 16, 8, 4, 2, 1],
          fullExtent: {
            top: 0,
            left: 0,
            bottom: -1922,
            right: 3408,
          },
        },
        maxExtent: new window.maptalks.Extent(0, -1922, 3408, 0),

        draggable: true,
        dragPan: true,
        dragRotate: true,
        dragPitch: true,
        touchZoom: true,
        touchRotate: true,
        touchPitch: true,

        dragInertia: true,
        seamlessZoom: true,
        attribution: false,
      });

      map.config('panLimit', true);

      // GOLDEN ARCHIVE FIX #2: Image Layer Optimization
      const imageLayer = new window.maptalks.ImageLayer('base-layer', [
        {
          url: 'https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/CyberMap/IMG_8296.webp',
          extent: [0, -1922, 3408, 0],
          opacity: 1,
          renderer: 'canvas',
          crossOrigin: 'anonymous',
        },
      ], {
        forceRenderOnMoving: true,
      });

      // Add error listener for image loading
      imageLayer.on('resourceloaderror', () => {
        console.error('Image failed to load');
      });

      // Add success listener for image loading
      imageLayer.on('layerload', () => {
        console.log('Image loaded successfully');
      });

      imageLayer.addTo(map);

      // Create neon ray markers using UIMarker with flipped Y coordinates
      const markers: any[] = [];

      lands.forEach((land) => {
        const isOwner = land.principal.toString() === userPrincipal;
        const biomeColor = getBiomeColor(land.biome);

        // Convert lat/lon to map coordinates with FLIPPED Y
        const mapX = 1704 + (land.coordinates.lon / 180) * 1704;
        const mapY = 961 + (land.coordinates.lat / 90) * 961;

        // Neon ray dimensions
        const beamWidth = isOwner ? 2.5 : 0.8;
        const beamHeight = 150;
        const opacity = isOwner ? 1.0 : 0.3;

        // Create vertical neon ray with CSS gradient and pointer-events: none
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

        // Position with NEGATIVE Y to align with flipped coordinate system
        const marker = new window.maptalks.ui.UIMarker([mapX, -mapY], {
          content: rayHTML,
          verticalAlignment: 'bottom',
          eventsPropagation: false,
        });

        markers.push(marker);
        marker.addTo(map);
      });

      markersRef.current = markers;

      // GOLDEN ARCHIVE FIX #3: Cinematic Drone Entry (Animation)
      const ownerLand = lands.find((l) => l.principal?.toString() === userPrincipal);
      if (ownerLand) {
        const targetX = 1704 + (ownerLand.coordinates.lon / 180) * 1704;
        const targetY = 961 + (ownerLand.coordinates.lat / 90) * 961;

        setTimeout(() => {
          map.animateTo(
            {
              center: [targetX, -targetY],
              zoom: 3,
              pitch: 55,
              bearing: 15,
            },
            {
              duration: 3500,
              easing: 'out',
            }
          );
        }, 500);
      }

      mapRef.current = map;

      console.log('Maptalks map initialized successfully with', markers.length, 'neon rays');
    } catch (error) {
      console.error('Error initializing Maptalks map:', error);
    }

    // CLEANUP: Strict cleanup function to remove map on unmount
    return () => {
      console.log('Cleaning up Maptalks map...');

      // Remove all markers
      if (markersRef.current.length > 0) {
        markersRef.current.forEach((marker) => {
          try {
            marker.remove();
          } catch (e) {
            console.warn('Error removing marker:', e);
          }
        });
        markersRef.current = [];
      }

      // Remove map instance
      if (mapRef.current) {
        try {
          mapRef.current.remove();
          console.log('Map removed successfully');
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
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
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
        background: '#000',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      {/* Close button with z-index 100 */}
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

      {/* Map container with GOLDEN ARCHIVE FIX #4: Mobile Viewport Fix (CSS) */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100vw',
          height: '100dvh',
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: '#111',
          zIndex: 0,
        }}
      />
    </div>
  );
};

export default MapView;
