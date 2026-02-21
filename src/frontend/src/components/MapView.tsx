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
  const [debugMsg, setDebugMsg] = useState('Initializing...');
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
        setDebugMsg('Maptalks SDK already loaded');
        setMaptalksSdkLoaded(true);
        return;
      }

      setDebugMsg('Loading Maptalks SDK...');

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
        setDebugMsg('Maptalks SDK loaded successfully');
        // Wait a bit to ensure the library is fully initialized
        setTimeout(() => {
          if (window.maptalks) {
            setMaptalksSdkLoaded(true);
            setDebugMsg('SDK ready, waiting for map init...');
          } else {
            console.error('Maptalks loaded but not available on window');
            setDebugMsg('ERROR: SDK loaded but not on window');
          }
        }, 100);
      };

      script.onerror = () => {
        console.error('Failed to load Maptalks.js');
        setDebugMsg('ERROR: Failed to load Maptalks SDK');
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
      setDebugMsg('Map already initialized (duplicate prevented)');
      return;
    }

    if (!maptalksSdkLoaded || !window.maptalks || !mapContainerRef.current || !lands) {
      console.log('Waiting for dependencies:', {
        maptalksSdkLoaded,
        maptalks: !!window.maptalks,
        container: !!mapContainerRef.current,
        lands: !!lands,
      });
      setDebugMsg(
        `Waiting: SDK=${maptalksSdkLoaded} MT=${!!window.maptalks} CNT=${!!mapContainerRef.current} LANDS=${!!lands}`
      );
      return;
    }

    console.log('Initializing Maptalks map with', lands.length, 'lands...');
    setDebugMsg('Creating map instance...');

    try {
      // Create map with identity projection and POSITIVE coordinates
      const map = new window.maptalks.Map(mapContainerRef.current, {
        center: [1704, 961], // Center of the image (positive Y)
        zoom: 1, // SAFE ZOOM: Changed from -1 to 1 for closer view
        minZoom: -3,
        maxZoom: 2,
        pitch: 0, // SAFE PITCH: Changed from 30 to 0 for flat overhead view
        bearing: 0,
        centerCross: false,
        spatialReference: {
          projection: 'identity',
        },
        maxExtent: [0, 0, 3408, 1922], // Positive coordinate quadrant
        draggable: true,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: false,
        dragPan: true,
        dragRotate: false,
        attribution: false,
      });

      // Capture map size after 500ms
      setTimeout(() => {
        if (mapRef.current) {
          const width = mapRef.current.getSize().width;
          const height = mapRef.current.getSize().height;
          setDebugMsg(`Map Size: ${width}x${height}`);
          console.log('Map dimensions:', width, 'x', height);
        }
      }, 500);

      // Add ImageLayer with matching extent
      const imageLayer = new window.maptalks.ImageLayer('base-layer', [
        {
          url: 'https://raw.githubusercontent.com/dobr312/cyberland/main/CyberMap/IMG_8296.webp',
          extent: [0, 0, 3408, 1922], // Exact match with map extent
          opacity: 1,
        },
      ]);

      // Add error listener for image loading
      imageLayer.on('resourceloaderror', () => {
        console.error('Image failed to load');
        setDebugMsg('IMAGE LOAD ERROR (CORS or Link)');
      });

      // Add success listener for image loading
      imageLayer.on('layerload', () => {
        console.log('Image loaded successfully');
        setDebugMsg('IMAGE LOADED OK');
      });

      imageLayer.addTo(map);

      // Create neon ray markers using UIMarker
      const markers: any[] = [];

      lands.forEach((land) => {
        const isOwner = land.principal.toString() === userPrincipal;
        const biomeColor = getBiomeColor(land.biome);

        // Convert lat/lon to positive map coordinates
        // Map coordinates: X from 0 to 3408, Y from 0 to 1922
        const mapX = 1704 + (land.coordinates.lon / 180) * 1704;
        const mapY = 961 + (land.coordinates.lat / 90) * 961; // Positive Y

        // Neon ray dimensions
        const beamWidth = isOwner ? 2.5 : 0.8;
        const beamHeight = 150;
        const opacity = isOwner ? 1.0 : 0.3;

        // Create vertical neon ray with CSS gradient
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

        const marker = new window.maptalks.ui.UIMarker([mapX, mapY], {
          content: rayHTML,
          verticalAlignment: 'bottom',
          eventsPropagation: false,
        });

        markers.push(marker);
        marker.addTo(map);
      });

      markersRef.current = markers;

      // Fly to user's land
      const ownerLand = lands.find((l) => l.principal?.toString() === userPrincipal);
      if (ownerLand) {
        const targetX = 1704 + (ownerLand.coordinates.lon / 180) * 1704;
        const targetY = 961 + (ownerLand.coordinates.lat / 90) * 961; // Positive Y

        setTimeout(() => {
          map.animateTo(
            {
              center: [targetX, targetY],
              zoom: 0,
              pitch: 0,
            },
            {
              duration: 2000,
              easing: 'out',
            }
          );
        }, 500);
      }

      mapRef.current = map;

      console.log('Maptalks map initialized successfully with', markers.length, 'neon rays');
    } catch (error) {
      console.error('Error initializing Maptalks map:', error);
      setDebugMsg(`ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      className="fixed inset-0 z-[9999]"
      style={{
        width: '100vw',
        height: '100vh',
        position: 'absolute',
        top: 0,
        left: 0,
        background: '#000',
        overflow: 'hidden',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-10 right-10 z-[10000] glassmorphism px-6 py-3 rounded-lg border border-[#00ffff]/50 hover:border-[#00ffff] transition-all duration-300 group"
        style={{
          boxShadow: '0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)',
        }}
      >
        <X className="w-6 h-6 text-[#00ffff] group-hover:text-white transition-colors" />
      </button>

      {/* ON-SCREEN DEBUG UI - Visible on tablet without DevTools */}
      <div
        style={{
          position: 'absolute',
          top: '80px',
          left: '20px',
          color: 'lime',
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 9999,
          fontFamily: 'monospace',
          fontSize: '14px',
          maxWidth: '90vw',
          wordBreak: 'break-word',
        }}
      >
        DEBUG: {debugMsg}
      </div>

      {/* Map container with FOOLPROOF inline styles */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100vw',
          height: '100vh',
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
