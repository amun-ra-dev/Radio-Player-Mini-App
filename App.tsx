
// Build: 2.8.0
// - Feature: Refined Unified Sheet (Control + Playlist).
// - Fix: Reorder vs Scroll conflict resolved via Drag Handles.
// - Restore: Sleep Timer and Demo Import functionality.
// - UI: Cover morphing on sheet expand.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls, useAnimation } from 'framer-motion';
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

const APP_VERSION = "2.8.0";

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

  // STATIONS & FAVORITES
  const [stations, setStations] = useState<Station[]>(() => {
    const saved = localStorage.getItem('radio_stations');
    if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) return parsed; } catch {} }
    return [];
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('radio_favorites');
    try { const parsed = saved ? JSON.parse(saved) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  });

  // MODALS & UI STATE
  const [onlyFavoritesMode, setOnlyFavoritesMode] = useState<boolean>(() => localStorage.getItem('radio_only_favorites') === 'true');
  const [activeStationId, setActiveStationId] = useState<string>(() => localStorage.getItem('radio_last_active') || '');
  const [playingStationId, setPlayingStationId] = useState<string>(() => localStorage.getItem('radio_last_playing') || '');
  const [lastPlayedFavoriteId, setLastPlayedFavoriteId] = useState<string>(() => localStorage.getItem('radio_last_fav') || '');

  const [playlistFilter, setPlaylistFilter] = useState<'all' | 'favorites'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [showManualImport, setShowManualImport] = useState(false);
  const [manualImportValue, setManualImportValue] = useState('');
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // SLEEP TIMER STATE
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [sleepTimerEndDate, setSleepTimerEndDate] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [customTimerInput, setCustomTimerInput] = useState('');
  const sleepTimerTimeoutRef = useRef<number | null>(null);

  // SHEET LOGIC
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const sheetDragControls = useDragControls();
  const listRef = useRef<HTMLDivElement>(null);

  // SWIPER & AUDIO
  const [swiperInstance, setSwiperInstance] = useState<SwiperClass | null>(null);
  const isReorderingRef = useRef(false);
  const [editorPreviewUrl, setEditorPreviewUrl] = useState('');
  const [editorName, setEditorName] = useState('');

  // PERSISTENCE
  useEffect(() => { localStorage.setItem('radio_stations', JSON.stringify(stations)); }, [stations]);
  useEffect(() => { localStorage.setItem('radio_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('radio_only_favorites', String(onlyFavoritesMode)); }, [onlyFavoritesMode]);
  useEffect(() => { localStorage.setItem('radio_last_active', activeStationId); }, [activeStationId]);
  useEffect(() => { localStorage.setItem('radio_last_playing', playingStationId); }, [playingStationId]);
  useEffect(() => { localStorage.setItem('radio_last_fav', lastPlayedFavoriteId); }, [lastPlayedFavoriteId]);
  useEffect(() => { if (!snackbar) return; const t = setTimeout(() => setSnackbar(null), 3000); return () => clearTimeout(t); }, [snackbar]);

  const hasStations = stations.length > 0;
  const hasFavorites = favorites.length > 0;

  const displayedStations = useMemo(() => {
    if (!stations.length) return [];
    if (!onlyFavoritesMode) return stations;
    return stations.filter(s => favorites.includes(s.id));
  }, [stations, favorites, onlyFavoritesMode]);

  const stationsInPlaylist = useMemo(() => {
    if (playlistFilter === 'favorites') return stations.filter(s => favorites.includes(s.id));
    return stations;
  }, [playlistFilter, stations, favorites]);

  const activeStation = useMemo<Station | null>(() => {
    if (!displayedStations.length) return null;
    return displayedStations.find(s => s.id === activeStationId) || displayedStations[0] || null;
  }, [displayedStations, activeStationId]);

  const initialSlideIndex = useMemo(() => {
    const idx = displayedStations.findIndex(s => s.id === activeStationId);
    return idx === -1 ? 0 : idx;
  }, [displayedStations, activeStationId]);

  const playingStation = useMemo<Station | null>(() => {
    return stations.find(s => s.id === playingStationId) || null;
  }, [stations, playingStationId]);

  const { status, volume, setVolume, play, stop } = useAudio(playingStation?.streamUrl || null);

  // CONTROL HANDLERS
  const handleTogglePlay = useCallback(() => {
    if (!activeStation) return;
    if (playingStationId === activeStationId) {
      if (status === 'playing' || status === 'loading') { hapticImpact('soft'); stop(); }
      else { hapticImpact('medium'); play(activeStation.streamUrl); }
    } else {
      setPlayingStationId(activeStationId);
      if (favorites.includes(activeStationId)) setLastPlayedFavoriteId(activeStationId);
      hapticImpact('medium'); play(activeStation.streamUrl);
    }
  }, [activeStationId, playingStationId, status, activeStation, hapticImpact, play, stop, favorites]);

  // SLEEP TIMER LOGIC
  const handleSetSleepTimer = useCallback((minutes: number) => {
    if (sleepTimerTimeoutRef.current) { clearTimeout(sleepTimerTimeoutRef.current); sleepTimerTimeoutRef.current = null; }
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
        const min = Math.floor((remaining / 1000) / 60);
        const sec = Math.floor((remaining / 1000) % 60);
        setTimeRemaining(`${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndDate]);

  // PLAYLIST HANDLERS
  const handleReorder = (reorderedItems: Station[]) => {
    isReorderingRef.current = true;
    const reorderedIds = new Set(reorderedItems.map(item => item.id));
    const newStations = [...reorderedItems, ...stations.filter(item => !reorderedIds.has(item.id))];
    setStations(newStations);
    hapticImpact('light');
    setTimeout(() => { isReorderingRef.current = false; }, 150);
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

  const toggleOnlyFavoritesMode = useCallback(() => {
    if (!hasStations) return;
    if (!hasFavorites && !onlyFavoritesMode) { 
        setSnackbar('В избранном пусто'); 
        hapticNotification('warning'); 
        return; 
    }
    const next = !onlyFavoritesMode;
    setOnlyFavoritesMode(next);
    hapticImpact('medium');
    setSnackbar(next ? 'Только избранное' : 'Все станции');
  }, [onlyFavoritesMode, hasStations, hasFavorites, hapticImpact, hapticNotification]);

  const navigateStation = (navDir: 'next' | 'prev') => {
    if (!swiperInstance) return;
    hapticImpact('medium');
    if (navDir === 'next') swiperInstance.slideNext();
    else swiperInstance.slidePrev();
  };

  const closeAllModals = useCallback(() => {
    setShowEditor(false); setShowConfirmModal(false); setShowSleepTimerModal(false);
    setShowAboutModal(false); setShowManualImport(false); setEditingStation(null);
    if (isSheetExpanded) setIsSheetExpanded(false);
  }, [isSheetExpanded]);

  // Fix: Implement missing addOrUpdateStation handler
  const addOrUpdateStation = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name') as string;
    const streamUrl = fd.get('url') as string;
    
    if (editingStation) {
      setStations(prev => prev.map(s => s.id === editingStation.id ? { ...s, name, streamUrl } : s));
      setSnackbar('Обновлено');
    } else {
      const newStation: Station = {
        id: Date.now().toString(),
        name,
        streamUrl,
        addedAt: Date.now()
      };
      setStations(prev => [...prev, newStation]);
      setSnackbar('Добавлено');
    }
    closeAllModals();
  }, [editingStation, setStations, setSnackbar, closeAllModals]);

  useEffect(() => {
    const isModalOpen = showEditor || isSheetExpanded || showConfirmModal || showSleepTimerModal || showAboutModal || showManualImport;
    setBackButton(isModalOpen, closeAllModals);
  }, [showEditor, isSheetExpanded, showConfirmModal, showSleepTimerModal, showAboutModal, showManualImport, setBackButton, closeAllModals]);

  const nativeAccentColor = themeParams?.button_color || '#2563eb';
  const nativeDestructiveColor = themeParams?.destructive_text_color || '#ef4444';
  const nativeBgColor = themeParams?.bg_color || '#ffffff';
  const nativeTextColor = themeParams?.text_color || '#222222';
  const canPlay = Boolean(activeStation?.streamUrl);

  return (
    <div className="flex flex-col overflow-hidden transition-colors duration-500 relative" style={{ height: 'var(--tg-viewport-height, 100vh)', color: nativeTextColor, backgroundColor: nativeBgColor }}>
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20 bg-[radial-gradient(circle_at_center,_#3b82f6_0%,_transparent_70%)]" />
      
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 bg-white/70 dark:bg-black/30 border-b border-black/5 dark:border-white/10 z-20 shrink-0 backdrop-blur-[70px]" style={{ paddingTop: isMobile ? 'calc(var(--tg-safe-top, 0px) + 46px)' : 'calc(var(--tg-safe-top, 0px) + 16px)', paddingBottom: '12px' }}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowAboutModal(true)}>
          <Logo className="w-8 h-8" style={{ color: nativeAccentColor }} />
          <h1 className="text-2xl font-black tracking-tighter">Radio</h1>
        </div>
        <div className="flex items-center gap-2">
          <RippleButton 
            onClick={toggleOnlyFavoritesMode} 
            className={`w-[38px] h-[38px] flex items-center justify-center rounded-full transition-all ${onlyFavoritesMode ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-500' : 'text-gray-400'}`}
          >
            <Icons.Star />
          </RippleButton>
          <RippleButton 
            onClick={() => setShowSleepTimerModal(true)}
            className={`h-[38px] rounded-full flex items-center justify-center transition-all ${sleepTimerEndDate ? 'bg-blue-600 text-white px-3 gap-2' : 'w-[38px] text-gray-400'}`}
            style={{ backgroundColor: sleepTimerEndDate ? nativeAccentColor : undefined }}
          >
            <Icons.Timer className="w-5 h-5" />
            {sleepTimerEndDate && <span className="text-[10px] font-black">{timeRemaining}</span>}
          </RippleButton>
        </div>
      </div>

      {/* COVER SECTION */}
      <main className="flex-1 flex flex-col items-center justify-start pt-12 overflow-hidden relative z-10">
        <motion.div 
            animate={{ 
                scale: isSheetExpanded ? 0.8 : 1, 
                y: isSheetExpanded ? -60 : 0, 
                opacity: isSheetExpanded ? 0.3 : 1,
                filter: isSheetExpanded ? 'blur(10px)' : 'blur(0px)'
            }}
            transition={{ type: 'spring', damping: 25 }}
            className="relative w-[340px] aspect-square shrink-0"
        >
          {displayedStations.length > 0 ? (
            <Swiper
              key={`swiper-${displayedStations.length}`}
              initialSlide={initialSlideIndex}
              onSwiper={setSwiperInstance}
              onSlideChange={(swiper) => {
                if (isReorderingRef.current) return;
                const target = displayedStations[swiper.realIndex];
                if (target) {
                    setActiveStationId(target.id);
                    if (status === 'playing' || status === 'loading') {
                        setPlayingStationId(target.id); play(target.streamUrl);
                    }
                }
                hapticImpact('light');
              }}
              loop={displayedStations.length > 1}
              effect={'creative'} slidesPerView={1}
              creativeEffect={{ limitProgress: 3, perspective: true, prev: { translate: ['-100%', 0, -200], rotate: [0, 0, -15], opacity: 0 }, next: { translate: ['100%', 0, -200], rotate: [0, 0, 15], opacity: 0 } }}
              modules={[EffectCreative, Keyboard]} keyboard={{ enabled: true }}
              className="mySwiper w-full h-full !overflow-visible"
            >
              {displayedStations.map((station) => (
                <SwiperSlide key={station.id} className="w-full h-full flex justify-center">
                  <div className="relative w-full aspect-square rounded-[2.5rem] overflow-hidden bg-white/10 border-2" style={{ borderColor: activeStationId === station.id ? `${nativeAccentColor}44` : 'transparent' }}>
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
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-white/5 rounded-[2.5rem] border-2 border-dashed border-gray-300">
                <p className="text-gray-400 font-black mb-4">Список пуст</p>
                <RippleButton onClick={handleDemo} className="px-6 py-2 bg-blue-600 text-white rounded-full font-black text-xs uppercase" style={{ backgroundColor: nativeAccentColor }}>Демо список</RippleButton>
            </div>
          )}
        </motion.div>
      </main>

      {/* UNIFIED BOTTOM SHEET */}
      <motion.div 
        drag="y"
        dragControls={sheetDragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.5 }}
        onDragEnd={(_, info) => {
            if (info.offset.y < -40) setIsSheetExpanded(true);
            else if (info.offset.y > 40) setIsSheetExpanded(false);
        }}
        animate={{ height: isSheetExpanded ? '92vh' : '280px' }}
        transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-black/80 rounded-t-[3.5rem] border-t border-white/20 shadow-2xl backdrop-blur-[80px] flex flex-col overflow-hidden"
      >
        {/* DRAG ZONE & HEADER */}
        <div 
            className="w-full flex flex-col items-center pt-4 pb-2 shrink-0 touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => sheetDragControls.start(e)}
        >
          <div className="w-16 h-1.5 bg-black/10 dark:bg-white/10 rounded-full mb-6" />
          
          <div className="text-center w-full px-10 min-h-[50px] flex flex-col justify-center mb-4">
            <h2 className="text-xl font-black truncate tracking-tight">{activeStation?.name || 'Нет данных'}</h2>
            <p className="text-[10px] opacity-40 uppercase tracking-[0.3em] font-black mt-1">
                {status === 'loading' ? 'Загрузка...' : (status === 'playing' ? 'В эфире' : 'Пауза')}
            </p>
          </div>

          <div className="w-full max-w-[280px] mb-6">
            <input 
                type="range" min="0" max="1" step="0.01" value={volume} 
                onChange={(e) => setVolume(parseFloat(e.target.value))} 
                className="w-full h-1.5 bg-black/5 rounded-full appearance-none cursor-pointer" 
                style={{ accentColor: nativeAccentColor }}
                disabled={!canPlay} 
            />
          </div>

          <div className="w-full flex items-center justify-evenly px-6 pb-2">
            <RippleButton onClick={() => navigateStation('prev')} className="p-4 opacity-40"><Icons.Prev /></RippleButton>
            <RippleButton onClick={handleTogglePlay} className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl" style={{ backgroundColor: canPlay ? nativeAccentColor : '#ccc' }} disabled={!canPlay}>
                {status === 'playing' || status === 'loading' ? <Icons.Pause className="w-8 h-8" /> : <Icons.Play className="w-8 h-8" />}
            </RippleButton>
            <RippleButton onClick={() => navigateStation('next')} className="p-4 opacity-40"><Icons.Next /></RippleButton>
          </div>
        </div>

        {/* LIST SECTION */}
        <div className="flex-1 overflow-hidden flex flex-col px-6 mt-4">
            <div className="flex items-center bg-black/5 dark:bg-white/[0.04] rounded-2xl p-1 mb-4">
                <button onClick={() => setPlaylistFilter('all')} className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${playlistFilter === 'all' ? 'bg-white shadow-sm' : 'opacity-40'}`} style={{ color: playlistFilter === 'all' ? nativeAccentColor : undefined }}>Все</button>
                <button onClick={() => setPlaylistFilter('favorites')} className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${playlistFilter === 'favorites' ? 'bg-white shadow-sm' : 'opacity-40'}`} style={{ color: playlistFilter === 'favorites' ? nativeAccentColor : undefined }}>Избранное</button>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain pb-40">
                {stationsInPlaylist.length > 0 ? (
                <ReorderGroup axis="y" values={stationsInPlaylist} onReorder={handleReorder} className="space-y-2">
                    {stationsInPlaylist.map(s => (
                        <ReorderStationItem 
                            key={s.id} station={s} isActive={activeStationId === s.id} isPlaying={playingStationId === s.id}
                            isFavorite={favorites.includes(s.id)} status={status} accentColor={nativeAccentColor} destructiveColor={nativeDestructiveColor}
                            onSelect={() => { if(activeStationId === s.id) handleTogglePlay(); else { setActiveStationId(s.id); setPlayingStationId(s.id); play(s.streamUrl); } }} 
                            onToggleFavorite={(e) => toggleFavorite(s.id, e)} 
                            onEdit={(e) => { e.stopPropagation(); setEditingStation(s); setShowEditor(true); }} 
                            onDelete={(e) => { e.stopPropagation(); setConfirmData({ message: 'Удалить станцию?', onConfirm: () => setStations(prev => prev.filter(st => st.id !== s.id)) }); setShowConfirmModal(true); }} 
                        />
                    ))}
                </ReorderGroup>
                ) : <div className="py-20 text-center opacity-30 font-black uppercase text-[10px] tracking-widest">Список пуст</div>}
                
                <div className="mt-8 flex flex-col gap-3">
                    <RippleButton onClick={() => setShowEditor(true)} className="w-full p-6 rounded-3xl border-2 border-dashed border-gray-300 opacity-40 hover:opacity-100 font-black flex items-center justify-center gap-3 transition-all"><Icons.Add /> Добавить вручную</RippleButton>
                    <div className="grid grid-cols-2 gap-2">
                        <RippleButton onClick={handleDemo} className="p-4 bg-black/5 rounded-2xl text-[10px] font-black opacity-60"><Icons.Reset className="mx-auto mb-1" /> Демо список</RippleButton>
                        {/* Fix: Merged duplicate onClick attributes */}
                        <RippleButton className="p-4 bg-red-500/10 rounded-2xl text-[10px] font-black text-red-500" onClick={() => {setConfirmData({message: 'Очистить всё?', onConfirm: () => {setStations([]); setFavorites([]);}}); setShowConfirmModal(true);}}><Icons.Reset className="mx-auto mb-1" /> Сброс</RippleButton>
                    </div>
                </div>
            </div>
        </div>
      </motion.div>

      {/* MODALS */}
      <AnimatePresence>
        {showSleepTimerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-white dark:bg-black rounded-[3rem] p-10 flex flex-col shadow-2xl border border-white/10">
              <h3 className="text-2xl font-black mb-6 text-center tracking-tighter">Таймер сна</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[15, 30, 45, 60].map(m => (
                  <RippleButton key={m} onClick={() => handleSetSleepTimer(m)} className="py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-black text-lg" style={{ color: nativeAccentColor }}>{m}м</RippleButton>
                ))}
              </div>
              <div className="flex gap-4">
                <RippleButton onClick={() => handleSetSleepTimer(0)} className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-2xl font-black">Выключить</RippleButton>
                <RippleButton onClick={closeAllModals} className="flex-1 py-4 bg-black/5 rounded-2xl font-black">Закрыть</RippleButton>
              </div>
            </motion.div>
          </div>
        )}

        {showConfirmModal && confirmData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-white dark:bg-black rounded-[2.5rem] p-10 shadow-2xl border border-white/10">
              <h3 className="text-xl font-black mb-4 text-center">Вы уверены?</h3>
              <p className="font-bold opacity-50 mb-8 text-center">{confirmData.message}</p>
              <div className="flex gap-4">
                <RippleButton onClick={closeAllModals} className="flex-1 py-4 bg-black/5 rounded-2xl font-black">Нет</RippleButton>
                <RippleButton onClick={() => { confirmData.onConfirm(); closeAllModals(); }} className="flex-1 py-4 text-white rounded-2xl font-black" style={{ backgroundColor: nativeDestructiveColor }}>Да</RippleButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editor Modal Simplified */}
      <AnimatePresence>
        {showEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
                <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-white dark:bg-black rounded-[2.5rem] p-10 shadow-2xl border border-white/10">
                    <h3 className="text-2xl font-black mb-6 tracking-tighter">Станция</h3>
                    <form onSubmit={addOrUpdateStation} className="flex flex-col gap-4">
                        <input name="name" required placeholder="Название" defaultValue={editingStation?.name || ''} className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-6 py-4 outline-none font-bold" />
                        <input name="url" type="url" required placeholder="URL потока" defaultValue={editingStation?.streamUrl || ''} className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-6 py-4 outline-none font-bold" />
                        <div className="flex gap-4 mt-4">
                            <RippleButton type="button" onClick={closeAllModals} className="flex-1 py-4 bg-black/5 rounded-xl font-black">Отмена</RippleButton>
                            <RippleButton type="submit" className="flex-1 py-4 text-white rounded-xl font-black" style={{ backgroundColor: nativeAccentColor }}>ОК</RippleButton>
                        </div>
                    </form>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {snackbar && (
        <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} className="fixed bottom-12 left-8 right-8 z-[100] bg-black/95 text-white px-8 py-5 rounded-3xl font-bold flex items-center justify-between shadow-2xl">
          <span className="text-sm">{snackbar}</span>
          <button onClick={() => setSnackbar(null)} className="font-black uppercase text-xs ml-4" style={{ color: nativeAccentColor }}>OK</button>
        </motion.div>
      )}
    </div>
  );
};

// COMPONENT WITH DRAG HANDLE TO AVOID SCROLL CONFLICT
const ReorderStationItem: React.FC<{
    station: Station; isActive: boolean; isPlaying: boolean; isFavorite: boolean; 
    status: PlayerStatus; accentColor: string; destructiveColor: string;
    onSelect: () => void; onEdit: (e: any) => void; onDelete: (e: any) => void;
    onToggleFavorite: (e: any) => void;
}> = ({ station, isActive, isPlaying, isFavorite, status, accentColor, destructiveColor, onSelect, onEdit, onDelete, onToggleFavorite }) => {
    const dragControls = useDragControls();
    
    return (
        <ReorderItem
            value={station}
            dragListener={false}
            dragControls={dragControls}
            className={`flex items-center gap-3 p-2 rounded-2xl border-2 ${isActive ? 'bg-blue-50/50 dark:bg-white/5 border-blue-100/50' : 'bg-white dark:bg-white/0 border-transparent'}`}
            onClick={onSelect}
        >
            {/* DRAG HANDLE */}
            <div 
                className="p-2 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
                onPointerDown={(e) => dragControls.start(e)}
            >
                <Icons.Drag className="w-5 h-5" />
            </div>

            <div className="relative w-12 h-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                <StationCover station={station} className="w-full h-full" />
                {isPlaying && (status === 'playing' || status === 'loading') && <MiniEqualizer />}
            </div>

            <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: isActive ? accentColor : undefined }}>{station.name}</p>
                <p className="text-[9px] opacity-30 truncate uppercase font-black">{station.streamUrl}</p>
            </div>

            <div className="flex gap-1">
                <RippleButton onClick={onToggleFavorite} className={`p-2 rounded-lg ${isFavorite ? 'text-amber-500' : 'text-gray-200'}`}><Icons.Star /></RippleButton>
                <RippleButton onClick={onEdit} className="p-2 rounded-lg text-gray-300"><Icons.Settings className="w-4 h-4" /></RippleButton>
            </div>
        </ReorderItem>
    );
};
