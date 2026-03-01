import React, { useEffect, useRef } from 'react';
// Библиотеки подтягиваются через CDN, поэтому используем window.L
import { useActor } from '../hooks/useActor';
import { useQuery } from '@tanstack/react-query';

const MAP_SIZE = 2560;
const RAW_MAP_URL = 'https://raw.githubusercontent.com/dobr312/cyberland/main/CyberMap/IMG_0133.webp';

declare global {
  interface Window {
    L?: any;
  }
}

const getBiomeColor = (biome: string): string => {
  const colors: Record<string, string> = {
    'MYTHIC_VOID': '#9933FF',
    'MYTHIC_AETHER': '#00FFFF',
    'VOLCANIC_CRAG': '#ff3300',
    'DESERT_DUNE': '#FF8800',
    'FOREST_VALLEY': '#00ff41',
    'SNOW_PEAK': '#ffffff',
    'DEFAULT': '#00aaff'
  };
  return colors[biome] || colors['DEFAULT'];
};

const MapView = ({ onClose }: { onClose: () => void }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const { actor } = useActor();

  // Получаем данные о землях
  const { data: lands } = useQuery({
    queryKey: ['landData'],
    queryFn: () => actor?.getLandData(),
    enabled: !!actor,
  });

  useEffect(() => {
    // Проверка на наличие контейнера и Leaflet в window
    if (!mapContainerRef.current || mapRef.current || !window.L) return;

    const L = window.L;

    // 1. Настройка ИГРОВОГО движка (Simple CRS - пиксельная сетка)
    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -1, // Позволяет чуть отдалить, чтобы видеть всю карту
      maxZoom: 2,
      zoomControl: false,
      attributionControl: false,
      inertia: true
    });

    mapRef.current = map;

    // 2. Установка границ 1:1 к твоей картинке
    const bounds: [[number, number], [number, number]] = [[0, 0], [MAP_SIZE, MAP_SIZE]];

    // Накладываем твою карту как игровой слой
    L.imageOverlay(RAW_MAP_URL, bounds).addTo(map);

    // Центрируем камеру и запрещаем улетать за края
    map.fitBounds(bounds);
    map.setMaxBounds(bounds);

    // 3. Отрисовка Неон-Лучей
    if (lands) {
      lands.forEach((land: any) => {
        const color = getBiomeColor(land.biome);

        // Линия от центра (вихря) к координатам участка
        // Координаты land.y и land.x теперь должны быть просто пикселями на картинке
        L.polyline([[1280, 1280], [land.y, land.x]], {
          color: color,
          weight: 2,
          opacity: 0.8,
          className: `neon-beam-${land.biome.toLowerCase()}`
        }).addTo(map);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lands]);

  return (
    <div style={containerStyle}>
      {/* Основной контейнер карты */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#000' }} />

      {/* Кнопка закрытия */}
      <button onClick={onClose} style={closeButtonStyle}>✕</button>

      {/* CSS Эффекты Неона (GPU ускорение) */}
      <style>{`
        .leaflet-container { background: #000 !important; cursor: grab; }
        .leaflet-container:active { cursor: grabbing; }
        
        ${['MYTHIC_VOID', 'VOLCANIC_CRAG', 'DESERT_DUNE', 'MYTHIC_AETHER', 'FOREST_VALLEY'].map(b => `
          .neon-beam-${b.toLowerCase()} {
            filter: drop-shadow(0 0 6px ${getBiomeColor(b)});
            stroke-linecap: round;
            stroke-linejoin: round;
          }
        `).join('')}
      `}</style>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  background: '#000',
  overflow: 'hidden'
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '30px',
  right: '30px',
  zIndex: 10001,
  padding: '12px 24px',
  background: 'rgba(0,0,0,0.7)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '12px',
  cursor: 'pointer',
  fontSize: '18px',
  backdropFilter: 'blur(10px)'
};

export default MapView;
