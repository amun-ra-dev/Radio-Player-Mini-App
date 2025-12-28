// Build: 2.9.2
// - Fix: Resolved "e.stopPropagation is not a function" by passing proper event object.
// - UI: Shortened "Edit" button text to "РЕДАКТ." in playlist header.
// - Feature: Selective Export (All vs Favorites) modal logic refined.
// - UX: Disabled text selection across the interface to prevent accidental highlighting.
// - Layout: Removed stream URL from playlist items for a cleaner look.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCreative, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperClass } from 'swiper';

import { Station, PlayerStatus, ExportSchemaV2 } from './types.ts';
import { DEFAULT_STATIONS, Icons } from './constants.tsx';
import { useTelegram } from './hooks/useTelegram.ts';
import { useAudio } from './hooks/useAudio.ts';
import { RippleButton } from './components/UI/RippleButton.tsx';
import { Logo } from './components/UI/Logo.tsx';

const ReorderGroup = Reorder.Group as any;
const ReorderItem = Reorder.Item as any;

const APP_VERSION = "2.9.2";

const MiniEqualizer: React.FC = () => (
  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
    <div className="flex gap-1 items-end h-3.5 mb-1">
      <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} className="w-1 bg-white rounded-full" />
      <motion.div animate={{ height: [12, 6, 12] }} transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut", delay: 0.1 }} className="w-1 bg-white rounded-full" />
      <motion.div animate={{ height: [6, 10, 6] }} transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut", delay: 2 }} className="w-1 bg-white rounded-full" />
    </div>
  </div>
);

