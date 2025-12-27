
// Build: 3.0.1
// - Feature: Unified Playlist (Tap to Play / Long-press to Reorder / Native Scroll).
// - Feature: Swipe-to-Back (horizontal pan) to collapse playlist.
// - UX: Dynamic Haptics and improved gesture isolation.
// - Optimization: Removed jerky layout shifts in ReorderGroup.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCreative, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperClass } from 'swiper';

import { Station, PlayerStatus } from './types.ts';
import { DEFAULT_STATIONS, Icons } from './constants.tsx';
import { useTelegram } from './hooks/useTelegram.ts';
import { useAudio } from './hooks/useAudio.ts';
import { RippleButton } from './components/UI/RippleButton.tsx';
import { Logo } from './components/UI/Logo.tsx';

const ReorderGroup = Reorder.Group as any;
const ReorderItem = Reorder.Item as any;

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
  station: Partial<Station> | null | undefined; 
  className?: string; 
}> = ({ station, className = "" }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

  const isVideo = useMemo(() => {
    const url = station?.coverUrl?.toLowerCase() || '';
    return url.endsWith('.mp4') || url.endsWith('.mov');
  }, [station?.coverUrl]);

  useEffect(() => {
    setHasError(false); setIsLoaded(false);
    if (!station?.coverUrl) return;
    if (!isVideo) {
      const img = mediaRef.current as HTMLImageElement;
      if (img && img.complete && img.naturalWidth > 0) setIsLoaded(true);
    } else {
      const video = mediaRef.current as HTMLVideoElement;
      if (video && video.readyState >= 3) setIsLoaded(true);
    }
  }, [station?.id, station?.coverUrl, isVideo]);

  if (!station) return <div className={`${className} bg-blue-600 flex items-center justify-center text-white text-5xl font-black select-none`}>+</div>;

  if (!station.coverUrl || hasError) {
    return (
      <div className={`${className} bg-blue-600 flex items-center justify-center text-white text-7xl font-black select-none`}>
        {station.name?.charAt(0)?.toUpperCase?.() || 'R'}
      </div>
    );
  }

  return (
    <div className={`${className} relative bg-gray-200 dark:bg-[#1a1a1a] overflow-hidden`}>
      {isVideo ? (
        <motion.video
          ref={mediaRef as any}
          key={`vid-${station.id}`} src={station.coverUrl} autoPlay muted loop playsInline
          initial={{ opacity: 0 }} animate={{ opacity: isLoaded ? 1 : 0, scale: 1.05 }}
          onLoadedData={() => setIsLoaded(true)} onError={() => setHasError(true)}
          className="w-full h-full object-cover select-none pointer-events-none"
        />
      ) : (
        <motion.img
          ref={mediaRef as any}
          key={`img-${station.id}`} src={station.coverUrl} alt={station.name}
          initial={{ opacity: 0 }} animate={{ opacity: isLoaded ? 1 : 0, scale: 1.05 }}
          onLoad={() => setIsLoaded(true)} onError={() => setHasError(true)}
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

export const App: React.FC = () => {
  const { hapticImpact, hapticNotification, setBackButton, isMobile, themeParams } = useTelegram();

  // STATIONS STATE
  const [stations, setStations] = useState<Station[]>(() => {
    const saved = localStorage.getItem('radio_stations');
    if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) return parsed; } catch {} }
    return [];
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('radio_favorites');
    try { const parsed = saved ? JSON.parse(saved) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  });

  const [onlyFavoritesMode, setOnlyFavoritesMode] = useState<boolean>(() => localStorage.getItem('radio_only_favorites') === 'true');
  const [activeStationId, setActiveStationId] = useState<string>(() => localStorage.getItem('radio_last_active') || '');
  const [playingStationId, setPlayingStationId] = useState<string>(() => localStorage.getItem('radio_last_playing') || '');
  const [playlistFilter, setPlaylistFilter] = useState<'all' | 'favorites'>('all');
  
  // MODALS STATE
  const [showEditor, setShowEditor] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // TIMER STATE
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [sleepTimerEndDate, setSleepTimerEndDate] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [customTimerValue, setCustomTimerValue] = useState<string>('');
  const sleepTimerTimeoutRef = useRef<number | null>(null);

  // UI STATE
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const sheetDragControls = useDragControls();
  const [swiperInstance, setSwiperInstance] = useState<SwiperClass | null>(null);
  const isReorderingRef = useRef(false);

  // EDITOR STATE
  const [editorState, setEditorState] = useState({ name: '', streamUrl: '', coverUrl: '', tags: '' });

  // EFFECTS
  useEffect(() => {
    if (editingStation) {
      setEditorState({
        name: editingStation.name,
        streamUrl: editingStation.streamUrl,
        coverUrl: editingStation.coverUrl || '',
        tags: editingStation.tags?.join(', ') || ''
      });
    } else {
      setEditorState({ name: '', streamUrl: '', coverUrl: '', tags: '' });
    }
  }, [editingStation, showEditor]);

  useEffect(() => { localStorage.setItem('radio_stations', JSON.stringify(stations)); }, [stations]);
  useEffect(() => { localStorage.setItem('radio_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('radio_only_favorites', String(onlyFavoritesMode)); }, [onlyFavoritesMode]);
  useEffect(() => { localStorage.setItem('radio_last_active', activeStationId); }, [activeStationId]);
  useEffect(() => { localStorage.setItem('radio_last_playing', playingStationId); }, [playingStationId]);
  useEffect(() => { if (!snackbar) return; const t = setTimeout(() => setSnackbar(null), 3000); return () => clearTimeout(t); }, [snackbar]);

  // COMPUTED
  const displayedStations = useMemo(() => {
    if (!stations.length) return [];
    return onlyFavoritesMode ? stations.filter(s => favorites.includes(s.id)) : stations;
  }, [stations, favorites, onlyFavoritesMode]);

  const stationsInPlaylist = useMemo(() => {
    return playlistFilter === 'favorites' ? stations.filter(s => favorites.includes(s.id)) : stations;
  }, [playlistFilter, stations, favorites]);

  const activeStation = useMemo<Station | null>(() => {
    if (!displayedStations.length) return null;
    return displayedStations.find(s => s.id === activeStationId) || displayedStations[0] || null;
  }, [displayedStations, activeStationId]);

  const initialSlideIndex = useMemo(() => {
    const idx = displayedStations.findIndex(s => s.id === activeStationId);
    return idx === -1 ? 0 : idx;
  }, [displayedStations, activeStationId]);

  // AUDIO HOOK
  const { status, volume, setVolume, play, stop } = useAudio(stations.find(s => s.id === playingStationId)?.streamUrl || null);

  // HANDLERS
  const handleTogglePlay = useCallback(() => {
    if (!activeStation) return;
    if (playingStationId === activeStationId) {
      if (status === 'playing' || status === 'loading') { hapticImpact('soft'); stop(); }
      else { hapticImpact('medium'); play(activeStation.streamUrl); }
    } else {
      setPlayingStationId(activeStationId);
      hapticImpact('medium'); play(activeStation.streamUrl);
    }
  }, [activeStationId, playingStationId, status, activeStation, hapticImpact, play, stop]);

  const handleSetSleepTimer = useCallback((minutes: number) => {
    if (sleepTimerTimeoutRef.current) clearTimeout(sleepTimerTimeoutRef.current);
    if (minutes > 0) {
      const endDate = Date.now() + minutes * 60 * 1000;
      setSleepTimerEndDate(endDate);
      sleepTimerTimeoutRef.current = window.setTimeout(() => {
        stop(); setSleepTimerEndDate(null);
        setSnackbar('Таймер сна завершен'); hapticNotification('success');
      }, minutes * 60 * 1000);
      setSnackbar(`Таймер: ${minutes} мин`); hapticImpact('light');
    } else { 
      setSleepTimerEndDate(null); setSnackbar('Таймер отключен'); 
    }
    setShowSleepTimerModal(false);
  }, [stop, hapticNotification, hapticImpact]);

  useEffect(() => {
    if (!sleepTimerEndDate) { setTimeRemaining(null); return; }
    const interval = setInterval(() => {
      const remaining = sleepTimerEndDate - Date.now();
      if (remaining <= 0) { setTimeRemaining(null); clearInterval(interval); }
      else {
        const min = Math.floor(remaining / 60000);
        const sec = Math.floor((remaining % 60000) / 1000);
        setTimeRemaining(`${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndDate]);

  const handleReorder = (reorderedItems: Station[]) => {
    const reorderedIds = new Set(reorderedItems.map(item => item.id));
    const newStations = [...reorderedItems, ...stations.filter(item => !reorderedIds.has(item.id))];
    setStations(newStations);
    hapticImpact('light');
  };

  const handleDemo = () => {
    setConfirmData({
      message: 'Добавить стандартный список станций?',
      onConfirm: () => {
        setStations(prev => {
          const existingUrls = new Set(prev.map(s => s.streamUrl.toLowerCase().trim()));
          const unique = DEFAULT_STATIONS.filter(s => !existingUrls.has(s.streamUrl.toLowerCase().trim()));
          return [...prev, ...unique];
        });
        setSnackbar(`Добавлено: ${DEFAULT_STATIONS.length}`); hapticNotification('success');
      }
    });
    setShowConfirmModal(true);
  };

  const toggleFavorite = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); hapticImpact('light');
    setFavorites(prev => prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]);
  }, [hapticImpact]);

  const navigateStation = (navDir: 'next' | 'prev') => {
    if (!swiperInstance) return;
    hapticImpact('medium');
    if (navDir === 'next') swiperInstance.slideNext();
    else swiperInstance.slidePrev();
  };

  const closeAllModals = useCallback(() => {
    setShowEditor(false); setShowConfirmModal(false); setShowSleepTimerModal(false);
    setEditingStation(null);
    if (isSheetExpanded) setIsSheetExpanded(false);
  }, [isSheetExpanded]);

  const addOrUpdateStation = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const tags = editorState.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (editingStation) {
      setStations(prev => prev.map(s => s.id === editingStation.id ? { ...s, name: editorState.name, streamUrl: editorState.streamUrl, coverUrl: editorState.coverUrl, tags } : s));
    } else {
      setStations(prev => [...prev, { id: Date.now().toString(), name: editorState.name, streamUrl: editorState.streamUrl, coverUrl: editorState.coverUrl, tags, addedAt: Date.now() }]);
    }
    closeAllModals();
  }, [editingStation, editorState, closeAllModals]);

  useEffect(() => {
    const isModalOpen = showEditor || isSheetExpanded || showConfirmModal || showSleepTimerModal;
    setBackButton(isModalOpen, closeAllModals);
  }, [showEditor, isSheetExpanded, showConfirmModal, showSleepTimerModal, setBackButton, closeAllModals]);

  const nativeAccentColor = themeParams?.button_color || '#2563eb';
  const nativeBgColor = themeParams?.bg_color || '#ffffff';
  const nativeTextColor = themeParams?.text_color || '#222222';

  return (
    <div className="flex flex-col overflow-hidden relative" style={{ height: 'var(--tg-viewport-height, 100vh)', color: nativeTextColor, backgroundColor: nativeBgColor }}>
      {/* BACKGROUND DECOR */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-10 bg-[radial-gradient(circle_at_center,_#3b82f6_0%,_transparent_70%)]" />
      
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 bg-white/80 dark:bg-black/40 border-b border-black/5 dark:border-white/10 z-20 shrink-0 backdrop-blur-[50px]" style={{ paddingTop: isMobile ? 'calc(var(--tg-safe-top, 0px) + 46px)' : 'calc(var(--tg-safe-top, 0px) + 16px)', paddingBottom: '12px' }}>
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8" style={{ color: nativeAccentColor }} />
          <h1 className="text-2xl font-black tracking-tighter">Radio</h1>
        </div>
        <div className="flex items-center gap-2">
          <RippleButton onClick={() => setOnlyFavoritesMode(!onlyFavoritesMode)} className={`w-[38px] h-[38px] flex items-center justify-center rounded-full transition-all ${onlyFavoritesMode ? 'bg-amber-100 text-amber-500' : 'text-gray-400'}`}>
            <Icons.Star />
          </RippleButton>
          <RippleButton onClick={() => setShowSleepTimerModal(true)} className={`h-[38px] rounded-full flex items-center justify-center transition-all ${sleepTimerEndDate ? 'bg-blue-600 text-white px-3 gap-2' : 'w-[38px] text-gray-400'}`} style={{ backgroundColor: sleepTimerEndDate ? nativeAccentColor : undefined }}>
            <Icons.Timer className="w-5 h-5" />
            {sleepTimerEndDate && <span className="text-[10px] font-black">{timeRemaining}</span>}
          </RippleButton>
        </div>
      </div>

      {/* MAIN PLAYER SECTION */}
      <main className="flex-1 flex flex-col items-center justify-start pt-12 overflow-hidden relative z-10">
        <motion.div 
            animate={{ scale: isSheetExpanded ? 0.75 : 1, y: isSheetExpanded ? -100 : 0, opacity: isSheetExpanded ? 0.1 : 1, filter: isSheetExpanded ? 'blur(20px)' : 'blur(0px)' }}
            transition={{ type: 'spring', damping: 30, stiffness: 150 }}
            className="relative w-[340px] aspect-square shrink-0"
        >
          {displayedStations.length > 0 ? (
            <Swiper
              key={`sw-${displayedStations.length}-${onlyFavoritesMode}`}
              initialSlide={initialSlideIndex}
              onSwiper={setSwiperInstance}
              onSlideChange={(swiper) => {
                if (isReorderingRef.current) return;
                const target = displayedStations[swiper.realIndex];
                if (target) setActiveStationId(target.id);
                hapticImpact('light');
              }}
              loop={displayedStations.length > 1}
              effect={'creative'} slidesPerView={1}
              creativeEffect={{ limitProgress: 3, perspective: true, prev: { translate: ['-100%', 0, -200], rotate: [0, 0, -15], opacity: 0 }, next: { translate: ['100%', 0, -200], rotate: [0, 0, 15], opacity: 0 } }}
              modules={[EffectCreative, Keyboard]} keyboard={{ enabled: true }}
              className="w-full h-full !overflow-visible"
            >
              {displayedStations.map((station) => (
                <SwiperSlide key={station.id} className="w-full h-full flex justify-center">
                  <div className="relative w-full aspect-square rounded-[3rem] overflow-hidden bg-white/10 border-2" style={{ borderColor: activeStationId === station.id ? `${nativeAccentColor}33` : 'transparent' }}>
                    <StationCover station={station} className="w-full h-full" />
                    <div className="absolute bottom-6 right-6 z-30" onClick={(e) => toggleFavorite(station.id, e)}>
                      <RippleButton className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${favorites.includes(station.id) ? 'bg-amber-500 text-white shadow-lg' : 'bg-black/30 text-white/60'}`}>
                        {favorites.includes(station.id) ? <Icons.Star /> : <Icons.StarOutline />}
                      </RippleButton>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-white/5 rounded-[3rem] border-2 border-dashed border-gray-300">
                <RippleButton onClick={handleDemo} className="px-8 py-4 bg-blue-600 text-white rounded-3xl font-black text-sm uppercase shadow-xl" style={{ backgroundColor: nativeAccentColor }}>Импорт демо</RippleButton>
            </div>
          )}
        </motion.div>
      </main>

      {/* BOTTOM SHEET */}
      <motion.div 
        drag="y"
        dragControls={sheetDragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.5 }}
        onDragEnd={(_, info) => {
            if (info.offset.y < -50) setIsSheetExpanded(true);
            else if (info.offset.y > 50) setIsSheetExpanded(false);
        }}
        animate={{ height: isSheetExpanded ? '92vh' : '260px' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-black/90 rounded-t-[3.5rem] border-t border-white/10 shadow-2xl backdrop-blur-[80px] flex flex-col overflow-hidden"
      >
        {/* DRAG HANDLE & COMPACT CONTROLS */}
        <div 
            className="w-full flex flex-col items-center pt-4 shrink-0 touch-none cursor-grab active:cursor-grabbing" 
            onPointerDown={(e) => sheetDragControls.start(e)}
        >
          <div className="w-12 h-1 bg-black/10 dark:bg-white/10 rounded-full mb-4" />
          
          <div className="text-center w-full px-12 min-h-[40px] flex flex-col justify-center mb-2">
            <h2 className="text-lg font-black truncate tracking-tight">{activeStation?.name || 'Радио'}</h2>
            <p className="text-[10px] opacity-40 uppercase tracking-[0.2em] font-black mt-0.5">
                {status === 'loading' ? 'Загрузка...' : (status === 'playing' ? 'В эфире' : 'Пауза')}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!isSheetExpanded && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="w-full flex flex-col items-center overflow-hidden">
                <div className="w-full flex items-center justify-evenly px-6 pb-2">
                  <RippleButton onClick={() => navigateStation('prev')} className="p-3 opacity-30 hover:opacity-100"><Icons.Prev className="w-5 h-5" /></RippleButton>
                  <RippleButton onClick={handleTogglePlay} className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition-transform" style={{ backgroundColor: activeStation ? nativeAccentColor : '#ccc' }} disabled={!activeStation}>
                      {status === 'playing' || status === 'loading' ? <Icons.Pause className="w-8 h-8" /> : <Icons.Play className="w-8 h-8" />}
                  </RippleButton>
                  <RippleButton onClick={() => navigateStation('next')} className="p-3 opacity-30 hover:opacity-100"><Icons.Next className="w-5 h-5" /></RippleButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* PLAYLIST SECTION with Integrated Gestures */}
        <motion.div 
            onPan={(e, info) => {
                if (!isSheetExpanded || isReorderingRef.current) return;
                // Swipe Left-to-Right to collapse
                if (info.offset.x > 70 && Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
                    setIsSheetExpanded(false);
                    hapticImpact('soft');
                }
            }}
            className="flex-1 overflow-hidden flex flex-col px-6 mt-4 playlist-container"
        >
            <div className="flex items-center bg-black/5 dark:bg-white/[0.04] rounded-2xl p-1 mb-4 shrink-0">
                <button onClick={() => setPlaylistFilter('all')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${playlistFilter === 'all' ? 'bg-white shadow-sm' : 'opacity-40'}`} style={{ color: playlistFilter === 'all' ? nativeAccentColor : undefined }}>Все станции</button>
                <button onClick={() => setPlaylistFilter('favorites')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${playlistFilter === 'favorites' ? 'bg-white shadow-sm' : 'opacity-40'}`} style={{ color: playlistFilter === 'favorites' ? nativeAccentColor : undefined }}>Избранное</button>
            </div>

            {/* SCROLLABLE LIST */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-32 scroll-smooth">
                {stationsInPlaylist.length > 0 ? (
                <ReorderGroup axis="y" values={stationsInPlaylist} onReorder={handleReorder} className="space-y-1.5">
                    {stationsInPlaylist.map(s => (
                        <UnifiedStationItem 
                            key={s.id} station={s} isActive={activeStationId === s.id} isPlaying={playingStationId === s.id}
                            isFavorite={favorites.includes(s.id)} status={status} accentColor={nativeAccentColor}
                            onSelect={() => { 
                                if (activeStationId === s.id) handleTogglePlay(); 
                                else { setActiveStationId(s.id); setPlayingStationId(s.id); play(s.streamUrl); }
                            }} 
                            onToggleFavorite={(e) => toggleFavorite(s.id, e)} 
                            onEdit={(e) => { e.stopPropagation(); setEditingStation(s); setShowEditor(true); }} 
                            onDelete={(e) => { e.stopPropagation(); setConfirmData({ message: 'Удалить станцию?', onConfirm: () => setStations(prev => prev.filter(st => st.id !== s.id)) }); setShowConfirmModal(true); }} 
                            hapticImpact={hapticImpact}
                            onDragStateChange={(dragState) => { isReorderingRef.current = dragState; }}
                        />
                    ))}
                </ReorderGroup>
                ) : <div className="py-20 text-center opacity-30 font-black uppercase text-[10px] tracking-widest">Список пуст</div>}
                
                <div className="mt-8 flex flex-col gap-3">
                    <RippleButton onClick={() => setShowEditor(true)} className="w-full p-6 rounded-[2rem] border-2 border-dashed border-gray-300 dark:border-white/10 opacity-30 hover:opacity-100 font-black flex items-center justify-center gap-3 transition-all"><Icons.Add /> Создать станцию</RippleButton>
                    <div className="grid grid-cols-2 gap-2">
                        <RippleButton onClick={handleDemo} className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl text-[10px] font-black opacity-60 flex items-center justify-center gap-2">Импорт демо</RippleButton>
                        <RippleButton onClick={() => {setConfirmData({message: 'Очистить весь список?', onConfirm: () => {setStations([]); setFavorites([]);}}); setShowConfirmModal(true);}} className="p-3 bg-red-500/10 rounded-2xl text-[10px] font-black text-red-500 flex items-center justify-center gap-2">Сброс настроек</RippleButton>
                    </div>
                </div>
            </div>
        </motion.div>
      </motion.div>

      {/* MODALS (Simplified) */}
      <AnimatePresence>
        {showSleepTimerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-white dark:bg-[#111] rounded-[2.5rem] p-8 flex flex-col shadow-2xl">
              <h3 className="text-xl font-black mb-6 text-center">Таймер сна</h3>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {[15, 30, 45, 60].map(m => (
                  <RippleButton key={m} onClick={() => handleSetSleepTimer(m)} className="py-4 bg-black/5 dark:bg-white/5 rounded-xl font-bold">{m} мин</RippleButton>
                ))}
              </div>
              <div className="flex gap-2 mb-6">
                <input type="number" placeholder="Минуты" value={customTimerValue} onChange={(e) => setCustomTimerValue(e.target.value)} className="flex-1 bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3 outline-none font-bold" />
                <RippleButton onClick={() => { const mins = parseInt(customTimerValue); if (mins > 0) handleSetSleepTimer(mins); }} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black" style={{ backgroundColor: nativeAccentColor }}>ОК</RippleButton>
              </div>
              <RippleButton onClick={() => handleSetSleepTimer(0)} className="w-full py-3 bg-red-500/10 text-red-500 rounded-xl font-black mb-2">Отключить</RippleButton>
              <RippleButton onClick={closeAllModals} className="w-full py-3 opacity-40 font-bold">Закрыть</RippleButton>
            </motion.div>
          </div>
        )}

        {showConfirmModal && confirmData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-xs bg-white dark:bg-[#111] rounded-[2.5rem] p-8 shadow-2xl text-center">
              <h3 className="text-lg font-black mb-2">Вы уверены?</h3>
              <p className="text-sm opacity-50 mb-8">{confirmData.message}</p>
              <div className="flex gap-3">
                <RippleButton onClick={closeAllModals} className="flex-1 py-4 bg-black/5 rounded-xl font-bold">Нет</RippleButton>
                <RippleButton onClick={() => { confirmData.onConfirm(); closeAllModals(); }} className="flex-1 py-4 text-white rounded-xl font-black" style={{ backgroundColor: nativeAccentColor }}>Да</RippleButton>
              </div>
            </motion.div>
          </div>
        )}

        {showEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
                <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="relative w-full max-w-sm bg-white dark:bg-[#111] rounded-[3rem] p-8 shadow-2xl flex flex-col gap-6 overflow-hidden max-h-[90vh]">
                    <h3 className="text-xl font-black">Настройка станции</h3>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black/5 shrink-0">
                        <StationCover station={{ name: editorState.name, coverUrl: editorState.coverUrl }} className="w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{editorState.name || 'Название'}</p>
                        <p className="text-[10px] opacity-30 truncate uppercase tracking-widest">{editorState.streamUrl || 'Поток'}</p>
                      </div>
                    </div>
                    <form onSubmit={addOrUpdateStation} className="flex flex-col gap-3 overflow-y-auto pr-1">
                        <input placeholder="Название" value={editorState.name} onChange={(e) => setEditorState(prev => ({ ...prev, name: e.target.value }))} required className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-5 py-4 outline-none font-bold" />
                        <input placeholder="URL потока (m3u8, mp3)" value={editorState.streamUrl} onChange={(e) => setEditorState(prev => ({ ...prev, streamUrl: e.target.value }))} type="url" required className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-5 py-4 outline-none font-bold" />
                        <input placeholder="URL обложки" value={editorState.coverUrl} onChange={(e) => setEditorState(prev => ({ ...prev, coverUrl: e.target.value }))} className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-5 py-4 outline-none font-bold" />
                        <input placeholder="Теги (dance, rock...)" value={editorState.tags} onChange={(e) => setEditorState(prev => ({ ...prev, tags: e.target.value }))} className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-5 py-4 outline-none font-bold" />
                        <div className="flex gap-3 mt-4 shrink-0">
                            <RippleButton type="button" onClick={closeAllModals} className="flex-1 py-4 opacity-40 font-bold">Отмена</RippleButton>
                            <RippleButton type="submit" className="flex-1 py-4 text-white rounded-2xl font-black shadow-lg" style={{ backgroundColor: nativeAccentColor }}>Готово</RippleButton>
                        </div>
                    </form>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* SNACKBAR */}
      {snackbar && (
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-10 left-6 right-6 z-[100] bg-black text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-between shadow-2xl">
          <span className="text-xs truncate pr-4">{snackbar}</span>
          <button onClick={() => setSnackbar(null)} className="font-black text-[10px] uppercase" style={{ color: nativeAccentColor }}>ОК</button>
        </motion.div>
      )}
    </div>
  );
};

// COMPONENT FOR PLAYLIST ITEMS (UNIFIED GESTURES)
const UnifiedStationItem: React.FC<{
    station: Station; isActive: boolean; isPlaying: boolean; isFavorite: boolean; 
    status: PlayerStatus; accentColor: string;
    onSelect: () => void; onEdit: (e: any) => void; onDelete: (e: any) => void;
    onToggleFavorite: (e: any) => void; hapticImpact: (s?: any) => void;
    onDragStateChange: (active: boolean) => void;
}> = ({ station, isActive, isPlaying, isFavorite, status, accentColor, onSelect, onEdit, onDelete, onToggleFavorite, hapticImpact, onDragStateChange }) => {
    const dragControls = useDragControls();
    const timerRef = useRef<number | null>(null);
    const [isLongPressed, setIsLongPressed] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        // Long press detection for Reorder activation
        timerRef.current = window.setTimeout(() => {
            hapticImpact('heavy');
            setIsLongPressed(true);
            dragControls.start(e);
            onDragStateChange(true);
        }, 500); 
    };

    const handlePointerUp = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        if (!isLongPressed && !isDragging) {
            onSelect();
        }
        setIsLongPressed(false);
    };

    const handlePointerCancel = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setIsLongPressed(false);
    };

    return (
        <ReorderItem
            value={station}
            dragListener={false}
            dragControls={dragControls}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => { 
                setIsDragging(false); 
                setIsLongPressed(false);
                onDragStateChange(false);
            }}
            whileDrag={{ 
                scale: 1.04, 
                zIndex: 100, 
                backgroundColor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(30px)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            layout
            animate={{ scale: isLongPressed || isDragging ? 1.04 : 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-colors duration-200 ${isActive ? 'bg-blue-50/50 dark:bg-white/5 border-blue-100/20 shadow-sm' : 'bg-transparent border-transparent'} ${isDragging ? 'opacity-90' : ''} cursor-pointer touch-none select-none`}
        >
            <div className="relative w-11 h-11 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-[#1a1a1a]">
                <StationCover station={station} className="w-full h-full" />
                {isPlaying && (status === 'playing' || status === 'loading') && <MiniEqualizer />}
            </div>

            <div className="flex-1 min-w-0 pointer-events-none">
                <p className="font-bold text-xs truncate" style={{ color: isActive ? accentColor : undefined }}>{station.name}</p>
                <div className="flex gap-1 overflow-hidden mt-0.5">
                  {station.tags?.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[7px] px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-full font-black uppercase opacity-50">#{tag}</span>
                  ))}
                  {!station.tags?.length && <p className="text-[9px] opacity-20 truncate uppercase font-black">{station.streamUrl}</p>}
                </div>
            </div>

            <div className="flex gap-0.5 shrink-0">
                <RippleButton onClick={onToggleFavorite} className={`p-2 rounded-xl transition-colors ${isFavorite ? 'text-amber-500' : 'text-gray-200 dark:text-gray-800'}`}>
                    <Icons.Star className="w-5 h-5" />
                </RippleButton>
                <RippleButton onClick={onEdit} className="p-2 rounded-xl text-gray-300 dark:text-gray-700">
                    <Icons.Settings className="w-4 h-4" />
                </RippleButton>
            </div>
        </ReorderItem>
    );
};
