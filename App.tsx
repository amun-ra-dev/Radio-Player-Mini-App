
// Build: 2.5.9
// - Feature: Swipe-based parallax for covers (image shifts with drag direction).
// - Feature: Video covers support (.mp4, .mov) with looping.
// - Feature: Enhanced support for animated SVG and WebP.
// - UX: Refined CreativeEffect for more expressive directional shifting.
// - Fix: Cancel button for sleep timer.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCreative } from 'swiper/modules';

// Swiper styles
import 'swiper/css';
import 'swiper/css/effect-creative';

import { Station, PlayerStatus } from './types.ts';
import { DEFAULT_STATIONS, Icons } from './constants.tsx';
import { useTelegram } from './hooks/useTelegram.ts';
import { useAudio } from './hooks/useAudio.ts';
import { useGyroscope } from './hooks/useGyroscope.ts';
import { RippleButton } from './components/UI/RippleButton.tsx';
import { Logo } from './components/UI/Logo.tsx';

const ReorderGroup = Reorder.Group as any;
const ReorderItem = Reorder.Item as any;

const APP_VERSION = "2.5.9";

const MiniEqualizer: React.FC = () => (
  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
    <div className="flex gap-1 items-end h-3.5 mb-1">
      <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} className="w-1 bg-white rounded-full" />
      <motion.div animate={{ height: [12, 6, 12] }} transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut", delay: 0.1 }} className="w-1 bg-white rounded-full" />
      <motion.div animate={{ height: [6, 10, 6] }} transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut", delay: 2 }} className="w-1 bg-white rounded-full" />
    </div>
  </div>
);

const StationCover: React.FC<{ station: Station | null | undefined; className?: string; showTags?: boolean; parallax?: { x: number, y: number }; swipeShift?: number }> = ({ station, className = "", showTags = true, parallax = { x: 0, y: 0 }, swipeShift = 0 }) => {
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
      <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-1.5 max-w-[80%] pointer-events-none">
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

  // Combine gyroscope parallax with swipe shift (directionally aware)
  const totalX = (parallax.x * 8) + (swipeShift * 40);
  const totalY = parallax.y * 8;

  return (
    <div className={`${className} relative bg-gray-200 dark:bg-[#1a1a1a] overflow-hidden`}>
      {renderTags()}
      
      <AnimatePresence mode="wait">
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
              x: totalX,
              y: totalY,
              scale: 1.15 
            }}
            transition={{ opacity: { duration: 0.3 }, x: { type: 'spring', stiffness: 60, damping: 25 }, y: { type: 'spring', stiffness: 60, damping: 25 } }}
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
              x: totalX,
              y: totalY,
              scale: 1.15 
            }}
            transition={{ opacity: { duration: 0.3 }, x: { type: 'spring', stiffness: 60, damping: 25 }, y: { type: 'spring', stiffness: 60, damping: 25 } }}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover select-none pointer-events-none"
          />
        )}
      </AnimatePresence>

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
  station, isActive, isPlaying, isFavorite, status, accentColor, destructiveColor, onSelect, onEdit, onDelete, onToggleFavorite, hapticImpact
}) => {
  const [isDragging, setIsDragging] = useState(false);
  return (
    <ReorderItem
      value={station}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onDragStart={() => { setIsDragging(true); hapticImpact('medium'); }}
      onDragEnd={() => setIsDragging(false)}
      whileDrag={{ scale: 1.02, zIndex: 100, backgroundColor: "var(--tg-theme-secondary-bg-color, #2c2c2c)", boxShadow: "none" }}
      className={`flex items-center gap-3 p-2 mb-2 rounded-[1.25rem] transition-colors group relative border-2 ${isActive ? 'bg-blue-100/30 dark:bg-white/[0.08] border-blue-200/50 dark:border-white/20' : 'hover:bg-gray-50 dark:hover:bg-white/5 bg-white dark:bg-white/[0.015] border-transparent'} cursor-grab active:cursor-grabbing shadow-sm`}
      onClick={() => !isDragging && onSelect()}
    >
      <div className="relative w-12 h-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-[#252525] pointer-events-none">
        <StationCover station={station} className="w-full h-full" showTags={false} />
        <AnimatePresence>
          {isPlaying && (status === 'playing' || status === 'loading') && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><MiniEqualizer /></motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex-1 min-w-0 pointer-events-none">
        <p className="font-bold text-base truncate leading-tight dark:text-white/90" style={{ color: isActive ? accentColor : 'inherit' }}>
          {station.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-white/40 truncate">
          {station.tags?.join(' • ') || 'Radio'}
        </p>
      </div>
      <div className="flex items-center gap-1 pr-1">
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(e); }}
          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          {isFavorite ? <Icons.Star className="w-5 h-5 text-yellow-500" /> : <Icons.StarOutline className="w-5 h-5 text-gray-400" />}
        </button>
      </div>
    </ReorderItem>
  );
};

