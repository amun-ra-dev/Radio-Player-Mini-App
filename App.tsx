
// Build: 2.0.3
// - Security: Added strict JSON schema validation for imports.
// - Security: URL sanitization to prevent javascript: protocol execution.
// - UI: Fixed modal centering and template copy.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
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

const StationCover: React.FC<{ station: Station | null | undefined; className?: string }> = ({ station, className = "" }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [station?.id, station?.coverUrl]);

  if (!station) return <div className={`${className} bg-blue-600 flex items-center justify-center text-white text-5xl font-black`}>+</div>;

  if (!station.coverUrl || hasError) {
    return (
      <div className={`${className} bg-blue-600 flex items-center justify-center text-white text-7xl font-black`}>
        {station.name?.charAt(0)?.toUpperCase?.() || 'R'}
      </div>
    );
  }

  return (
    <div className={`${className} relative bg-gray-200 dark:bg-[#1a1a1a] overflow-hidden`}>
      <motion.img
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        src={station.coverUrl}
        alt={station.name}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover"
      />
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-[#1a1a1a]">
          <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  const { hapticImpact, hapticNotification, setBackButton, isMobile } = useTelegram();

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

  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlistFilter, setPlaylistFilter] = useState<'all' | 'favorites'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [sleepTimerEndDate, setSleepTimerEndDate] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [customTimerInput, setCustomTimerInput] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [swiperInstance, setSwiperInstance] = useState<SwiperClass | null>(null);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);

  const [editorPreviewUrl, setEditorPreviewUrl] = useState('');
  const [editorName, setEditorName] = useState('');
  const [editorTags, setEditorTags] = useState('');

  const sleepTimerTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    const handleOnline = () => { setIsOffline(false); setSnackbar('Снова в сети!'); hapticNotification('success'); };
    const handleOffline = () => { setIsOffline(true); setSnackbar('Нет подключения к интернету'); hapticNotification('warning'); };
    window.addEventListener('resize', handleResize);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [hapticNotification]);

  useEffect(() => { localStorage.setItem('radio_stations', JSON.stringify(stations)); }, [stations]);
  useEffect(() => { localStorage.setItem('radio_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('radio_only_favorites', String(onlyFavoritesMode)); }, [onlyFavoritesMode]);
  useEffect(() => { localStorage.setItem('radio_last_active', activeStationId); }, [activeStationId]);
  useEffect(() => { localStorage.setItem('radio_last_playing', playingStationId); }, [playingStationId]);
  useEffect(() => { if (!snackbar) return; const timer = setTimeout(() => setSnackbar(null), 3000); return () => clearTimeout(timer); }, [snackbar]);

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

  // Fix: Defined missing canPlay variable to fix errors in the UI components
  const canPlay = !!activeStation;

  const playingStation = useMemo<Station | null>(() => {
    if (!stations.length) return null;
    return stations.find(s => s.id === playingStationId) || null;
  }, [stations, playingStationId]);

  const { status, volume, setVolume, togglePlay: baseTogglePlay, play, stop } = useAudio(playingStation?.streamUrl || null);

  const handleTogglePlay = useCallback(() => {
    if (isOffline) { setSnackbar('Интернет недоступен'); hapticImpact('rigid'); return; }
    if (!activeStation) return;
    if (playingStationId === activeStationId && status !== 'idle') { baseTogglePlay(); } 
    else { setPlayingStationId(activeStationId); hapticImpact('medium'); play(activeStation.streamUrl); }
  }, [activeStationId, playingStationId, status, baseTogglePlay, activeStation, hapticImpact, isOffline]);

  const handleSetSleepTimer = useCallback((minutes: number) => {
    if (sleepTimerTimeoutRef.current) { clearTimeout(sleepTimerTimeoutRef.current); sleepTimerTimeoutRef.current = null; }
    if (minutes > 0) {
      const endDate = Date.now() + minutes * 60 * 1000;
      setSleepTimerEndDate(endDate);
      sleepTimerTimeoutRef.current = window.setTimeout(() => {
        stop(); setSleepTimerEndDate(null); setSnackbar('Таймер завершен'); hapticNotification('success');
      }, minutes * 60 * 1000);
      setSnackbar(`Таймер: ${minutes} мин`); hapticImpact('light');
    } else { setSleepTimerEndDate(null); setSnackbar('Таймер отключен'); }
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
    }, 250);
    return () => clearInterval(interval);
  }, [sleepTimerEndDate]);

  const toggleFavorite = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); hapticImpact('light');
    setFavorites(prev => { const isFav = prev.includes(id); return isFav ? prev.filter(fid => fid !== id) : [...prev, id]; });
  }, [hapticImpact]);

  const toggleOnlyFavoritesMode = useCallback(() => {
    if (!hasStations) return;
    if (!hasFavorites && !onlyFavoritesMode) { setSnackbar('Добавьте в избранное'); hapticNotification('warning'); return; }
    const nextMode = !onlyFavoritesMode;
    setOnlyFavoritesMode(nextMode); hapticImpact('medium');
    setSnackbar(nextMode ? 'Избранное: ВКЛ' : 'Избранное: ВЫКЛ');
  }, [onlyFavoritesMode, hapticImpact, hapticNotification, hasStations, hasFavorites]);

  const navigateStation = useCallback((navDir: 'next' | 'prev') => {
    if (!swiperInstance) return;
    hapticImpact('medium');
    if (navDir === 'next') swiperInstance.slideNext();
    else swiperInstance.slidePrev();
  }, [swiperInstance, hapticImpact]);

  const handleSelectStation = useCallback((station: Station) => {
    if (!station) return;
    if (activeStationId === station.id) { handleTogglePlay(); } 
    else { setActiveStationId(station.id); setPlayingStationId(station.id); hapticImpact('light'); if (!isOffline) play(station.streamUrl); else setSnackbar('Вы оффлайн'); }
  }, [activeStationId, handleTogglePlay, hapticImpact, play, isOffline]);

  const closeAllModals = useCallback(() => {
    setShowEditor(false); setShowPlaylist(false); setShowConfirmModal(false);
    setShowSleepTimerModal(false); setShowAboutModal(false); setEditingStation(null);
  }, []);

  useEffect(() => {
    const isModalOpen = showEditor || showPlaylist || showConfirmModal || showSleepTimerModal || showAboutModal;
    setBackButton(isModalOpen, closeAllModals);
  }, [showEditor, showPlaylist, showConfirmModal, showSleepTimerModal, showAboutModal, setBackButton, closeAllModals]);

  // Хелпер для очистки URL от javascript: инъекций
  const sanitizeUrl = (url: string) => {
    if (!url) return '';
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:text/html')) {
      return '';
    }
    return url.trim();
  };

  const handleImport = async () => {
    try { 
      const text = await navigator.clipboard.readText(); 
      if (text && (text.includes('[') || text.includes('{'))) {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        
        // Строгая валидация и очистка данных
        const normalized = list
          .filter((s: any) => s && typeof s === 'object' && s.name && (s.url || s.streamUrl))
          .map((s: any) => {
            const streamUrl = sanitizeUrl(s.url || s.streamUrl);
            if (!streamUrl) return null;
            
            return {
              id: Math.random().toString(36).substr(2, 9),
              name: String(s.name).substring(0, 50), // Ограничение длины
              streamUrl: streamUrl,
              coverUrl: sanitizeUrl(s.coverUrl || ''),
              tags: Array.isArray(s.tags) ? s.tags.map((t: any) => String(t).substring(0, 20)) : [],
              addedAt: Date.now()
            };
          })
          .filter(Boolean) as Station[];

        if (normalized.length > 0) {
          setStations(prev => [...prev, ...normalized]);
          setSnackbar(`Добавлено: ${normalized.length}`);
          hapticNotification('success');
        } else {
          setSnackbar('Нет подходящих данных');
        }
      } else {
        setSnackbar('Буфер пуст или не JSON');
        hapticNotification('warning');
      }
    } catch (e) { setSnackbar('Нужен доступ к буферу'); }
  };

  const handleCopyTemplate = useCallback(() => {
    const template = `[
  {
    "name": "Radio Name",
    "streamUrl": "https://url.to/stream.mp3",
    "coverUrl": "https://url.to/cover.jpg",
    "tags": ["genre1", "genre2"]
  }
]`;
    navigator.clipboard.writeText(template).then(() => {
      hapticNotification('success');
      setSnackbar('Шаблон скопирован!');
    }).catch(() => {
      setSnackbar('Нужен доступ к буферу');
      hapticNotification('error');
    });
  }, [hapticNotification]);

  const handleReset = () => {
    setConfirmData({ message: 'Очистить весь плейлист?', onConfirm: () => { setStations([]); setFavorites([]); setOnlyFavoritesMode(false); setActiveStationId(''); setPlayingStationId(''); stop(); hapticImpact('heavy'); setSnackbar('Плейлист очищен'); } });
    setShowConfirmModal(true);
  };

  const handleDemo = () => {
    setConfirmData({ message: 'Добавить стандартный список?', onConfirm: () => { setStations(DEFAULT_STATIONS); if (DEFAULT_STATIONS.length > 0) { setActiveStationId(DEFAULT_STATIONS[0].id); } setSnackbar(`Добавлено станций: ${DEFAULT_STATIONS.length}`); hapticNotification('success'); } });
    setShowConfirmModal(true);
  };

  const addOrUpdateStation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get('name')).substring(0, 50);
    const url = sanitizeUrl(formData.get('url') as string);
    const coverUrl = sanitizeUrl(formData.get('coverUrl') as string);
    const tags = (formData.get('tags') as string).split(',').map(t => t.trim().substring(0, 20)).filter(Boolean);
    
    if (!name || !url) return;
    
    if (editingStation) { 
        setStations(prev => prev.map(s => s.id === editingStation.id ? { ...s, name, streamUrl: url, coverUrl, tags } : s)); 
        setEditingStation(null); setSnackbar('Обновлено'); 
    } else {
      const id = Math.random().toString(36).substr(2, 9);
      const s: Station = { id, name, streamUrl: url, coverUrl, tags, addedAt: Date.now() };
      setStations(prev => [...prev, s]); if (!activeStationId) setActiveStationId(id); setSnackbar('Добавлено');
    }
    setShowEditor(false); hapticImpact('light');
  };

  return (
    <div className="flex flex-col min-h-screen text-[#222222] dark:text-white bg-[#f5f5f5] dark:bg-[#121212] transition-colors duration-300 overflow-hidden">
      <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto md:px-6">
        
        <header className="flex items-center justify-between px-6 py-4 md:py-6 bg-white dark:bg-[#1f1f1f] md:bg-transparent dark:md:bg-transparent shadow-md md:shadow-none z-10 shrink-0 border-b md:border-none border-gray-100 dark:border-gray-800" style={{ paddingTop: isMobile ? 'calc(var(--tg-safe-top, 0px) + 46px)' : 'calc(var(--tg-safe-top, 0px) + 16px)' }}>
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setShowAboutModal(true)}>
            <Logo className="w-8 h-8 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
            <h1 className="text-xl md:text-2xl font-black tracking-tighter leading-none">Radio Player</h1>
          </div>
          <div className="flex items-center gap-1 md:gap-3">
            <RippleButton onClick={toggleOnlyFavoritesMode} disabled={!hasStations} className={`w-[38px] md:w-[44px] h-[38px] md:h-[44px] flex items-center justify-center rounded-full transition-all ${!hasStations ? 'opacity-20 pointer-events-none' : onlyFavoritesMode ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500 scale-110 shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}><Icons.Star /></RippleButton>
            <motion.button layout disabled={!hasStations} onClick={() => setShowSleepTimerModal(true)} className={`ripple h-[38px] md:h-[44px] rounded-full relative flex items-center justify-center transition-all ${!hasStations ? 'w-[38px] opacity-20 pointer-events-none' : (sleepTimerEndDate ? 'bg-blue-600 dark:bg-blue-500 text-white px-4' : 'w-[38px] md:w-[44px] text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5')}`}>
              {sleepTimerEndDate ? <span className="font-black text-sm">{Math.ceil((sleepTimerEndDate - Date.now()) / 60000)}m</span> : <Icons.Timer />}
            </motion.button>
            <RippleButton onClick={() => setShowPlaylist(true)} className="w-[38px] md:w-[44px] h-[38px] md:h-[44px] flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"><Icons.List /></RippleButton>
          </div>
        </header>

        <main className="flex-1 flex flex-col md:flex-row items-center justify-around md:justify-center md:gap-12 py-4 px-6 overflow-hidden relative">
          <div className="relative w-full max-w-[340px] md:max-w-[420px] aspect-square shrink-0">
            {hasStations ? (
              <Swiper
                onSwiper={setSwiperInstance}
                onSlideChange={(swiper) => setActiveStationId(displayedStations[swiper.realIndex]?.id)}
                loop={displayedStations.length > 1}
                effect={'creative'}
                grabCursor={true}
                slidesPerView={1}
                creativeEffect={{
                  limitProgress: 3, perspective: true,
                  prev: { translate: ['-120%', 0, 0], rotate: [0, 0, -20], opacity: 0 },
                  next: { translate: ['12px', 0, -100], scale: 0.9, opacity: 0.6 },
                }}
                modules={[EffectCreative, Keyboard]}
                keyboard={{ enabled: true }}
                className="mySwiper w-full h-full !overflow-visible"
              >
                {displayedStations.map((station) => (
                  <SwiperSlide key={station.id}>
                    <div className={`relative w-full aspect-square rounded-[2.5rem] md:rounded-[3rem] shadow-2xl dark:shadow-black/60 overflow-hidden bg-white dark:bg-[#1c1c1c] ${canPlay ? 'cursor-pointer' : 'cursor-default'}`} onClick={() => canPlay && handleTogglePlay()}>
                      <StationCover station={station} className="w-full h-full" />
                      <div className="absolute bottom-6 right-6 z-20" onClick={(e) => toggleFavorite(station.id, e)}>
                        <RippleButton className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${favorites.includes(station.id) ? 'bg-amber-500 text-white scale-105 shadow-amber-500/30' : 'bg-black/30 text-white/60 hover:bg-black/40'}`}>
                          {favorites.includes(station.id) ? <Icons.Star /> : <Icons.StarOutline />}
                        </RippleButton>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-full aspect-square rounded-[2rem] md:rounded-[3rem] bg-[#1a4ab2] flex flex-col items-center justify-center text-center p-8 shadow-2xl">
                  <h2 className="text-white text-3xl font-black mb-1">Нет станций</h2>
                  <p className="text-white/70 text-sm font-bold mb-10">Добавьте первую станцию в плейлист</p>
                  <div className="flex flex-col gap-4 w-full max-w-xs">
                    <RippleButton onClick={() => { setEditingStation(null); setShowEditor(true); }} className="w-full py-5 bg-[#2f6ff7] hover:bg-[#3d7fff] text-white rounded-2xl font-black shadow-lg shadow-blue-900/40 text-lg">Добавить станцию</RippleButton>
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <RippleButton onClick={handleImport} className="py-4 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-black">Импорт JSON</RippleButton>
                        <RippleButton onClick={handleDemo} className="py-4 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-black">Демо</RippleButton>
                      </div>
                      <RippleButton onClick={handleCopyTemplate} className="py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black border border-white/5 text-xs opacity-80">Добавить, копировать пустой шаблон</RippleButton>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-full max-w-[400px] md:max-w-[360px]">
            <div className="flex flex-col items-center mx-auto">
              <div className="w-full flex flex-col items-center gap-8 py-4">
                <div className="text-center w-full px-4 min-h-[80px] flex flex-col justify-center">
                    <h2 className="text-2xl md:text-3xl font-black mb-1 truncate leading-tight dark:text-white">{activeStation?.name || 'Выберите станцию'}</h2>
                    <p className="text-[10px] md:text-[11px] opacity-40 uppercase tracking-[0.2em] font-black dark:text-white/40">
                         {!activeStation ? 'Ожидание' : (playingStationId === activeStationId && status === 'playing' ? 'В эфире' : playingStationId === activeStationId && status === 'loading' ? 'Загрузка...' : 'Пауза')}
                    </p>
                </div>

                <div className="w-full flex items-center justify-around">
                  <RippleButton onClick={() => navigateStation('prev')} className={`p-5 transition-all ${displayedStations.length > 1 ? 'text-gray-500 dark:text-gray-400 active:scale-90' : 'text-gray-300 dark:text-gray-700 opacity-20 pointer-events-none'}`}><Icons.Prev /></RippleButton>
                  <RippleButton onClick={() => canPlay && handleTogglePlay()} className={`w-20 md:w-24 h-20 md:h-24 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${canPlay ? 'bg-blue-600 text-white shadow-blue-600/30' : 'bg-gray-200 dark:bg-[#2c2c2c] text-gray-400 dark:text-gray-600'}`} disabled={!canPlay}>
                      {(playingStationId === activeStationId) && (status === 'playing' || status === 'loading') ? <Icons.Pause /> : <Icons.Play />}
                  </RippleButton>
                  <RippleButton onClick={() => navigateStation('next')} className={`p-5 transition-all ${displayedStations.length > 1 ? 'text-gray-500 dark:text-gray-400 active:scale-90' : 'text-gray-300 dark:text-gray-700 opacity-20 pointer-events-none'}`}><Icons.Next /></RippleButton>
                </div>

                <div className="w-full max-w-[280px] flex items-center gap-4">
                  <span className="text-gray-400"><Icons.Drag /></span>
                  <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 dark:bg-[#2c2c2c] rounded-full appearance-none accent-blue-600 cursor-pointer" disabled={!canPlay} />
                </div>
              </div>
              
              {!isDesktop && (
                <div className="flex flex-col items-center gap-2 pt-4 text-gray-300 dark:text-gray-700 cursor-pointer opacity-50" onClick={() => setShowPlaylist(true)}>
                  <div className="w-10 h-1 rounded-full bg-current" />
                  <span className="text-[8px] uppercase font-black tracking-widest">Плейлист</span>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {showPlaylist && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-30 backdrop-blur-sm" onClick={closeAllModals} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }} className={`fixed z-40 bg-white dark:bg-[#181818] flex flex-col shadow-2xl overflow-hidden ${isDesktop ? 'inset-0 m-auto w-full max-w-xl h-[80vh] rounded-[2.5rem]' : 'bottom-0 left-0 right-0 h-[88vh] rounded-t-[3rem] pb-10'}`}>
              <div className="w-full flex items-center justify-between px-8 py-6 shrink-0 touch-none">
                <h3 className="text-xl font-black">Плейлист</h3>
                {!isDesktop && <div className="w-12 h-1.5 bg-gray-200 dark:bg-[#333] rounded-full" />}
                {isDesktop && <RippleButton onClick={closeAllModals} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Icons.Reset /></RippleButton>}
              </div>
              <div className="px-6 pb-4 flex gap-2">
                <button onClick={() => setPlaylistFilter('all')} className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${playlistFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-[#252525] text-gray-500'}`}>Все</button>
                <button onClick={() => setPlaylistFilter('favorites')} className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${playlistFilter === 'favorites' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-[#252525] text-gray-500'}`}>Избранные</button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 flex flex-col pb-8">
                {stationsInPlaylist.length > 0 ? (
                  <Reorder.Group axis="y" values={stationsInPlaylist} onReorder={setStations} className="space-y-1">
                    {stationsInPlaylist.map(s => (
                        <Reorder.Item key={s.id} value={s} className={`flex items-center gap-3 p-2 mb-2 rounded-[1rem] transition-all border-2 ${activeStationId === s.id ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20' : 'bg-white dark:bg-[#1c1c1c] border-transparent'}`} onClick={() => handleSelectStation(s)}>
                          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0"><StationCover station={s} className="w-full h-full" /></div>
                          <div className="flex-1 min-w-0"><p className={`font-bold text-sm truncate ${activeStationId === s.id ? 'text-blue-600' : ''}`}>{s.name}</p></div>
                          <div className="flex gap-1 ml-auto shrink-0">
                            <RippleButton onClick={(e) => toggleFavorite(s.id, e)} className={`p-2 rounded-lg ${favorites.includes(s.id) ? 'text-amber-500' : 'text-gray-300'}`}>{favorites.includes(s.id) ? <Icons.Star /> : <Icons.StarOutline />}</RippleButton>
                            <RippleButton onClick={(e) => { e.stopPropagation(); setEditingStation(s); setShowEditor(true); setShowPlaylist(false); }} className="p-2 text-gray-400"><Icons.Settings /></RippleButton>
                          </div>
                        </Reorder.Item>
                    ))}
                  </Reorder.Group>
                ) : ( <div className="flex-1 flex flex-col items-center justify-center text-center py-12 opacity-30"><Icons.List /><h3 className="text-lg font-black mt-4">Пусто</h3></div> )}
                <div className="mt-8 flex flex-col gap-4">
                  <RippleButton onClick={() => { setEditingStation(null); setShowEditor(true); setShowPlaylist(false); }} className="w-full p-6 rounded-3xl border-2 border-dashed border-gray-200 dark:border-[#333] text-gray-400 font-black flex items-center justify-center gap-3"><Icons.Add /> Добавить станцию</RippleButton>
                  <div className="grid grid-cols-3 gap-3">
                    <RippleButton onClick={handleImport} className="p-4 bg-gray-50 dark:bg-[#252525] rounded-2xl text-[10px] font-black text-gray-400 flex flex-col items-center gap-1"><Icons.Import /> Импорт</RippleButton>
                    <RippleButton onClick={handleDemo} className="p-4 bg-gray-50 dark:bg-[#252525] rounded-2xl text-[10px] font-black text-gray-400 flex flex-col items-center gap-1"><Icons.Reset /> Демо</RippleButton>
                    <RippleButton onClick={handleReset} className="p-4 bg-gray-50 dark:bg-[#252525] rounded-2xl text-[10px] font-black text-red-400/50 flex flex-col items-center gap-1"><Icons.Reset /> Сброс</RippleButton>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {(showAboutModal || showEditor || showSleepTimerModal || showConfirmModal) && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 overflow-hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeAllModals} />
            <div className="relative w-full max-w-sm max-h-full overflow-y-auto no-scrollbar flex items-center justify-center pointer-events-none">
              <div className="w-full pointer-events-auto">
                {showAboutModal && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-[#1f1f1f] rounded-[2.5rem] p-10 shadow-2xl flex flex-col items-center">
                    <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center shadow-lg mb-6"><Logo className="w-12 h-12" /></div>
                    <h3 className="text-2xl font-black mb-1 dark:text-white">Radio Player</h3>
                    <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.4em] mb-8 dark:text-white/30">Build 2.0.3</p>
                    <div className="text-sm font-bold text-gray-500 dark:text-gray-400 text-center mb-10 leading-relaxed">Кроссплатформенный плеер с защитой данных и таймером сна.</div>
                    <RippleButton onClick={closeAllModals} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/20">Закрыть</RippleButton>
                  </motion.div>
                )}
                {showEditor && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-[#1f1f1f] rounded-[2.5rem] p-10 shadow-2xl">
                    <h3 className="text-2xl font-black mb-8 dark:text-white">{editingStation ? 'Редактирование' : 'Новая станция'}</h3>
                    <form onSubmit={addOrUpdateStation} className="flex flex-col gap-5">
                      <input name="name" required value={editorName} onChange={(e) => setEditorName(e.target.value)} placeholder="Название" className="w-full bg-gray-100 dark:bg-[#252525] rounded-xl px-5 py-4 outline-none font-bold text-sm dark:text-white" />
                      <input name="url" type="url" required defaultValue={editingStation?.streamUrl || ''} placeholder="URL Потока" className="w-full bg-gray-100 dark:bg-[#252525] rounded-xl px-5 py-4 outline-none font-bold text-sm dark:text-white" />
                      <input name="coverUrl" type="url" value={editorPreviewUrl} onChange={(e) => setEditorPreviewUrl(e.target.value)} placeholder="Обложка (URL)" className="w-full bg-gray-100 dark:bg-[#252525] rounded-xl px-5 py-4 outline-none font-bold text-sm dark:text-white" />
                      <input name="tags" value={editorTags} onChange={(e) => setEditorTags(e.target.value)} placeholder="Теги (через запятую)" className="w-full bg-gray-100 dark:bg-[#252525] rounded-xl px-5 py-4 outline-none font-bold text-sm dark:text-white" />
                      <div className="flex gap-4 mt-4">
                        <RippleButton type="button" onClick={closeAllModals} className="flex-1 py-4 bg-gray-100 dark:bg-[#252525] text-gray-500 rounded-2xl font-black">Отмена</RippleButton>
                        <RippleButton type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black">Готово</RippleButton>
                      </div>
                    </form>
                  </motion.div>
                )}
                {showSleepTimerModal && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-[#1f1f1f] rounded-[2.5rem] p-10 shadow-2xl text-center">
                    <h3 className="text-2xl font-black mb-8 dark:text-white">Таймер сна</h3>
                    {timeRemaining && <div className="text-3xl font-black mb-6 text-blue-600">{timeRemaining}</div>}
                    <div className="grid grid-cols-2 gap-3 mb-8">
                      {[15, 30, 45, 60].map(m => (
                        <RippleButton key={m} onClick={() => handleSetSleepTimer(m)} className="py-4 bg-gray-100 dark:bg-[#252525] dark:text-white rounded-2xl font-black hover:bg-blue-600 hover:text-white transition-all">{m} мин</RippleButton>
                      ))}
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); handleSetSleepTimer(parseInt(customTimerInput)); }} className="flex gap-3">
                      <input type="number" value={customTimerInput} onChange={(e) => setCustomTimerInput(e.target.value)} placeholder="Свое..." className="flex-1 h-14 bg-gray-100 dark:bg-[#252525] dark:text-white rounded-2xl px-4 outline-none font-bold text-center" />
                      <RippleButton type="submit" className="w-20 h-14 bg-blue-600 text-white rounded-2xl font-black">OK</RippleButton>
                    </form>
                    {sleepTimerEndDate && <RippleButton onClick={() => handleSetSleepTimer(0)} className="w-full mt-6 py-3 text-red-500 font-bold">Выключить</RippleButton>}
                  </motion.div>
                )}
                {showConfirmModal && confirmData && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-[#1f1f1f] rounded-[2.5rem] p-10 shadow-2xl">
                    <h3 className="text-xl font-black mb-4 dark:text-white">Подтвердите</h3>
                    <p className="font-bold text-gray-500 dark:text-gray-400 mb-10">{confirmData.message}</p>
                    <div className="flex gap-4">
                      <RippleButton onClick={closeAllModals} className="flex-1 py-4 bg-gray-100 dark:bg-[#252525] text-gray-500 rounded-2xl font-black">Отмена</RippleButton>
                      <RippleButton onClick={() => { confirmData.onConfirm(); closeAllModals(); }} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black shadow-lg shadow-red-500/20">Удалить</RippleButton>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {snackbar && (
          <motion.div initial={{ opacity: 0, y: 50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 50, x: '-50%' }} className="fixed bottom-10 left-1/2 z-[70] w-[calc(100%-3rem)] max-w-sm px-8 py-5 rounded-[2rem] font-black bg-gray-900 text-white flex items-center justify-between shadow-2xl">
            <span className="truncate pr-4 text-sm uppercase">{snackbar}</span>
            <button onClick={() => setSnackbar(null)} className="text-blue-400 font-black uppercase text-xs">OK</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
