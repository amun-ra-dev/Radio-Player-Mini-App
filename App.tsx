
// Version 2.5.1 - Integrated with Telegram Bot API 9.0
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCreative } from 'swiper/modules';
import type { Swiper as SwiperClass } from 'swiper';

import { Station, PlayerStatus } from './types.ts';
import { DEFAULT_STATIONS, Icons } from './constants.tsx';
import { useTelegram } from './hooks/useTelegram.ts';
import { useAudio } from './hooks/useAudio.ts';
import { RippleButton } from './components/UI/RippleButton.tsx';
import { Logo } from './components/UI/Logo.tsx';

const StationCover: React.FC<{ station: Station | null; isPlaying: boolean; status: PlayerStatus }> = ({ station, isPlaying, status }) => {
  if (!station) return <div className="w-full h-full bg-tg-secondary animate-pulse rounded-[2.5rem]" />;
  
  return (
    <div className="relative w-full h-full rounded-[2.5rem] overflow-hidden shadow-2xl transition-transform duration-500 group pointer-events-none">
      <img 
        src={station.coverUrl} 
        alt={station.name} 
        className={`w-full h-full object-cover transition-transform duration-1000 ${isPlaying ? 'scale-110' : 'scale-100'}`} 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      
      {isPlaying && (status === 'playing' || status === 'loading') && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1 h-6">
          {[0.6, 0.4, 0.8, 0.5].map((d, i) => (
            <motion.div
              key={i}
              animate={{ height: status === 'loading' ? [4, 4] : [4, 24, 4] }}
              transition={{ repeat: Infinity, duration: d, ease: "easeInOut" }}
              className="w-1.5 bg-white rounded-full shadow-lg"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  const { hapticImpact, setBackButton, showSecondaryButton } = useTelegram();

  const [stations] = useState<Station[]>(() => {
    const saved = localStorage.getItem('radio_stations_v2');
    return saved ? JSON.parse(saved) : DEFAULT_STATIONS;
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('radio_favs_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeId, setActiveId] = useState<string>(stations[0]?.id || '');
  const [playingId, setPlayingId] = useState<string>('');
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const activeStation = useMemo(() => stations.find(s => s.id === activeId), [stations, activeId]);
  const { status, volume, setVolume, togglePlay, play } = useAudio(stations.find(s => s.id === playingId)?.streamUrl || null);

  useEffect(() => {
    localStorage.setItem('radio_favs_v2', JSON.stringify(favorites));
  }, [favorites]);

  // Интеграция Secondary Button (нативная кнопка внизу)
  useEffect(() => {
    if (!showPlaylist) {
      const cleanup = showSecondaryButton("ОТКРЫТЬ ПЛЕЙЛИСТ", () => setShowPlaylist(true));
      return cleanup;
    }
  }, [showPlaylist, showSecondaryButton]);

  // Интеграция Back Button для закрытия шторки
  useEffect(() => {
    setBackButton(showPlaylist, () => setShowPlaylist(false));
  }, [showPlaylist, setBackButton]);

  const handleToggleFavorite = useCallback((id: string) => {
    hapticImpact('medium');
    const isFav = favorites.includes(id);
    setFavorites(prev => isFav ? prev.filter(f => f !== id) : [...prev, id]);
    setSnackbar(isFav ? "Удалено из избранного" : "Добавлено в избранное");
    setTimeout(() => setSnackbar(null), 2000);
  }, [favorites, hapticImpact]);

  const onStationChange = (swiper: SwiperClass) => {
    const s = stations[swiper.realIndex];
    if (s) {
      setActiveId(s.id);
      hapticImpact('light');
    }
  };

  return (
    <div className="flex flex-col h-full safe-pt safe-pb overflow-hidden bg-tg-bg">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8 text-tg-button" />
          <h1 className="text-xl font-black tracking-tight text-tg-text">RADIO PRO</h1>
        </div>
        <RippleButton 
          onPointerDownCapture={(e) => e.stopPropagation()} 
          onClick={() => handleToggleFavorite(activeId)}
          className={`p-2 rounded-full transition-colors ${favorites.includes(activeId) ? 'text-amber-500' : 'text-tg-hint'}`}
        >
          {favorites.includes(activeId) ? <Icons.Star /> : <Icons.StarOutline />}
        </RippleButton>
      </header>

      {/* Carousel */}
      <main className="flex-1 flex flex-col justify-center items-center gap-4 py-2">
        <div className="w-full max-w-[360px] aspect-square relative z-10">
          <Swiper
            effect="creative"
            grabCursor
            centeredSlides
            slidesPerView={1}
            creativeEffect={{
              prev: { translate: ['-120%', 0, -500], rotate: [0, 0, -20], opacity: 0 },
              next: { translate: ['120%', 0, -500], rotate: [0, 0, 20], opacity: 0 },
            }}
            modules={[EffectCreative]}
            onSlideChange={onStationChange}
            className="w-full h-full"
          >
            {stations.map(s => (
              <SwiperSlide key={s.id} className="p-4 flex items-center justify-center">
                <StationCover station={s} isPlaying={playingId === s.id} status={status} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        {/* Info */}
        <div className="text-center px-8 w-full z-20">
          <motion.div key={activeId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h2 className="text-3xl font-black text-tg-text mb-1 truncate">{activeStation?.name}</h2>
            <p className="text-sm font-medium text-tg-hint uppercase tracking-widest">
              {playingId === activeId ? status.toUpperCase() : 'ГОТОВ К ЭФИРУ'}
            </p>
          </motion.div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-8 mb-8">
            <RippleButton className="text-tg-text opacity-40 hover:opacity-100">
              <Icons.Prev />
            </RippleButton>
            
            <RippleButton
              onClick={() => {
                hapticImpact('heavy');
                if (playingId === activeId) togglePlay();
                else { setPlayingId(activeId); play(activeStation?.streamUrl || ''); }
              }}
              className="w-20 h-20 bg-tg-button text-tg-button-text rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              {(playingId === activeId && (status === 'playing' || status === 'loading')) ? <Icons.Pause /> : <Icons.Play />}
            </RippleButton>

            <RippleButton className="text-tg-text opacity-40 hover:opacity-100">
              <Icons.Next />
            </RippleButton>
          </div>

          {/* Volume */}
          <div className="px-6">
            <input 
              type="range" min="0" max="1" step="0.01" 
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-tg-secondary rounded-full appearance-none accent-tg-button"
            />
          </div>
        </div>
      </main>

      {/* Snackbar */}
      <AnimatePresence>
        {snackbar && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-32 left-6 right-6 bg-tg-text text-tg-bg px-6 py-3 rounded-2xl font-bold text-center z-[100] shadow-2xl"
          >
            {snackbar}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playlist Drawer */}
      <AnimatePresence>
        {showPlaylist && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[110] backdrop-blur-sm"
              onClick={() => setShowPlaylist(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[75vh] bg-tg-bg rounded-t-[2.5rem] z-[120] shadow-2xl flex flex-col overflow-hidden border-t border-tg-hint/10"
            >
              <div className="w-12 h-1.5 bg-tg-secondary rounded-full mx-auto my-4 shrink-0" />
              <div className="px-6 py-2 flex items-center justify-between">
                <h3 className="text-2xl font-black text-tg-text">Плейлист</h3>
                <RippleButton onClick={() => setShowPlaylist(false)} className="text-tg-button font-bold text-sm">ГОТОВО</RippleButton>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                {stations.map(s => (
                  <div 
                    key={s.id}
                    onClick={() => { setActiveId(s.id); setShowPlaylist(false); hapticImpact('light'); }}
                    className={`flex items-center gap-4 p-3 rounded-2xl transition-all ${activeId === s.id ? 'bg-tg-button/10 border-l-4 border-tg-button' : 'hover:bg-tg-secondary'}`}
                  >
                    <img src={s.coverUrl} className="w-12 h-12 rounded-xl object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-tg-text truncate">{s.name}</div>
                      <div className="text-xs text-tg-hint">{s.tags?.join(' • ')}</div>
                    </div>
                    {playingId === s.id && <div className="w-2 h-2 rounded-full bg-tg-button animate-ping" />}
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