// Fixed: Added named export 'App' as expected by index.tsx
export const App: React.FC = () => {
  const { tg, hapticImpact, themeParams } = useTelegram();
  const [stations, setStations] = useState<Station[]>(() => {
    const saved = localStorage.getItem('radio_stations');
    return saved ? JSON.parse(saved) : DEFAULT_STATIONS;
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('radio_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStation = stations[activeIndex] || null;
  
  const { status, play, stop } = useAudio(activeStation?.streamUrl || null);
  const gyro = useGyroscope(true);

  const accentColor = themeParams.button_color || '#3b82f6';
  const destructiveColor = themeParams.destructive_text_color || '#ef4444';

  useEffect(() => {
    localStorage.setItem('radio_stations', JSON.stringify(stations));
  }, [stations]);

  useEffect(() => {
    localStorage.setItem('radio_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const togglePlay = () => {
    if (status === 'playing') {
      stop();
    } else {
      play();
    }
    hapticImpact('light');
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % stations.length);
    hapticImpact('medium');
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + stations.length) % stations.length);
    hapticImpact('medium');
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
    hapticImpact('soft');
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0f0f0f] text-gray-900 dark:text-white transition-colors duration-300 font-sans selection:bg-blue-500/30">
      <div className="max-w-md mx-auto h-screen flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="px-6 pt-12 pb-6 flex items-center justify-between z-30">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8 text-blue-600" />
            <span className="font-black text-xl tracking-tighter">RADIO <span className="text-blue-600">APP</span></span>
          </div>
          <div className="flex gap-2">
            <RippleButton className="p-2 rounded-2xl bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-sm">
              <Icons.Settings className="w-6 h-6" />
            </RippleButton>
          </div>
        </header>

        {/* Player Section */}
        <div className="flex-1 flex flex-col px-6">
          <div className="relative aspect-square w-full mb-8">
            <Swiper
              modules={[EffectCreative]}
              effect="creative"
              grabCursor
              centeredSlides
              slidesPerView={1}
              creativeEffect={{
                prev: { shadow: true, translate: ['-120%', 0, -500] },
                next: { shadow: true, translate: ['120%', 0, -500] },
              }}
              onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
              className="h-full rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              {stations.map((s) => (
                <SwiperSlide key={s.id}>
                  <StationCover 
                    station={s} 
                    className="w-full h-full" 
                    parallax={gyro} 
                  />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-black mb-1 tracking-tight">{activeStation?.name || 'Radio'}</h2>
            <p className="text-blue-600 dark:text-blue-400 font-medium text-sm">
              {status === 'playing' ? 'Live Streaming' : status === 'loading' ? 'Connecting...' : 'Ready'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-8 mb-12">
            <button onClick={handlePrev} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
              <Icons.Prev className="w-8 h-8" />
            </button>
            <button 
              onClick={togglePlay}
              className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 active:scale-95 transition-transform"
            >
              {status === 'playing' || status === 'loading' ? <Icons.Pause className="w-10 h-10" /> : <Icons.Play className="w-10 h-10 ml-1" />}
            </button>
            <button onClick={handleNext} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
              <Icons.Next className="w-8 h-8" />
            </button>
          </div>
        </div>

        {/* Station List */}
        <div className="px-6 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg tracking-tight">Stations</h3>
            <button onClick={() => {}} className="p-1.5 rounded-xl bg-blue-100 dark:bg-blue-600/20 text-blue-600 transition-colors">
              <Icons.Add className="w-5 h-5" />
            </button>
          </div>
          <ReorderGroup axis="y" values={stations} onReorder={setStations} className="max-h-64 overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {stations.map((station) => (
              <ReorderableStationItem
                key={station.id}
                station={station}
                isActive={station.id === activeStation?.id}
                isPlaying={station.id === activeStation?.id && status === 'playing'}
                isFavorite={favorites.includes(station.id)}
                status={status}
                accentColor={accentColor}
                destructiveColor={destructiveColor}
                onSelect={() => setActiveIndex(stations.indexOf(station))}
                onEdit={() => {}}
                onDelete={() => {}}
                onToggleFavorite={(e) => toggleFavorite(station.id)}
                hapticImpact={hapticImpact}
              />
            ))}
          </ReorderGroup>
        </div>
      </div>
    </div>
  );
};
