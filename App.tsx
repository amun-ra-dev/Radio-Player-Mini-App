
// Build: 2.5.5
// - Feature: Immediate restoration of the last active station using initialSlide.
// - Fix: Prevented activeStationId reset during app initialization.
// - UX: Seamless transition between sessions with reliable state persistence.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCreative, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperClass } from 'swiper';

import { Station, PlayerStatus, ExportSchemaV2 } from './types.ts';
import { DEFAULT_STATIONS, Icons } from './constants.tsx';
import { useTelegram } from './hooks/useTelegram.ts';
import { useAudio } from './hooks/useAudio.ts';
import { useGyroscope } from './hooks/useGyroscope.ts';
import { RippleButton } from './components/UI/RippleButton.tsx';
import { Logo } from './components/UI/Logo.tsx';

const ReorderGroup = Reorder.Group as any;
const ReorderItem = Reorder.Item as any;

const APP_VERSION = "2.5.5";

const MiniEqualizer: React.FC = () => (
  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
    <div className="flex gap-1 items-end h-3.5 mb-1">
      <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} className="w-1 bg-white rounded-full" />
      <motion.div animate={{ height: [12, 6, 12] }} transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut", delay: 0.1 }} className="w-1 bg-white rounded-full" />
      <motion.div animate={{ height: [6, 10, 6] }} transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut", delay: 2 }} className="w-1 bg-white rounded-full" />
    </div>
  </div>
);

const StationCover: React.FC<{ station: Station | null | undefined; className?: string; showTags?: boolean; parallax?: { x: number, y: number } }> = ({ station, className = "", showTags = true, parallax = { x: 0, y: 0 } }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    if (!station?.coverUrl) return;
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [station?.id, station?.coverUrl]);

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

  return (
    <div className={`${className} relative bg-gray-200 dark:bg-[#1a1a1a] overflow-hidden`}>
      {renderTags()}
      <motion.img
        ref={imgRef}
        key={`${station.id}-${station.coverUrl}`}
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: isLoaded ? 1 : 0,
          x: parallax.x * 8,
          y: parallax.y * 8,
          scale: 1.1 
        }}
        transition={{ opacity: { duration: 0.3 }, x: { type: 'spring', stiffness: 50, damping: 20 }, y: { type: 'spring', stiffness: 50, damping: 20 } }}
        src={station.coverUrl}
        alt={station.name}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover select-none pointer-events-none"
      />
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
        <p className="font-bold text-base truncate leading-tight dark:text-white/90" style={{ color: isActive ? accentColor : undefined }}>{station.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {station.tags && station.tags.length > 0 && (
            <div className="flex gap-1">
              {station.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 rounded-md">{tag}</span>
              ))}
            </div>
          )}
          <p className="text-[9px] opacity-20 dark:opacity-40 truncate uppercase tracking-wider font-bold dark:text-white">{station.streamUrl}</p>
        </div>
      </div>
      <div className="flex gap-0.5 ml-auto pr-1">
        <RippleButton onClick={onToggleFavorite} className={`p-2.5 rounded-xl ${isFavorite ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}`}>
          {isFavorite ? <Icons.Star /> : <Icons.StarOutline />}
        </RippleButton>
        <RippleButton onClick={onEdit} className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 transition-colors" onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)} onMouseLeave={(e) => (e.currentTarget.style.color = '')}><Icons.Settings /></RippleButton>
        <RippleButton onClick={onDelete} className="p-2.5 rounded-xl transition-all" style={{ color: 'var(--tg-theme-subtitle-text-color, #999)' }} onMouseEnter={(e) => (e.currentTarget.style.color = destructiveColor)} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--tg-theme-subtitle-text-color, #999)')}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
        </RippleButton>
      </div>
    </ReorderItem>
  );
};