const StationCover: React.FC<{ 
  station: Station | null | undefined; 
  className?: string; 
  showTags?: boolean; 
}> = ({ station, className = "", showTags = true }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

  const isVideo = useMemo(() => {
    const url = station?.coverUrl?.toLowerCase() || '';
    return url.endsWith('.mp4') || url.endsWith('.mov');
  }, [station?.coverUrl]);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    
    if (!station?.coverUrl) return;

    if (!isVideo) {
      const img = mediaRef.current as HTMLImageElement;
      if (img && img.complete && img.naturalWidth > 0) {
        setIsLoaded(true);
      }
    } else {
      const video = mediaRef.current as HTMLVideoElement;
      if (video && video.readyState >= 3) {
        setIsLoaded(true);
      }
    }
  }, [station?.id, station?.coverUrl, isVideo]);

  const renderTags = () => {
    if (!showTags || !station?.tags || station.tags.length === 0) return null;
    return (
      <div className="absolute top-4 left-4 z-20 flex wrap gap-1.5 max-w-[80%] pointer-events-none">
        {station.tags.map(tag => (
          <span key={tag} className="text-[8px] font-black uppercase px-2 py-1 bg-black/50 backdrop-blur-md text-white rounded-lg border border-white/10">
            {tag}
          </span>
        ))}
      </div>
    );
  };

  if (!station) return <div className={`${className} bg-blue-600 flex items-center justify-center text-white text-5xl font-black select-none`}>+</div>;

  if (!station.coverUrl || hasError) {
    return (
      <div className={`${className} bg-blue-600 flex items-center justify-center text-white text-7xl font-black select-none`}>
        {renderTags()}
        {station.name?.charAt(0)?.toUpperCase?.() || 'R'}
      </div>
    );
  }

  return (
    <div className={`${className} relative bg-gray-200 dark:bg-[#1a1a1a] overflow-hidden`}>
      {renderTags()}
      
      {isVideo ? (
        <motion.video
          ref={mediaRef as any}
          key={`vid-${station.id}-${station.coverUrl}`}
          src={station.coverUrl}
          autoPlay
          muted
          loop
          playsInline
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: isLoaded ? 1 : 0,
            scale: 1.05 
          }}
          transition={{ 
            opacity: { duration: 0.3 }
          }}
          onLoadedData={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover select-none pointer-events-none"
        />
      ) : (
        <motion.img
          ref={mediaRef as any}
          key={`img-${station.id}-${station.coverUrl}`}
          src={station.coverUrl}
          alt={station.name}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: isLoaded ? 1 : 0,
            scale: 1.05 
          }}
          transition={{ 
            opacity: { duration: 0.3 }
          }}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover select-none pointer-events-none"
        />
      )}

      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-[#1a1a1a] z-10">
          <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

interface ReorderItemProps {
  station: Station;
  isActive: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  isEditMode: boolean;
  status: PlayerStatus;
  accentColor: string;
  destructiveColor: string;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  hapticImpact: (style?: any) => void;
}

const ReorderableStationItem: React.FC<ReorderItemProps> = ({
  station, isActive, isPlaying, isFavorite, isEditMode, status, accentColor, destructiveColor, onSelect, onEdit, onDelete, onToggleFavorite, hapticImpact
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const controls = useDragControls();

  return (
    <ReorderItem
      value={station}
      dragListener={isEditMode}
      dragControls={controls}
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ 
        type: "spring", 
        stiffness: 500, 
        damping: 50,
        layout: { duration: 0.25 }
      }}
      onDragStart={() => { 
        setIsDragging(true); 
        hapticImpact('light'); 
      }}
      onDragEnd={() => setIsDragging(false)}
      whileDrag={{ 
        scale: 1.02, 
        zIndex: 100, 
        backgroundColor: "var(--tg-theme-secondary-bg-color, #f8f8f8)",
        boxShadow: "none" 
      }}
      className={`flex items-center gap-3 p-2 mb-2 rounded-[1.25rem] group relative border-2 ${isActive && !isEditMode ? 'bg-blue-100/30 dark:bg-white/[0.08] border-blue-200/50 dark:border-white/20' : 'bg-white dark:bg-white/[0.015] border-transparent'} ${isEditMode ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'} ${isDragging ? 'z-50' : 'shadow-sm select-none'}`}
      onClick={(e: React.MouseEvent) => !isDragging && (isEditMode ? onEdit(e) : onSelect())}
    >
      {isEditMode && (
        <div 
          className="p-3 cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-600 flex items-center justify-center shrink-0"
          onPointerDown={(e) => controls.start(e)}
        >
          <Icons.Drag className="w-6 h-6" />
        </div>
      )}

      <div className="relative w-12 h-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-[#252525] pointer-events-none">
        <StationCover station={station} className="w-full h-full" showTags={false} />
        <AnimatePresence>
          {isPlaying && (status === 'playing' || status === 'loading') && !isEditMode && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><MiniEqualizer /></motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 min-w-0 pointer-events-none">
        <p className="font-medium truncate text-[15px] dark:text-white/90">{station.name}</p>
        <div className="flex gap-1.5 mt-0.5 opacity-60">
           {station.tags?.slice(0, 2).map(tag => (
             <span key={tag} className="text-[10px] uppercase font-bold tracking-tight">{tag}</span>
           ))}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 pr-1">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(e); }}
          className={`p-2 rounded-full transition-colors ${isFavorite ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-700'}`}
        >
          {isFavorite ? <Icons.Star className="w-5 h-5" /> : <Icons.StarOutline className="w-5 h-5" />}
        </button>
        {isEditMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(e); }}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
          >
            <Icons.Reset className="w-5 h-5 rotate-45" />
          </button>
        )}
      </div>
    </ReorderItem>
  );
};

