import React, { useRef, useEffect, useState } from 'react';
// @ts-ignore
import { useSpring } from 'https://esm.sh/react-spring';
// @ts-ignore
import { useDrag, usePinch, useWheel } from 'https://esm.sh/@use-gesture/react';
import { useActor } from '../hooks/useActor';
import { useQuery } from '@tanstack/react-query';
import type { LandData } from '@/backend';
import { X } from 'lucide-react';

interface MapViewProps {
  landData: LandData;
  onClose: () => void;
}

const MapView: React.FC<MapViewProps> = ({ landData, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { actor } = useActor();

  // Fetch all lands for the map
  const { data: lands } = useQuery<LandData[]>({
    queryKey: ['landData'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.getLandData();
    },
    enabled: !!actor,
  });

  const userPrincipal = landData.principal.toString();

  // Calculate starting position with corrected coordinates
  const ownerLand = lands?.find(l => l.principal?.toString() === userPrincipal);
  const startX = ownerLand?.coordinates?.lon ? -(ownerLand.coordinates.lon * 5.68) : 0;
  const startY = ownerLand?.coordinates?.lat ? (ownerLand.coordinates.lat * 5.68) : 0;

  // Spring physics with smooth momentum (mass: 1, tension: 120, friction: 14)
  const [{ x, y, scale }, api] = useSpring(() => ({
    x: startX,
    y: startY,
    scale: 1.2,
    config: { mass: 1, tension: 120, friction: 14 }
  }));

  // Update spring when owner land changes
  useEffect(() => {
    if (ownerLand) {
      const newX = -(ownerLand.coordinates.lon * 5.68);
      const newY = ownerLand.coordinates.lat * 5.68;
      api.start({ x: newX, y: newY });
    }
  }, [ownerLand, api]);

  // Drag gesture handler with momentum (no immediate flag)
  useDrag(
    ({ offset: [ox, oy] }) => {
      api.start({ x: ox, y: oy });
    },
    {
      target: canvasRef,
      from: () => [x.get(), y.get()],
    }
  );

  // Pinch gesture handler with momentum
  usePinch(
    ({ offset: [s] }) => {
      api.start({ scale: Math.max(0.5, Math.min(3, s)) });
    },
    {
      target: canvasRef,
      scaleBounds: { min: 0.5, max: 3 },
      rubberband: true,
    }
  );

  // Wheel gesture handler with momentum
  useWheel(
    ({ delta: [, dy] }) => {
      const currentScale = scale.get();
      const newScale = currentScale * (dy > 0 ? 0.95 : 1.05);
      api.start({ scale: Math.max(0.5, Math.min(3, newScale)) });
    },
    {
      target: canvasRef,
    }
  );

  // Load map image with onload event
  useEffect(() => {
    const img = new Image();
    img.src = 'https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/LandMap/IMG_8296.webp';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      console.log('Map image loaded successfully');
    };
    img.onerror = () => {
      console.error('Failed to load map image');
    };
  }, []);

  // Biome color mapping
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
        return '#ffaa00';
      case 'VOLCANIC_CRAG':
        return '#ff3300';
      default:
        return '#ffffff';
    }
  };

  // FINAL ENGINE FIX: Continuous rendering loop with requestAnimationFrame
  useEffect(() => {
    if (!imageLoaded || !imageRef.current || !lands) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;

    // Set canvas size to match image
    canvas.width = img.width;
    canvas.height = img.height;

    const animate = () => {
      // Extract current spring values for rendering
      const currentX = x.get();
      const currentY = y.get();
      const currentS = scale.get();

      // PREVENT MOTION BLUR: Clear entire canvas before drawing
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save context state
      ctx.save();

      // Apply transform
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(currentS, currentS);
      ctx.translate(currentX, currentY);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // Draw map image
      ctx.drawImage(img, 0, 0);

      // Draw land beams
      const mapCenterX = canvas.width / 2;
      const mapCenterY = canvas.height / 2;

      lands.forEach(land => {
        const landX = mapCenterX + land.coordinates.lon * 5.68;
        const landY = mapCenterY - land.coordinates.lat * 5.68;

        const isOwner = land.principal.toString() === userPrincipal;
        const biomeColor = getBiomeColor(land.biome);

        ctx.save();

        if (isOwner) {
          // Owner's beam: enhanced with biome-colored glow
          ctx.shadowBlur = 50;
          ctx.shadowColor = biomeColor;
          ctx.strokeStyle = biomeColor;
          ctx.lineWidth = 4;
        } else {
          // Others: subtle white beams
          ctx.globalAlpha = 0.2;
          ctx.shadowBlur = 20;
          ctx.shadowColor = 'white';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
        }

        // Draw vertical beam
        ctx.beginPath();
        ctx.moveTo(landX, landY);
        ctx.lineTo(landX, landY - (isOwner ? 300 : 100));
        ctx.stroke();

        ctx.restore();
      });

      // Restore context state
      ctx.restore();

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // ACTIVATE ANIMATION LOOP: Invoke manually with requestAnimationFrame
    requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [imageLoaded, lands, userPrincipal, x, y, scale]);

  // Show black background fallback until image loads
  if (!imageLoaded || !lands) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="text-[#00ffff] text-xl animate-pulse font-orbitron">
          {!imageLoaded ? 'Loading map image...' : 'Loading land data...'}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      {/* Close button fixed at top-10 right-10 with z-[10000] */}
      <button
        onClick={onClose}
        className="absolute top-10 right-10 z-[10000] glassmorphism px-6 py-3 rounded-lg border border-[#00ffff]/50 hover:border-[#00ffff] transition-all duration-300 group"
        style={{
          boxShadow: '0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)'
        }}
      >
        <X className="w-6 h-6 text-[#00ffff] group-hover:text-white transition-colors" />
      </button>

      {/* Canvas occupies fixed inset-0 fullscreen area */}
      <canvas 
        ref={canvasRef} 
        className="fixed inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        style={{ 
          touchAction: 'none',
          imageRendering: 'crisp-edges'
        }} 
      />
    </div>
  );
};

export default MapView;