export const App: React.FC = () => {
  const { hapticImpact, hapticNotification, setBackButton, isMobile, themeParams } = useTelegram();
  const orientation = useGyroscope(isMobile);

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
  const [lastPlayedFavoriteId, setLastPlayedFavoriteId] = useState<string>(() => localStorage.getItem('radio_last_fav') || '');

  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlistFilter, setPlaylistFilter] = useState<'all' | 'favorites'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [showManualImport, setShowManualImport] = useState(false);
  const [manualImportValue, setManualImportValue] = useState('');
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [sleepTimerEndDate, setSleepTimerEndDate] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [customTimerInput, setCustomTimerInput] = useState('');

  const [swiperInstance, setSwiperInstance] = useState<SwiperClass | null>(null);
  const isReorderingRef = useRef(false);

  const [editorPreviewUrl, setEditorPreviewUrl] = useState('');
  const [editorName, setEditorName] = useState('');
  const [editorTags, setEditorTags] = useState('');

  const sleepTimerTimeoutRef = useRef<number | null>(null);
  const originalVolumeRef = useRef<number>(0.5);
  const lastNonZeroVolumeRef = useRef<number>(0.5);
  const isFadingOutRef = useRef<boolean>(false);
  const dragControls = useDragControls();
  const listRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientY;
    const distance = touchEnd - touchStartRef.current;
    if (distance > 70 && listRef.current && listRef.current.scrollTop <= 0) setShowPlaylist(false);
  };

  useEffect(() => { localStorage.setItem('radio_stations', JSON.stringify(stations)); }, [stations]);
  useEffect(() => { localStorage.setItem('radio_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('radio_only_favorites', String(onlyFavoritesMode)); }, [onlyFavoritesMode]);
  useEffect(() => { localStorage.setItem('radio_last_active', activeStationId); }, [activeStationId]);
  useEffect(() => { localStorage.setItem('radio_last_playing', playingStationId); }, [playingStationId]);
  useEffect(() => { localStorage.setItem('radio_last_fav', lastPlayedFavoriteId); }, [lastPlayedFavoriteId]);
  useEffect(() => { if (!snackbar) return; const timer = setTimeout(() => setSnackbar(null), 3500); return () => clearTimeout(timer); }, [snackbar]);

  const hasStations = stations.length > 0;
  const hasFavorites = favorites.length > 0;

  useEffect(() => { if (!hasFavorites && onlyFavoritesMode) setOnlyFavoritesMode(false); }, [hasFavorites, onlyFavoritesMode]);

  const displayedStations = useMemo(() => {
    if (!stations.length) return [];
    if (!onlyFavoritesMode) return stations;
    const filtered = stations.filter(s => favorites.includes(s.id));
    return filtered.length > 0 ? filtered : [];
  }, [stations, favorites, onlyFavoritesMode]);

  const stationsInPlaylist = useMemo(() => {
    if (playlistFilter === 'favorites') return stations.filter(s => favorites.includes(s.id));
    return stations;
  }, [playlistFilter, stations, favorites]);

  const activeStation = useMemo<Station | null>(() => {
    if (!displayedStations.length) return null;
    return displayedStations.find(s => s.id === activeStationId) || displayedStations[0] || null;
  }, [displayedStations, activeStationId]);

  const playingStation = useMemo<Station | null>(() => {
    if (!stations.length) return null;
    return stations.find(s => s.id === playingStationId) || null;
  }, [stations, playingStationId]);

  const { status, volume, setVolume, play, stop } = useAudio(playingStation?.streamUrl || null);

  const handleTogglePlay = useCallback(() => {
    if (!activeStation) return;
    
    if (playingStationId === activeStationId) {
      if (status === 'playing' || status === 'loading') {
        hapticImpact('soft');
        stop();
      } else {
        hapticImpact('medium');
        play(activeStation.streamUrl);
      }
    } else {
      setPlayingStationId(activeStationId);
      if (favorites.includes(activeStationId)) setLastPlayedFavoriteId(activeStationId);
      hapticImpact('medium');
      play(activeStation.streamUrl);
    }
  }, [activeStationId, playingStationId, status, activeStation, hapticImpact, play, stop, favorites]);

  useEffect(() => {
    if (!stations.length) return; // Wait for stations to load from localStorage
    if (!displayedStations.length) { if (activeStationId) setActiveStationId(''); return; }
    if (!activeStationId || !displayedStations.some(s => s.id === activeStationId)) { 
        setActiveStationId(displayedStations[0].id); 
    }
  }, [displayedStations, activeStationId, stations.length]);

  useEffect(() => {
    if (swiperInstance && activeStationId && displayedStations.length > 0) {
      const idx = displayedStations.findIndex(s => s.id === activeStationId);
      if (idx !== -1 && idx !== swiperInstance.realIndex) {
        swiperInstance.slideToLoop(idx, 0);
      }
    }
  }, [activeStationId, swiperInstance, displayedStations]);

  const handleSetSleepTimer = useCallback((minutes: number) => {
    if (sleepTimerTimeoutRef.current) { clearTimeout(sleepTimerTimeoutRef.current); sleepTimerTimeoutRef.current = null; }
    if (isFadingOutRef.current && minutes <= 0) setVolume(originalVolumeRef.current);
    isFadingOutRef.current = false;
    if (minutes > 0) {
      const endDate = Date.now() + minutes * 60 * 1000;
      setSleepTimerEndDate(endDate);
      sleepTimerTimeoutRef.current = window.setTimeout(() => {
        stop(); setSleepTimerEndDate(null); setVolume(originalVolumeRef.current || volume);
        setSnackbar('Таймер сна завершен'); hapticNotification('success');
      }, minutes * 60 * 1000);
      setSnackbar(`Таймер установлен на ${minutes} минут`); hapticImpact('light');
    } else { setSleepTimerEndDate(null); setSnackbar('Таймер сна отключен'); }
    setShowSleepTimerModal(false);
  }, [stop, hapticNotification, hapticImpact, setVolume, volume]);

  useEffect(() => {
    if (!sleepTimerEndDate) { setTimeRemaining(null); return; }
    const interval = setInterval(() => {
      const remaining = sleepTimerEndDate - Date.now();
      if (remaining <= 0) { setTimeRemaining(null); clearInterval(interval); }
      else {
        const min = Math.floor((remaining / 1000) / 60);
        const sec = Math.floor((remaining / 1000) % 60);
        setTimeRemaining(`${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`);
        if (remaining <= 30000) {
          if (!isFadingOutRef.current) { isFadingOutRef.current = true; originalVolumeRef.current = volume; }
          setVolume(Math.max(0, originalVolumeRef.current * (remaining / 30000)));
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [sleepTimerEndDate, volume, setVolume]);

  const handleCustomTimerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = parseInt(customTimerInput, 10);
    if (minutes > 0 && minutes <= 999) { handleSetSleepTimer(minutes); setCustomTimerInput(''); }
    else { setSnackbar('Введите корректное время (1-999 мин)'); hapticNotification('error'); }
  };

  const handleReorder = (reorderedItems: Station[]) => {
    isReorderingRef.current = true;
    const reorderedIds = new Set(reorderedItems.map(item => item.id));
    const newStations = [...reorderedItems, ...stations.filter(item => !reorderedIds.has(item.id))];
    setStations(newStations);
    
    if (playingStationId) {
        const displayed = !onlyFavoritesMode ? newStations : newStations.filter(s => favorites.includes(s.id));
        const isPlayingVisible = displayed.some(s => s.id === playingStationId);
        if (isPlayingVisible) {
            setActiveStationId(playingStationId);
        } else if (swiperInstance) {
            const stationAtIdx = displayed[swiperInstance.realIndex];
            if (stationAtIdx) setActiveStationId(stationAtIdx.id);
        }
    } else if (swiperInstance) {
        const displayed = !onlyFavoritesMode ? newStations : newStations.filter(s => favorites.includes(s.id));
        const stationAtIdx = displayed[swiperInstance.realIndex];
        if (stationAtIdx) setActiveStationId(stationAtIdx.id);
    }
    hapticImpact('light');
    setTimeout(() => { isReorderingRef.current = false; }, 150);
  };

  const toggleFavorite = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); 
    hapticImpact('light');
    
    setFavorites(prev => {
      const isFavNow = prev.includes(id);
      const nextFavs = isFavNow ? prev.filter(fid => fid !== id) : [...prev, id];
      
      if (onlyFavoritesMode && isFavNow && id === activeStationId) {
        const favStations = stations.filter(s => nextFavs.includes(s.id));
        if (favStations.length > 0) {
          const currentIndex = stations.findIndex(s => s.id === id);
          const nextFav = favStations.find(s => stations.findIndex(st => st.id === s.id) > currentIndex) || favStations[0];
          
          setTimeout(() => {
            setActiveStationId(nextFav.id);
            if (status === 'playing' || status === 'loading') {
              setPlayingStationId(nextFav.id);
              setLastPlayedFavoriteId(nextFav.id);
              play(nextFav.streamUrl);
            }
          }, 0);
        } else {
          setTimeout(() => {
            setOnlyFavoritesMode(false);
            setSnackbar('Режим избранного отключен: список пуст');
          }, 0);
        }
      } else if (!isFavNow) {
        setLastPlayedFavoriteId(id);
      }
      
      return nextFavs;
    });
  }, [hapticImpact, onlyFavoritesMode, activeStationId, stations, status, play]);

  const toggleOnlyFavoritesMode = useCallback(() => {
    if (!hasStations) return;
    if (!hasFavorites && !onlyFavoritesMode) { 
      setSnackbar('Добавьте хотя бы одну станцию в избранное'); 
      hapticNotification('warning'); 
      return; 
    }
    
    const nextMode = !onlyFavoritesMode;
    const prevActiveId = activeStationId;
    let targetStationId = prevActiveId;
    
    isReorderingRef.current = true;
    
    setOnlyFavoritesMode(nextMode); 
    hapticImpact('medium');
    setSnackbar(nextMode ? 'Режим избранного: ВКЛ' : 'Режим избранного: ВЫКЛ');

    if (nextMode) {
      const currentIsFav = favorites.includes(prevActiveId);
      if (!currentIsFav) {
        const favList = stations.filter(s => favorites.includes(s.id));
        if (favList.length > 0) {
          const fallbackId = favorites.includes(lastPlayedFavoriteId) 
            ? lastPlayedFavoriteId 
            : favList[0].id;
          
          const fallbackStation = favList.find(s => s.id === fallbackId) || favList[0];
          targetStationId = fallbackStation.id;
          
          setActiveStationId(targetStationId);
          if (status === 'playing' || status === 'loading') {
            setPlayingStationId(targetStationId);
            setLastPlayedFavoriteId(targetStationId);
            play(fallbackStation.streamUrl);
          }
        }
      }
    }
    
    setTimeout(() => {
      if (swiperInstance) {
        const newList = nextMode ? stations.filter(s => favorites.includes(s.id)) : stations;
        const newIdx = newList.findIndex(s => s.id === targetStationId);
        if (newIdx !== -1) {
          swiperInstance.slideToLoop(newIdx, 0);
        }
      }
      setTimeout(() => { isReorderingRef.current = false; }, 300);
    }, 0);

  }, [onlyFavoritesMode, hapticImpact, hapticNotification, hasStations, hasFavorites, stations, favorites, activeStationId, lastPlayedFavoriteId, status, play, swiperInstance]);

  const navigateStation = useCallback((navDir: 'next' | 'prev') => {
    if (!swiperInstance) return;
    hapticImpact('medium');
    if (navDir === 'next') swiperInstance.slideNext();
    else swiperInstance.slidePrev();
  }, [swiperInstance, hapticImpact]);

  const handleSelectStation = useCallback((station: Station) => {
    if (!station) return;
    if (activeStationId === station.id) {
        handleTogglePlay();
    } else {
        setActiveStationId(station.id);
        setPlayingStationId(station.id);
        if (favorites.includes(station.id)) setLastPlayedFavoriteId(station.id);
        hapticImpact('light');
        play(station.streamUrl);
    }
  }, [activeStationId, handleTogglePlay, hapticImpact, play, favorites]);

  const closeAllModals = useCallback(() => {
    setShowEditor(false); setShowPlaylist(false); setShowConfirmModal(false);
    setShowSleepTimerModal(false); setShowAboutModal(false); setShowManualImport(false);
    setEditingStation(null);
  }, []);

  const toggleMute = useCallback(() => {
    if (volume > 0) {
      lastNonZeroVolumeRef.current = volume;
      setVolume(0);
      setSnackbar('Звук выключен');
      hapticImpact('soft');
    } else {
      setVolume(lastNonZeroVolumeRef.current || 0.5);
      setSnackbar('Звук включен');
      hapticImpact('rigid');
    }
  }, [volume, setVolume, hapticImpact]);

  useEffect(() => {
    const isModalOpen = showEditor || showPlaylist || showConfirmModal || showSleepTimerModal || showAboutModal || showManualImport;
    setBackButton(isModalOpen, closeAllModals);
  }, [showEditor, showPlaylist, showConfirmModal, showSleepTimerModal, showAboutModal, showManualImport, setBackButton, closeAllModals]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space': e.preventDefault(); handleTogglePlay(); break;
        case 'KeyM': e.preventDefault(); toggleMute(); break;
        case 'ArrowLeft': navigateStation('prev'); break;
        case 'ArrowRight': navigateStation('next'); break;
        case 'ArrowUp': e.preventDefault(); setVolume(prev => Math.min(1, prev + 0.05)); break;
        case 'ArrowDown': e.preventDefault(); setVolume(prev => Math.max(0, prev - 0.05)); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, navigateStation, setVolume, toggleMute]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmData({
      message: 'Удалить эту станцию?',
      onConfirm: () => {
        const filtered = stations.filter(s => s.id !== id);
        setStations(filtered); setFavorites(prev => prev.filter(fid => fid !== id));
        if (playingStationId === id) { setPlayingStationId(''); stop(); }
        if (activeStationId === id) { if (filtered.length > 0) setActiveStationId(filtered[0].id); else { setActiveStationId(''); } }
        hapticImpact('heavy'); setSnackbar('Станция удалена');
      }
    });
    setShowConfirmModal(true);
  };

  const handleExport = () => {
    const exportData: ExportSchemaV2 = {
      schemaVersion: 2,
      appVersion: APP_VERSION,
      exportedAt: Date.now(),
      stations: stations.map(s => ({
        id: s.id,
        title: s.name,
        streamUrl: s.streamUrl,
        coverUrl: s.coverUrl,
        isFavorite: favorites.includes(s.id),
        tags: s.tags
      }))
    };
    
    const stationNames = stations.map(s => `- ${s.name}`).join('\n');
    const jsonText = JSON.stringify(exportData, null, 2);
    const clipboardText = `**🤖 @mdsradibot Station List:**\n\n${stationNames}\n\n\`\`\`json\n${jsonText}\n\`\`\``;

    navigator.clipboard.writeText(clipboardText)
      .then(() => { 
        hapticNotification('success'); 
        setSnackbar(`Экспорт скопирован! (${stations.length} станций)`); 
      })
      .catch(() => { 
        hapticNotification('error'); 
        setSnackbar('Ошибка экспорта'); 
      });
  };

  const processImportText = (input: string, isManual = false) => {
    try {
      let workingText = input.trim();
      
      try {
        const firstPass = JSON.parse(workingText);
        if (firstPass && typeof firstPass.message === 'string') {
          workingText = firstPass.message.trim();
        }
      } catch (e) { /* skip */ }

      const mdRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
      const mdMatch = workingText.match(mdRegex);
      
      let jsonToParse = workingText;

      if (mdMatch && mdMatch[1]) {
        jsonToParse = mdMatch[1].trim();
      } else {
        const startObj = workingText.indexOf('{');
        const startArr = workingText.indexOf('[');
        const endObj = workingText.lastIndexOf('}');
        const endArr = workingText.lastIndexOf(']');

        const hasBraces = startObj !== -1 && endObj !== -1;
        const hasBrackets = startArr !== -1 && endArr !== -1;

        if (hasBraces && (!hasBrackets || startObj < startArr)) {
          jsonToParse = workingText.substring(startObj, endObj + 1);
        } else if (hasBrackets) {
          jsonToParse = workingText.substring(startArr, endArr + 1);
        }
      }

      const parsed = JSON.parse(jsonToParse);
      let importedStations: any[] = [];

      if (parsed.schemaVersion === 2 && Array.isArray(parsed.stations)) {
        importedStations = parsed.stations;
      } else if (Array.isArray(parsed)) {
        importedStations = parsed;
      } else if (typeof parsed === 'object') {
        if (Array.isArray(parsed.stations)) importedStations = parsed.stations;
        else importedStations = [parsed];
      }

      const urlPattern = /^https?:\/\/.+/i;
      const valid = importedStations.filter(s => {
        const url = (s.streamUrl || s.url || '').toString().trim();
        const title = (s.title || s.name || '').toString().trim();
        return title.length > 0 && url.length > 0 && urlPattern.test(url);
      });

      if (valid.length === 0) {
        if (!isManual) {
          setShowManualImport(true);
          setSnackbar('JSON найден, но валидных станций нет');
        } else {
          setSnackbar('Нет валидных URL в данных');
        }
        hapticNotification('error');
        return;
      }

      let addedCount = 0;
      let updatedCount = 0;

      const nextStationsList = [...stations];
      const nextFavoritesList = [...favorites];

      valid.forEach(imp => {
        const impUrl = (imp.streamUrl || imp.url).toString().trim();
        const impTitle = (imp.title || imp.name).toString().trim();
        const impCover = (imp.coverUrl || imp.cover || '').toString().trim();
        const impTags = Array.isArray(imp.tags) ? imp.tags.map((t: any) => t.toString().trim()) : [];
        const impFav = imp.isFavorite === true;

        const normalizedImpUrl = impUrl.toLowerCase();
        const existingIdx = nextStationsList.findIndex(s => s.streamUrl.toLowerCase().trim() === normalizedImpUrl);

        if (existingIdx !== -1) {
          nextStationsList[existingIdx] = {
            ...nextStationsList[existingIdx],
            name: impTitle,
            coverUrl: impCover || nextStationsList[existingIdx].coverUrl,
            tags: impTags.length > 0 ? impTags : nextStationsList[existingIdx].tags
          };
          if (impFav && !nextFavoritesList.includes(nextStationsList[existingIdx].id)) {
            nextFavoritesList.push(nextStationsList[existingIdx].id);
          }
          updatedCount++;
        } else {
          const newId = imp.id || Math.random().toString(36).substr(2, 9);
          nextStationsList.push({
            id: newId,
            name: impTitle,
            streamUrl: impUrl,
            coverUrl: impCover || `https://picsum.photos/400/400?random=${Math.random()}`,
            tags: impTags,
            addedAt: Date.now()
          });
          if (impFav) nextFavoritesList.push(newId);
          addedCount++;
        }
      });

      setStations(nextStationsList);
      setFavorites(nextFavoritesList);

      hapticNotification('success');
      setSnackbar(`Итог: +${addedCount} добавлено, ~${updatedCount} обновлено`);
      setShowPlaylist(false);
      setShowManualImport(false);
      setManualImportValue('');

    } catch (e) {
      if (!isManual) {
        setShowManualImport(true);
        setSnackbar('JSON не найден. Вставьте данные вручную.');
      } else {
        setSnackbar('Ошибка парсинга. Проверьте структуру JSON.');
      }
      hapticNotification('error');
    }
  };

  const handleImport = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setShowManualImport(true);
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text && (text.includes('{') || text.includes('['))) {
        processImportText(text);
      } else {
        setShowManualImport(true);
        setSnackbar('Буфер пуст. Вставьте JSON вручную.');
        hapticNotification('warning');
      }
    } catch (e) {
      setShowManualImport(true);
    }
  };

  const handleReset = () => {
    setConfirmData({ 
      message: 'Очистить весь плейлист?', 
      onConfirm: () => { 
        setStations([]); 
        setFavorites([]); 
        setOnlyFavoritesMode(false); 
        setActiveStationId(''); 
        setPlayingStationId(''); 
        stop(); 
        hapticImpact('heavy'); 
        setSnackbar('Плейлист очищен'); 
      } 
    });
    setShowConfirmModal(true);
  };

  const handleDemo = () => {
    setConfirmData({
      message: 'Добавить стандартный список станций?',
      onConfirm: () => {
        setStations(prev => {
          const existingUrls = new Set(prev.map(s => s.streamUrl.toLowerCase().trim()));
          const unique = DEFAULT_STATIONS.filter(s => !existingUrls.has(s.streamUrl.toLowerCase().trim()));
          if (!activeStationId && unique.length > 0) setActiveStationId(unique[0].id);
          return [...prev, ...unique];
        });
        setSnackbar(`Добавлено новых станций: ${DEFAULT_STATIONS.length}`); 
        hapticNotification('success');
      }
    });
    setShowConfirmModal(true);
  };

  const addOrUpdateStation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string).trim();
    const url = (formData.get('url') as string).trim();
    const coverUrl = (formData.get('coverUrl') as string).trim();
    const tagsStr = (formData.get('tags') as string).trim();
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    
    if (!name || !url) return;
    
    if (editingStation) { 
        setStations(prev => prev.map(s => s.id === editingStation.id ? { ...s, name, streamUrl: url, coverUrl: coverUrl || s.coverUrl, tags } : s)); 
        setEditingStation(null); setSnackbar('Обновлено'); 
    }
    else {
      const id = Math.random().toString(36).substr(2, 9);
      const s: Station = { id, name, streamUrl: url, coverUrl: coverUrl || `https://picsum.photos/400/400?random=${Math.random()}`, tags, addedAt: Date.now() };
      setStations(prev => [...prev, s]); if (!activeStationId) setActiveStationId(id); setSnackbar('Добавлено');
    }
    setShowEditor(false); hapticImpact('light');
  };

  useEffect(() => { 
    if (showEditor) { 
      setEditorPreviewUrl(editingStation?.coverUrl || ''); 
      setEditorName(editingStation?.name || ''); 
      setEditorTags(editingStation?.tags?.join(', ') || ''); 
    } 
  }, [showEditor, editingStation]);

  const canPlay = Boolean(activeStation?.streamUrl);

  const nativeAccentColor = themeParams?.button_color || '#2563eb';
  const nativeDestructiveColor = themeParams?.destructive_text_color || '#ef4444';
  const nativeBgColor = themeParams?.bg_color || '#ffffff';
  const nativeTextColor = themeParams?.text_color || '#222222';

  const initialSlideIndex = useMemo(() => {
    if (!displayedStations.length || !activeStationId) return 0;
    const idx = displayedStations.findIndex(s => s.id === activeStationId);
    return idx === -1 ? 0 : idx;
  }, [displayedStations, activeStationId]);

  return (
    <div className="flex flex-col overflow-hidden transition-colors duration-500" style={{ height: 'var(--tg-viewport-height, 100vh)', color: nativeTextColor, backgroundColor: nativeBgColor }}>
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20 dark:opacity-40 bg-[radial-gradient(circle_at_center,_#3b82f6_0%,_transparent_70%)] dark:bg-[radial-gradient(circle_at_center,_#1d4ed8_0%,_transparent_80%)]" />
      
      <div className="flex items-center justify-between px-6 bg-white/70 dark:bg-black/30 border-b border-black/5 dark:border-white/10 z-20 shrink-0 backdrop-blur-[70px]" style={{ paddingTop: isMobile ? 'calc(var(--tg-safe-top, 0px) + 46px)' : 'calc(var(--tg-safe-top, 0px) + 16px)', paddingBottom: '12px' }}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowAboutModal(true)}>
          <Logo className="w-8 h-8 transition-colors duration-300" style={{ color: nativeAccentColor }} />
          <h1 className="text-2xl font-black tracking-tighter leading-none transition-colors duration-300">Radio Player</h1>
        </div>
        <div className="flex items-center gap-1">
          <RippleButton onClick={toggleOnlyFavoritesMode} disabled={!hasStations} className={`w-[38px] h-[38px] flex items-center justify-center rounded-full transition-all duration-300 ${!hasStations ? 'opacity-20 pointer-events-none' : onlyFavoritesMode ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-500 scale-110 shadow-lg shadow-amber-500/10' : 'text-gray-400 dark:text-gray-500'}`}><Icons.Star /></RippleButton>
          <motion.button layout disabled={!hasStations} onClick={() => setShowSleepTimerModal(true)} className={`ripple h-[38px] rounded-full relative flex items-center justify-center transition-all ${!hasStations ? 'w-[38px] opacity-20 pointer-events-none' : (sleepTimerEndDate ? 'text-white px-4' : 'w-[38px] text-gray-400 dark:text-gray-500')}`} style={{ backgroundColor: sleepTimerEndDate ? nativeAccentColor : undefined }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {sleepTimerEndDate ? (
                <motion.span key="time" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="font-black text-sm leading-none whitespace-nowrap">{timeRemaining ? `${Math.ceil((sleepTimerEndDate - Date.now()) / 60000)}m` : '...'}</motion.span>
              ) : <motion.div key="icon" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}><Icons.Timer /></motion.div>}
            </AnimatePresence>
          </motion.button>
          <RippleButton onClick={() => setShowPlaylist(true)} className="w-[38px] h-[38px] flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500"><Icons.List /></RippleButton>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-evenly py-6 overflow-hidden relative z-10">
        <div className="relative w-[340px] aspect-square shrink-0 transition-all duration-500">
          {displayedStations.length > 0 ? (
            <Swiper
              key={`swiper-${displayedStations.length}-${onlyFavoritesMode}`}
              initialSlide={initialSlideIndex}
              onSwiper={setSwiperInstance}
              onSlideChange={(swiper) => {
                if (isReorderingRef.current) return;
                
                const targetStation = displayedStations[swiper.realIndex];
                if (targetStation) {
                    const isNewStation = targetStation.id !== activeStationId;
                    
                    if (isNewStation) {
                        setActiveStationId(targetStation.id);
                        if (status === 'playing' || status === 'loading') {
                            if (targetStation.id !== playingStationId) {
                                setPlayingStationId(targetStation.id);
                                if (favorites.includes(targetStation.id)) setLastPlayedFavoriteId(targetStation.id);
                                play(targetStation.streamUrl);
                            }
                        }
                    }
                }
                hapticImpact('light');
              }}
              loop={displayedStations.length > 1}
              effect={'creative'}
              grabCursor={true}
              slidesPerView={1}
              creativeEffect={{
                limitProgress: 3,
                perspective: true,
                prev: { translate: ['-120%', 0, 0], rotate: [0, 0, -20], opacity: 0, shadow: false },
                next: { translate: ['12px', 0, -100], scale: 0.9, opacity: 0.6, shadow: false },
              }}
              modules={[EffectCreative, Keyboard]}
              keyboard={{ enabled: true }}
              className="mySwiper w-full h-full !overflow-visible"
            >
              {displayedStations.map((station) => (
                <SwiperSlide key={station.id} className="w-full h-full flex justify-center">
                  <div className="relative w-full aspect-square rounded-[2.5rem] overflow-hidden bg-white dark:bg-white/[0.05] border-2 transition-all duration-500" style={{ borderColor: activeStationId === station.id ? `${nativeAccentColor}44` : 'transparent', boxShadow: activeStationId === station.id ? `0 20px 60px -10px ${nativeAccentColor}22` : 'none' }} onClick={() => canPlay && handleTogglePlay()}>
                    <StationCover station={station} className="w-full h-full" parallax={activeStationId === station.id ? orientation : { x: 0, y: 0 }} />
                    <div className="absolute bottom-6 right-6 z-30" onClick={(e) => { e.stopPropagation(); toggleFavorite(station.id, e); }}>
                      <RippleButton className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${favorites.includes(station.id) ? 'bg-amber-500 text-white scale-105 shadow-lg shadow-amber-500/30' : 'bg-black/30 text-white/60 hover:bg-black/40'}`}>
                        {favorites.includes(station.id) ? <Icons.Star /> : <Icons.StarOutline />}
                      </RippleButton>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          ) : (
            <div className="w-full h-full">
              <AnimatePresence mode="wait">
                {!hasStations ? (
                  <motion.div key="no-stations" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full aspect-square mx-auto rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-[#3b82f6] to-[#1e40af] flex flex-col items-center justify-center text-center p-8 shadow-2xl">
                    <h2 className="text-white text-3xl font-black mb-2">Нет станций</h2>
                    <p className="text-white/80 text-sm font-bold mb-8">Добавьте первую станцию в плейлист</p>
                    <div className="flex flex-col gap-4 w-full">
                      <RippleButton onClick={() => { setEditingStation(null); setShowEditor(true); }} className="w-full py-4 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-black">Добавить станцию</RippleButton>
                      <div className="grid grid-cols-2 gap-3">
                        <RippleButton onClick={handleImport} className="py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black">Импорт</RippleButton>
                        <RippleButton onClick={handleDemo} className="py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black">Демо</RippleButton>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="no-favorites" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full aspect-square mx-auto rounded-[2.5rem] overflow-hidden bg-white/10 backdrop-blur-3xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-center p-8 shadow-2xl">
                    <div className="text-amber-500 mb-6 scale-150"><Icons.Star /></div>
                    <h2 className="text-2xl font-black mb-2 tracking-tight">Нет избранных</h2>
                    <p className="opacity-60 text-sm font-bold mb-8 px-4">Добавьте хотя бы одну станцию в избранное, чтобы использовать этот режим</p>
                    <RippleButton onClick={toggleOnlyFavoritesMode} className="py-4 px-10 text-white rounded-2xl font-black shadow-xl" style={{ backgroundColor: nativeAccentColor }}>Показать все</RippleButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="w-full max-w-[360px] px-2 z-10 transition-all duration-500">
          <motion.div 
            layout
            className="w-full flex flex-col items-center bg-white/80 dark:bg-white/[0.015] backdrop-blur-[70px] border border-white/50 dark:border-white/10 rounded-[3.5rem] py-8 px-6 shadow-[0_20px_100px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_120px_rgba(0,0,0,0.5)]"
            drag="y" 
            dragConstraints={{ top: 0, bottom: 0 }} 
            onDragEnd={(_, info) => info.offset.y < -50 && setShowPlaylist(true)}
          >
            <div className="w-full flex flex-col items-center gap-6">
              <div className="text-center w-full px-2 min-h-[50px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  <motion.div key={activeStation?.id || 'none'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <h2 className="text-xl font-black truncate leading-tight tracking-tight">{activeStation?.name || 'Пусто'}</h2>
                    </div>
                    <p className="text-[10px] opacity-40 dark:opacity-60 uppercase tracking-[0.3em] font-black">
                        {!activeStation ? (onlyFavoritesMode ? 'Нет избранных' : 'Выберите источник') : 
                         (playingStationId === activeStationId && status === 'playing' ? 'В эфире' : 
                          playingStationId === activeStationId && status === 'loading' ? 'Загрузка...' : 
                          'Пауза')}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="w-full max-w-[240px] flex flex-col">
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))} 
                  className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full appearance-none transition-all cursor-pointer" 
                  style={{ accentColor: nativeAccentColor }}
                  disabled={!canPlay} 
                />
              </div>

              <div className="w-full flex items-center justify-between px-2">
                <RippleButton onClick={() => navigateStation('prev')} className={`p-4 transition-all ${displayedStations.length > 1 ? 'opacity-50 hover:opacity-100 active:scale-90' : 'opacity-10 pointer-events-none'}`}><Icons.Prev /></RippleButton>
                <RippleButton onClick={() => canPlay && handleTogglePlay()} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-xl ${canPlay ? 'text-white' : 'bg-black/5 dark:bg-white/5 opacity-40'}`} style={{ backgroundColor: canPlay ? nativeAccentColor : undefined, boxShadow: canPlay ? `0 15px 40px -5px ${nativeAccentColor}77` : 'none' }} disabled={!canPlay}>
                    {(playingStationId === activeStationId) && (status === 'playing' || status === 'loading') ? <Icons.Pause className="w-8 h-8" /> : <Icons.Play className="w-8 h-8" />}
                </RippleButton>
                <RippleButton onClick={() => navigateStation('next')} className={`p-4 transition-all ${displayedStations.length > 1 ? 'opacity-50 hover:opacity-100 active:scale-90' : 'opacity-10 pointer-events-none'}`}><Icons.Next /></RippleButton>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2 mt-6 text-black/10 dark:text-white/10 cursor-grab w-full active:scale-105 transition-transform">
              <div className="w-12 h-1 rounded-full bg-current mx-auto opacity-50" />
              <span className="text-[9px] uppercase font-black tracking-[0.3em] text-center ml-1">Плейлист</span>
            </div>
          </motion.div>
        </div>
      </main>

      <AnimatePresence>
        {showPlaylist && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/75 z-30 backdrop-blur-xl" onClick={closeAllModals} />
            <motion.div drag="y" dragListener={false} dragControls={dragControls} dragDirectionLock dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 1 }} dragMomentum={false} onDragEnd={(_, info) => (info.offset.y > 100 || info.velocity.y > 500) && setShowPlaylist(false)} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.5 }} className="fixed bottom-0 left-0 right-0 h-[92vh] bg-white/95 dark:bg-black/60 rounded-t-[3.5rem] z-40 flex flex-col overflow-hidden pb-10 border-t border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-[80px]">
              <div className="w-full flex flex-col items-center pt-6 pb-4 shrink-0 touch-none cursor-grab active:cursor-grabbing" onPointerDown={(e) => dragControls.start(e)}><div className="w-20 h-1.5 bg-black/10 dark:bg-white/10 rounded-full mb-3" /></div>
              <div className="px-6 pb-4">
                <div className="flex items-center bg-black/5 dark:bg-white/[0.04] rounded-[1.25rem] p-1.5 backdrop-blur-xl border border-white/5 transition-colors">
                  <button onClick={() => setPlaylistFilter('all')} className={`flex-1 py-3 text-sm font-black rounded-[1rem] transition-all ${playlistFilter === 'all' ? 'bg-white dark:bg-white/10 shadow-sm' : 'opacity-50'}`} style={{ color: playlistFilter === 'all' ? nativeAccentColor : undefined }}>Все станции</button>
                  <button onClick={() => setPlaylistFilter('favorites')} className={`flex-1 py-3 text-sm font-black rounded-[1rem] transition-all ${playlistFilter === 'favorites' ? 'bg-white dark:bg-white/10 shadow-sm' : 'opacity-50'}`} style={{ color: playlistFilter === 'favorites' ? nativeAccentColor : undefined }}>Избранное</button>
                </div>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto px-6 flex flex-col overscroll-contain" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                {stationsInPlaylist.length > 0 ? (
                  <ReorderGroup axis="y" values={stationsInPlaylist} onReorder={handleReorder} className="space-y-2">
                    {stationsInPlaylist.map(s => (
                        <ReorderableStationItem 
                            key={s.id} 
                            station={s} 
                            isActive={activeStationId === s.id} 
                            isPlaying={playingStationId === s.id}
                            isFavorite={favorites.includes(s.id)} 
                            status={status} 
                            accentColor={nativeAccentColor}
                            destructiveColor={nativeDestructiveColor}
                            hapticImpact={hapticImpact} 
                            onSelect={() => handleSelectStation(s)} 
                            onToggleFavorite={(e) => toggleFavorite(s.id, e)} 
                            onEdit={(e) => { e.stopPropagation(); setEditingStation(s); setShowEditor(true); setShowPlaylist(false); }} 
                            onDelete={(e) => handleDelete(s.id, e)} 
                        />
                    ))}
                  </ReorderGroup>
                ) : <div className="flex-1 flex flex-col items-center justify-center text-center p-10"><h3 className="text-xl font-black opacity-30">{playlistFilter === 'favorites' ? 'Нет избранных' : 'Плейлист пуст'}</h3></div>}
                <div className="mt-8 flex flex-col gap-4 mb-safe pb-16">
                  <RippleButton onClick={() => { setEditingStation(null); setShowEditor(true); setShowPlaylist(false); }} className="w-full p-6 rounded-[2rem] border-2 border-dashed border-black/5 dark:border-white/10 opacity-40 hover:opacity-100 font-black flex items-center justify-center gap-3 transition-all hover:bg-black/5 dark:hover:bg-white/5 shadow-sm"><Icons.Add /> Добавить станцию</RippleButton>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <RippleButton onClick={handleImport} className="flex flex-col items-center justify-center p-4 bg-black/5 dark:bg-white/5 rounded-2xl text-[10px] font-black opacity-60 transition-all hover:opacity-100 border border-transparent dark:border-white/5"><Icons.Import /> <span className="mt-1">Импорт</span></RippleButton>
                    <RippleButton onClick={handleExport} className="flex flex-col items-center justify-center p-4 bg-black/5 dark:bg-white/5 rounded-2xl text-[10px] font-black opacity-60 transition-all hover:opacity-100 border border-transparent dark:border-white/5"><Icons.Export /> <span className="mt-1">Экспорт</span></RippleButton>
                    <RippleButton onClick={handleReset} className="flex flex-col items-center justify-center p-4 bg-white/50 dark:bg-white/5 rounded-2xl text-[10px] font-black transition-all border border-transparent shadow-sm" style={{ color: nativeDestructiveColor, borderColor: `${nativeDestructiveColor}33`, boxShadow: `0 4px 15px -5px ${nativeDestructiveColor}44` }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${nativeDestructiveColor}1a`)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}><Icons.Reset style={{ color: nativeDestructiveColor }} /> <span className="mt-1">Сброс</span></RippleButton>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showAboutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-white/95 dark:bg-black/85 rounded-[3.5rem] p-10 flex flex-col border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-[70px]">
              <div className="flex flex-col items-center mb-8">
                <div className="w-20 h-20 text-white rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl" style={{ backgroundColor: nativeAccentColor, boxShadow: `0 20px 60px -10px ${nativeAccentColor}aa` }}><Logo className="w-12 h-12" /></div>
                <h3 className="text-3xl font-black tracking-tighter">Radio Player</h3>
                <p className="text-[11px] font-black opacity-30 dark:opacity-40 uppercase tracking-[0.4em] mt-1">Build {APP_VERSION}</p>
              </div>
              <div className="text-[13px] font-bold opacity-60 text-center mb-8 px-6 leading-relaxed">Премиальный плеер с интеллектуальной дедупликацией при импорте.</div>
              <RippleButton onClick={closeAllModals} className="w-full py-5 text-white rounded-[1.5rem] font-black shadow-2xl transition-transform active:scale-95" style={{ backgroundColor: nativeAccentColor, boxShadow: `0 10px 30px -5px ${nativeAccentColor}66` }}>Закрыть</RippleButton>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showManualImport && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-white/95 dark:bg-black/85 rounded-[3.5rem] p-8 flex flex-col border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-[70px]">
              <h3 className="text-2xl font-black mb-2 text-center tracking-tighter">Ручной импорт</h3>
              <p className="text-xs opacity-50 text-center mb-6 font-bold">Вставьте JSON-код вашего плейлиста в поле ниже</p>
              <textarea value={manualImportValue} onChange={(e) => setManualImportValue(e.target.value)} placeholder='{ "stations": [...] }' className="w-full h-48 bg-black/5 dark:bg-white/5 rounded-[1.5rem] p-4 outline-none font-mono text-[10px] focus:ring-2 focus:ring-current transition-all mb-6 resize-none border dark:border-white/10" style={{ caretColor: nativeAccentColor }} />
              <div className="flex gap-4">
                <RippleButton onClick={closeAllModals} className="flex-1 py-4 bg-black/5 dark:bg-white/5 opacity-60 rounded-2xl font-black text-sm">Отмена</RippleButton>
                <RippleButton onClick={() => processImportText(manualImportValue, true)} disabled={!manualImportValue.trim()} className={`flex-1 py-4 text-white rounded-2xl font-black text-sm shadow-xl transition-all ${!manualImportValue.trim() && 'opacity-50 pointer-events-none'}`} style={{ backgroundColor: nativeAccentColor, boxShadow: `0 10px 30px -5px ${nativeAccentColor}66` }}>Импорт</RippleButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-white/95 dark:bg-black/85 rounded-[3.5rem] p-10 shadow-none my-auto border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-[70px]">
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-3xl font-black tracking-tighter">{editingStation ? 'Настройки' : 'Новая станция'}</h3>
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-black/5 dark:bg-white/5 shrink-0 shadow-xl border dark:border-white/10">
                  <StationCover station={{ name: editorName, coverUrl: editorPreviewUrl, tags: editorTags.split(',').map(t => t.trim()).filter(Boolean) } as any} className="w-full h-full" showTags={false} />
                </div>
              </div>
              <form onSubmit={addOrUpdateStation} className="flex flex-col gap-4">
                <div className="space-y-3">
                  <input name="name" required value={editorName} onChange={(e) => setEditorName(e.target.value)} placeholder="Название радио" className="w-full bg-black/5 dark:bg-white/5 rounded-[1.25rem] px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-current transition-all border dark:border-white/10" style={{ caretColor: nativeAccentColor }} />
                  <input name="url" type="url" required defaultValue={editingStation?.streamUrl || ''} placeholder="URL потока" className="w-full bg-black/5 dark:bg-white/5 rounded-[1.25rem] px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-current transition-all border dark:border-white/10" style={{ caretColor: nativeAccentColor }} />
                  <input name="coverUrl" type="url" value={editorPreviewUrl} onChange={(e) => setEditorPreviewUrl(e.target.value)} placeholder="URL обложки" className="w-full bg-black/5 dark:bg-white/5 rounded-[1.25rem] px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-current transition-all border dark:border-white/10" style={{ caretColor: nativeAccentColor }} />
                  <input name="tags" value={editorTags} onChange={(e) => setEditorTags(e.target.value)} placeholder="Теги (через запятую)" className="w-full bg-black/5 dark:bg-white/5 rounded-[1.25rem] px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-current transition-all border dark:border-white/10" style={{ caretColor: nativeAccentColor }} />
                </div>
                <div className="flex gap-4 mt-6">
                  <RippleButton type="button" onClick={closeAllModals} className="flex-1 py-4 bg-black/5 dark:bg-white/5 opacity-60 rounded-2xl font-black transition-all active:scale-95 shadow-sm">Отмена</RippleButton>
                  <RippleButton type="submit" className="flex-1 py-4 text-white rounded-2xl font-black shadow-xl transition-all active:scale-95" style={{ backgroundColor: nativeAccentColor, boxShadow: `0 10px 30px -5px ${nativeAccentColor}66` }}>Сохранить</RippleButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {snackbar && (
          <motion.div initial={{ opacity: 0, y: 60, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 60, scale: 0.9 }} className="fixed bottom-12 left-8 right-8 z-[100] bg-black/95 dark:bg-white/10 backdrop-blur-[70px] text-white dark:text-white px-8 py-5 rounded-[2.5rem] font-bold flex items-center justify-between shadow-2xl border border-white/10">
            <span className="truncate pr-4 tracking-tight text-sm">{snackbar}</span>
            <button onClick={() => setSnackbar(null)} className="shrink-0 font-black uppercase text-xs tracking-widest ml-4" style={{ color: nativeAccentColor }}>OK</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSleepTimerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-sm bg-white/95 dark:bg-black/85 rounded-[3.5rem] p-10 border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-[70px]">
              <h3 className="text-2xl font-black mb-6 text-center tracking-tighter">Таймер сна</h3>
              {timeRemaining && <div className="text-center font-black text-3xl mb-8 tabular-nums" style={{ color: nativeAccentColor }}>{timeRemaining}</div>}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {[15, 30, 45, 60].map(m => (
                  <RippleButton key={m} onClick={() => handleSetSleepTimer(m)} className="py-4 bg-black/5 dark:bg-white/5 rounded-[1.5rem] font-black text-lg border dark:border-white/5 transition-colors" style={{ color: nativeAccentColor }}>{m}м</RippleButton>
                ))}
              </div>
              <form onSubmit={handleCustomTimerSubmit} className="grid grid-cols-2 gap-3 w-full">
                <input type="number" value={customTimerInput} onChange={(e) => setCustomTimerInput(e.target.value)} placeholder="Свой" className="w-full h-14 bg-black/5 dark:bg-white/5 rounded-[1.5rem] px-4 outline-none font-black text-center focus:ring-2 focus:ring-current transition-all border dark:border-white/10" style={{ caretColor: nativeAccentColor }} />
                <RippleButton type="submit" className="w-full h-14 text-white rounded-[1.5rem] font-black shadow-xl" style={{ backgroundColor: nativeAccentColor, boxShadow: `0 10px 30px -5px ${nativeAccentColor}66` }}>OK</RippleButton>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirmModal && confirmData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-white/95 dark:bg-black/85 rounded-[3.5rem] p-10 border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-[70px]">
              <h3 className="text-2xl font-black mb-4 text-center tracking-tight">Внимание</h3>
              <p className="font-bold opacity-60 mb-10 text-center leading-relaxed">{confirmData.message}</p>
              <div className="flex gap-4">
                <RippleButton onClick={closeAllModals} className="flex-1 py-4 bg-black/5 dark:bg-white/5 opacity-60 rounded-2xl font-black transition-all active:scale-95 shadow-sm">Нет</RippleButton>
                <RippleButton onClick={() => { confirmData.onConfirm(); closeAllModals(); }} className="flex-1 py-4 text-white rounded-2xl font-black shadow-xl transition-all active:scale-95" style={{ backgroundColor: nativeDestructiveColor, boxShadow: `0 10px 30px -5px ${nativeDestructiveColor}66` }}>Да</RippleButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