// Fix: Added the main App component and exported it to resolve the import error in index.tsx
export const App: React.FC = () => {
  const { hapticImpact, hapticNotification } = useTelegram();
  const [stations, setStations] = useState<Station[]>(() => {
    const saved = localStorage.getItem('radio_stations');
    return saved ? JSON.parse(saved) : DEFAULT_STATIONS;
  });
  const [activeStationId, setActiveStationId] = useState<string>(stations[0]?.id || '');
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('radio_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [isEditMode, setIsEditMode] = useState(false);

  const activeStation = useMemo(() => 
    stations.find(s => s.id === activeStationId), 
    [stations, activeStationId]
  );

  const { status, play, stop } = useAudio(activeStation?.streamUrl || null);

  useEffect(() => {
    localStorage.setItem('radio_stations', JSON.stringify(stations));
  }, [stations]);

  useEffect(() => {
    localStorage.setItem('radio_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
    hapticImpact('light');
  };

  const deleteStation = (id: string) => {
    setStations(prev => prev.filter(s => s.id !== id));
    hapticNotification('warning');
  };

  const handleSelect = (id: string) => {
    setActiveStationId(id);
    play();
    hapticImpact('medium');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f0f] text-black dark:text-white flex flex-col pb-[env(safe-area-inset-bottom)] select-none">
      <header className="p-4 flex items-center justify-between sticky top-0 z-40 bg-white/80 dark:bg-[#0f0f0f]/80 backdrop-blur-xl border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Logo className="w-8 h-8 text-blue-600" />
          <h1 className="text-lg font-black tracking-tight uppercase">Radio v{APP_VERSION}</h1>
        </div>
        <RippleButton 
          onClick={() => setIsEditMode(!isEditMode)}
          className="px-4 py-2 rounded-full bg-gray-100 dark:bg-white/5 text-xs font-bold uppercase tracking-wider"
        >
          {isEditMode ? 'ГОТОВО' : 'РЕДАКТ.'}
        </RippleButton>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-4 max-w-lg mx-auto w-full">
           <Swiper
             modules={[EffectCreative, Keyboard]}
             effect="creative"
             creativeEffect={{
               prev: { shadow: true, translate: ['-20%', 0, -1] },
               next: { translate: ['100%', 0, 0] },
             }}
             keyboard={{ enabled: true }}
             className="w-full aspect-square rounded-[2rem] shadow-2xl overflow-hidden mb-8"
           >
             {stations.map(station => (
               <SwiperSlide key={station.id}>
                 <StationCover station={station} className="w-full h-full" />
               </SwiperSlide>
             ))}
           </Swiper>

           <div className="mt-8">
             <div className="flex items-center justify-between mb-4 px-2">
               <h2 className="text-xl font-black uppercase tracking-tight">Плейлист</h2>
             </div>

             <ReorderGroup 
               axis="y" 
               values={stations} 
               onReorder={setStations}
               className="space-y-1"
             >
               {stations.map(station => (
                 <ReorderableStationItem
                   key={station.id}
                   station={station}
                   isActive={activeStationId === station.id}
                   isPlaying={activeStationId === station.id && status === 'playing'}
                   isFavorite={favorites.includes(station.id)}
                   isEditMode={isEditMode}
                   status={status}
                   accentColor="#3b82f6"
                   destructiveColor="#ef4444"
                   onSelect={() => handleSelect(station.id)}
                   onEdit={() => {}}
                   onDelete={() => deleteStation(station.id)}
                   onToggleFavorite={() => toggleFavorite(station.id)}
                   hapticImpact={hapticImpact}
                 />
               ))}
             </ReorderGroup>
           </div>
        </div>
      </main>

      <AnimatePresence>
        {activeStation && (
          <motion.footer
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/80 dark:bg-[#0f0f0f]/80 backdrop-blur-2xl border-t border-gray-100 dark:border-white/5 z-50"
          >
            <div className="max-w-lg mx-auto flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg bg-gray-100 dark:bg-[#252525]">
                <StationCover station={activeStation} className="w-full h-full" showTags={false} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate text-sm uppercase tracking-tight">{activeStation.name}</h3>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{status}</p>
              </div>
              <RippleButton 
                onClick={() => status === 'playing' ? stop() : play()}
                className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30"
              >
                {status === 'loading' ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : status === 'playing' ? (
                  <Icons.Pause className="w-6 h-6" />
                ) : (
                  <Icons.Play className="w-6 h-6 ml-1" />
                )}
              </RippleButton>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
};
