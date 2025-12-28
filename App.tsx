
// Build: 2.9.17
// - UI: Replaced harsh flash with a stylish "soft bloom pulse" (radial light burst) for play/pause.
// - UI: Refined main cover scale animation for better tactile feedback.
// - UI: Removed headers from Station Editor (Edit/New) for a cleaner look.
// - UI: Added "Clear All" button to playlist (visible in Edit Mode).
// - UI: Updated "Export to Clipboard" to include 🤖 @mdsradibot Station List prefix.
// - UI: Support for JPG, PNG, WEBP, SVG, MOV, MP4 in covers.

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

const APP_VERSION = "2.9.17";

// Helper to detect video format support
const isVideoUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  const cleanUrl = url.split(/[?#]/)[0].toLowerCase();
  return cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.webm');
};

const MiniEqualizer: React.FC = () => (
  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
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
  showTags?: boolean;
}> = ({ station, className = "", showTags = true }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

  const isVideo = useMemo(() => isVideoUrl(station?.coverUrl), [station?.coverUrl]);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    if (!station?.coverUrl) return;

    if (!isVideo) {
      const img = mediaRef.current as HTMLImageElement;
      if (img && img.complete && img.naturalWidth > 0) setIsLoaded(true);
    } else {
      const video = mediaRef.current as HTMLVideoElement;
      if (video && video.readyState >= 3) setIsLoaded(true);
    }
  }, [station?.id, station?.coverUrl, isVideo]);

  const renderTags = () => {
    if (!showTags || !station?.tags || station.tags.length === 0) return null;
    return (
      <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-1.5 max-w-[80%] pointer-events-none">
        {station.tags.map(tag => (
          <span key={tag} className="text-[8px] font-black uppercase px-2 py-1 bg-black/40 backdrop-blur-md text-white rounded-lg border border-white/10">
            {tag}
          </span>
        ))}
      </div>
    );
  };

  if (!station?.coverUrl || hasError) {
    return (
      <div className={`${className} bg-blue-600 flex items-center justify-center text-white text-5xl font-black select-none relative overflow-hidden`}>
        {renderTags()}
        <span className="text-7xl">{station?.name?.charAt(0)?.toUpperCase?.() || 'R'}</span>
      </div>
    );
  }

  return (
    <div className={`${className} relative bg-gray-200 dark:bg-[#1a1a1a] overflow-hidden`}>
      {renderTags()}
      
      {isVideo ? (
        <motion.video
          ref={mediaRef as any}
          key={`vid-${station.coverUrl}`}
          src={station.coverUrl}
          autoPlay muted loop playsInline
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          onLoadedData={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover select-none pointer-events-none"
        />
      ) : (
        <motion.img
          ref={mediaRef as any}
          key={`img-${station.coverUrl}`}
          src={station.coverUrl}
          alt={station.name || 'Cover'}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
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
      transition={{ type: "spring", stiffness: 500, damping: 50, layout: { duration: 0.25 } }}
      onDragStart={() => { setIsDragging(true); hapticImpact('light'); }}
      onDragEnd={() => setIsDragging(false)}
      whileDrag={{ scale: 1.02, zIndex: 100, backgroundColor: "var(--tg-theme-secondary-bg-color, #f8f8f8)", boxShadow: "none" }}
      className={`flex items-center gap-3 p-2 mb-2 rounded-[1.25rem] group relative border-2 ${isActive && !isEditMode ? 'bg-blue-100/30 dark:bg-white/[0.08] border-blue-200/50 dark:border-white/20' : 'bg-white dark:bg-white/[0.015] border-transparent'} ${isEditMode ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'} ${isDragging ? 'z-50' : 'shadow-sm select-none'}`}
      onClick={(e: React.MouseEvent) => !isDragging && (isEditMode ? onEdit(e) : onSelect())}
    >
      {isEditMode && (
        <div className="p-3 cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-600 flex items-center justify-center shrink-0" onPointerDown={(e) => controls.start(e)}>
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
        <p className="font-bold text-base truncate leading-tight dark:text-white/90" style={{ color: isActive && !isEditMode ? accentColor : undefined }}>{station.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {station.tags && station.tags.length > 0 && (
            <div className="flex gap-1">
              {station.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 rounded-md">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 ml-auto pr-1">
        <RippleButton onClick={(e) => { e.stopPropagation(); onToggleFavorite(e); }} className={`p-2.5 rounded-xl transition-colors ${isFavorite ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}`}>
          {isFavorite ? <Icons.Star /> : <Icons.StarOutline />}
        </RippleButton>
        {isEditMode && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex gap-0.5">
            <RippleButton onClick={(e) => { e.stopPropagation(); onEdit(e); }} className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 transition-colors hover:text-blue-500"><Icons.Settings /></RippleButton>
            <RippleButton onClick={(e) => { e.stopPropagation(); onDelete(e); }} className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"><svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg></RippleButton>
          </motion.div>
        )}
      </div>
    </ReorderItem>
  );
};

export const App: React.FC = () => {
  const { hapticImpact, hapticNotification, setBackButton, isMobile, themeParams } = useTelegram();

  const [stations, setStations] = useState<Station[]>(() => {
    const saved = localStorage.getItem('radio_stations');
    if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) return parsed; } catch {} }
    return DEFAULT_STATIONS;
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
  const [isPlaylistEditMode, setIsPlaylistEditMode] = useState(false);
  const [playlistFilter, setPlaylistFilter] = useState<'all' | 'favorites'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [confirmData, setConfirmData] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [sleepTimerEndDate, setSleepTimerEndDate] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  
  const [actionTrigger, setActionTrigger] = useState(0);

  const [swiperInstance, setSwiperInstance] = useState<SwiperClass | null>(null);
  const isReorderingRef = useRef(false);

  const sleepTimerTimeoutRef = useRef<number | null>(null);
  const originalVolumeRef = useRef<number>(0.5);
  const isFadingOutRef = useRef<boolean>(false);
  const dragControls = useDragControls();
  const listRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef(0);

  const [editorCoverPreview, setEditorCoverPreview] = useState<string>('');
  const [customSleepMinutes, setCustomSleepMinutes] = useState<string>('');

  const handleTouchStart = (e: React.TouchEvent) => { if (!isPlaylistEditMode) touchStartRef.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPlaylistEditMode) return;
    const distance = e.changedTouches[0].clientY - touchStartRef.current;
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

  const stationsInPlaylist = useMemo(() => playlistFilter === 'favorites' ? stations.filter(s => favorites.includes(s.id)) : stations, [playlistFilter, stations, favorites]);

  const activeStation = useMemo<Station | null>(() => {
    if (!displayedStations.length) return null;
    return displayedStations.find(s => s.id === activeStationId) || displayedStations[0] || null;
  }, [displayedStations, activeStationId]);

  const playingStation = useMemo<Station | null>(() => {
    if (!stations.length) return null;
    return stations.find(s => s.id === playingStationId) || null;
  }, [stations, playingStationId]);

  const { status, volume, setVolume, play, stop } = useAudio(playingStation?.streamUrl || null);

  const isActuallyPlaying = (playingStationId === activeStationId) && (status === 'playing' || status === 'loading');

  const handleTogglePlay = useCallback(() => {
    if (!activeStation) return;
    setActionTrigger(prev => prev + 1);
    
    if (playingStationId === activeStationId) {
      if (status === 'playing' || status === 'loading') { hapticImpact('medium'); stop(); }
      else { hapticImpact('rigid'); play(activeStation.streamUrl); }
    } else {
      setPlayingStationId(activeStationId);
      if (favorites.includes(activeStationId)) setLastPlayedFavoriteId(activeStationId);
      hapticImpact('rigid'); play(activeStation.streamUrl);
    }
  }, [activeStationId, playingStationId, status, activeStation, hapticImpact, play, stop, favorites]);

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
    } else { setSleepTimerEndDate(null); setSnackbar('Таймер сна отключен'); if (originalVolumeRef.current !== undefined) setVolume(originalVolumeRef.current); }
    setShowSleepTimerModal(false);
    setCustomSleepMinutes('');
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

  const handleReorder = (reorderedItems: Station[]) => {
    isReorderingRef.current = true;
    if (playlistFilter === 'all') setStations(reorderedItems);
    else {
      const newStations = [...stations];
      let favIdx = 0;
      for(let i=0; i<newStations.length; i++) { if (favorites.includes(newStations[i].id)) newStations[i] = reorderedItems[favIdx++]; }
      setStations(newStations);
    }
    hapticImpact('light');
    setTimeout(() => { isReorderingRef.current = false; }, 50);
  };

  const toggleFavorite = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); hapticImpact('light');
    setFavorites(prev => {
      const isFavNow = prev.includes(id);
      const nextFavs = isFavNow ? prev.filter(fid => fid !== id) : [...prev, id];
      if (onlyFavoritesMode && isFavNow && id === activeStationId) {
        const favStations = stations.filter(s => nextFavs.includes(s.id));
        if (favStations.length > 0) {
          const currentIndex = stations.findIndex(s => s.id === id);
          const nextFav = favStations.find(s => stations.findIndex(st => st.id === s.id) > currentIndex) || favStations[0];
          setTimeout(() => { setActiveStationId(nextFav.id); if (status === 'playing' || status === 'loading') { setPlayingStationId(nextFav.id); setLastPlayedFavoriteId(nextFav.id); play(nextFav.streamUrl); } }, 0);
        } else { setTimeout(() => { setOnlyFavoritesMode(false); setSnackbar('Режим избранного отключен: список пуст'); }, 0); }
      } else if (!isFavNow) setLastPlayedFavoriteId(id);
      return nextFavs;
    });
  }, [hapticImpact, onlyFavoritesMode, activeStationId, stations, status, play]);

  const toggleOnlyFavoritesMode = useCallback(() => {
    if (!hasStations) return;
    if (!hasFavorites && !onlyFavoritesMode) { setSnackbar('Добавьте станцию в избранное'); hapticNotification('warning'); return; }
    const nextMode = !onlyFavoritesMode;
    const prevActiveId = activeStationId;
    let targetStationId = prevActiveId;
    isReorderingRef.current = true;
    setOnlyFavoritesMode(nextMode); hapticImpact('medium');
    setSnackbar(nextMode ? 'Режим избранного: ВКЛ' : 'Режим избранного: ВЫКЛ');
    if (nextMode) {
      const currentIsFav = favorites.includes(prevActiveId);
      if (!currentIsFav) {
        const favList = stations.filter(s => favorites.includes(s.id));
        if (favList.length > 0) {
          const fallbackId = favorites.includes(lastPlayedFavoriteId) ? lastPlayedFavoriteId : favList[0].id;
          const fallbackStation = favList.find(s => s.id === fallbackId) || favList[0];
          targetStationId = fallbackStation.id;
          setActiveStationId(targetStationId);
          if (status === 'playing' || status === 'loading') { setPlayingStationId(targetStationId); setLastPlayedFavoriteId(targetStationId); play(fallbackStation.streamUrl); }
        }
      }
    }
    setTimeout(() => { if (swiperInstance) { const newList = nextMode ? stations.filter(s => favorites.includes(s.id)) : stations; const newIdx = newList.findIndex(s => s.id === targetStationId); if (newIdx !== -1) swiperInstance.slideToLoop(newIdx, 0); } setTimeout(() => { isReorderingRef.current = false; }, 300); }, 0);
  }, [onlyFavoritesMode, hapticImpact, hapticNotification, hasStations, hasFavorites, stations, favorites, activeStationId, lastPlayedFavoriteId, status, play, swiperInstance]);

  const navigateStation = useCallback((navDir: 'next' | 'prev') => { if (!swiperInstance) return; hapticImpact('medium'); if (navDir === 'next') swiperInstance.slideNext(); else swiperInstance.slidePrev(); }, [swiperInstance, hapticImpact]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        processImportData(data);
      } catch (err) { setSnackbar('Ошибка импорта JSON'); hapticNotification('error'); }
    };
    input.click();
  }, [hapticNotification]);

  const handleImportFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      processImportData(data);
    } catch (err) { setSnackbar('Ошибка чтения буфера обмена'); hapticNotification('error'); }
  }, [hapticNotification]);

  const processImportData = (data: any) => {
    let newStations: Station[] = [];
    if (data && data.schemaVersion === 2 && Array.isArray(data.stations)) {
      newStations = data.stations.map((s: any) => ({ 
        id: s.id || Math.random().toString(36).substr(2, 9), 
        name: s.title || s.name, 
        streamUrl: s.streamUrl, 
        coverUrl: s.coverUrl, 
        homepageUrl: s.homepageUrl,
        tags: s.tags || [], 
        addedAt: Date.now() 
      }));
    } else if (Array.isArray(data)) {
      newStations = data.filter((s: any) => s.name && s.streamUrl).map(s => ({ ...s, id: s.id || Math.random().toString(36).substr(2, 9), addedAt: s.addedAt || Date.now() }));
    }
    if (newStations.length > 0) {
      setStations(prev => { 
        const existingUrls = new Set(prev.map(ps => ps.streamUrl)); 
        const uniqueNew = newStations.filter(ns => !existingUrls.has(ns.streamUrl)); 
        return [...prev, ...uniqueNew]; 
      });
      setSnackbar(`Успешно импортировано: ${newStations.length}`); hapticNotification('success');
    } else setSnackbar('Нет данных для импорта');
  };

  const handleExport = useCallback(() => {
    const schema = createExportSchema();
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radio_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    setSnackbar('Экспорт в файл завершен');
    hapticImpact('medium');
    setShowExportModal(false);
  }, [stations, favorites, hapticImpact]);

  const handleExportToClipboard = useCallback(() => {
    const schema = createExportSchema();
    const stationListText = stations.map(s => `- ${s.name}`).join('\n');
    const fullText = `🤖 @mdsradibot Station List:\n\n${stationListText}\n\n${JSON.stringify(schema, null, 2)}`;
    
    navigator.clipboard.writeText(fullText)
      .then(() => {
        setSnackbar('Скопировано в буфер обмена');
        hapticImpact('medium');
        setShowExportModal(false);
      });
  }, [stations, favorites, hapticImpact]);

  const createExportSchema = () => ({
    schemaVersion: 2,
    appVersion: APP_VERSION,
    exportedAt: Date.now(),
    stations: stations.map(s => ({
      id: s.id,
      title: s.name,
      streamUrl: s.streamUrl,
      coverUrl: s.coverUrl,
      homepageUrl: s.homepageUrl,
      tags: s.tags,
      isFavorite: favorites.includes(s.id)
    }))
  });

  const closeAllModals = useCallback(() => { 
    setShowEditor(false); 
    setShowPlaylist(false); 
    setShowConfirmModal(false); 
    setShowSleepTimerModal(false); 
    setShowAboutModal(false); 
    setShowExportModal(false); 
    setEditingStation(null); 
    setIsPlaylistEditMode(false); 
    setEditorCoverPreview('');
  }, []);

  const toggleMute = useCallback(() => { if (volume > 0) { setVolume(0); setSnackbar('Звук выключен'); hapticImpact('soft'); } else { setVolume(0.5); setSnackbar('Звук включен'); hapticImpact('rigid'); } }, [volume, setVolume, hapticImpact]);

  useEffect(() => { const isModalOpen = showEditor || showPlaylist || showConfirmModal || showSleepTimerModal || showAboutModal || showExportModal; setBackButton(isModalOpen, closeAllModals); }, [showEditor, showPlaylist, showConfirmModal, showSleepTimerModal, showAboutModal, showExportModal, setBackButton, closeAllModals]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement; if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      switch (e.code) { case 'Space': e.preventDefault(); handleTogglePlay(); break; case 'KeyM': e.preventDefault(); toggleMute(); break; case 'ArrowLeft': navigateStation('prev'); break; case 'ArrowRight': navigateStation('next'); break; case 'ArrowUp': e.preventDefault(); setVolume(prev => Math.min(1, prev + 0.05)); break; case 'ArrowDown': e.preventDefault(); setVolume(prev => Math.max(0, prev - 0.05)); break; }
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, navigateStation, setVolume, toggleMute]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); setConfirmData({ message: 'Удалить эту станцию?', onConfirm: () => { const filtered = stations.filter(s => s.id !== id); setStations(filtered); setFavorites(prev => prev.filter(fid => fid !== id)); if (playingStationId === id) { setPlayingStationId(''); stop(); } if (activeStationId === id) { if (filtered.length > 0) setActiveStationId(filtered[0].id); else { setActiveStationId(''); } } hapticImpact('heavy'); setSnackbar('Станция удалена'); setShowConfirmModal(false); } }); setShowConfirmModal(true);
  };

  const handleClearAll = () => {
    setConfirmData({
      message: 'Очистить весь список станций?',
      onConfirm: () => {
        setStations([]);
        setFavorites([]);
        setPlayingStationId('');
        setActiveStationId('');
        stop();
        hapticImpact('heavy');
        setSnackbar('Список очищен');
        setShowConfirmModal(false);
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
    const homepageUrl = (formData.get('homepageUrl') as string).trim();
    const tagsStr = (formData.get('tags') as string).trim(); 
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    
    if (!name || !url) return;
    
    if (editingStation) { 
      setStations(prev => prev.map(s => s.id === editingStation.id ? { ...s, name, streamUrl: url, coverUrl, homepageUrl, tags } : s)); 
      setEditingStation(null); 
      setSnackbar('Обновлено'); 
    }
    else { 
      const id = Math.random().toString(36).substr(2, 9); 
      const s: Station = { id, name, streamUrl: url, coverUrl: coverUrl || `https://picsum.photos/400/400?random=${Math.random()}`, homepageUrl, tags, addedAt: Date.now() }; 
      setStations(prev => [...prev, s]); 
      if (!activeStationId) setActiveStationId(id); 
      setSnackbar('Добавлено'); 
    }
    setShowEditor(false); 
    setEditorCoverPreview('');
    hapticImpact('light');
  };

  const nativeAccentColor = themeParams?.button_color || '#2563eb';
  const nativeDestructiveColor = themeParams?.destructive_text_color || '#ef4444';
  const nativeBgColor = themeParams?.bg_color || '#ffffff';
  const nativeTextColor = themeParams?.text_color || '#222222';

  return (
    <div className="flex flex-col overflow-hidden transition-colors duration-500 select-none" style={{ height: 'var(--tg-viewport-height, 100vh)', color: nativeTextColor, backgroundColor: nativeBgColor }}>
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
              {sleepTimerEndDate ? <motion.span key="time" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="font-black text-sm leading-none whitespace-nowrap">{timeRemaining ? `${Math.ceil((sleepTimerEndDate - Date.now()) / 60000)}m` : '...'}</motion.span> : <motion.div key="icon" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}><Icons.Timer /></motion.div>}
            </AnimatePresence>
          </motion.button>
          <RippleButton onClick={() => { setShowPlaylist(true); setIsPlaylistEditMode(false); }} className="w-[38px] h-[38px] flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500"><Icons.List /></RippleButton>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-evenly py-6 overflow-hidden relative z-10">
        <div className="relative w-[340px] aspect-square shrink-0 transition-all duration-500">
          {displayedStations.length > 0 ? (
            <Swiper
              key={`swiper-${displayedStations.length}-${onlyFavoritesMode}`}
              initialSlide={displayedStations.findIndex(s => s.id === activeStationId) || 0}
              onSwiper={setSwiperInstance}
              onSlideChange={(swiper) => {
                if (isReorderingRef.current) return;
                const targetStation = displayedStations[swiper.realIndex];
                if (targetStation && targetStation.id !== activeStationId) {
                  setActiveStationId(targetStation.id);
                  if (status === 'playing' || status === 'loading') {
                    if (targetStation.id !== playingStationId) {
                      setPlayingStationId(targetStation.id);
                      if (favorites.includes(targetStation.id)) setLastPlayedFavoriteId(targetStation.id);
                      play(targetStation.streamUrl);
                    }
                  }
                }
                hapticImpact('light');
              }}
              loop={displayedStations.length > 1}
              effect={'creative'}
              grabCursor={true}
              creativeEffect={{
                limitProgress: 3, perspective: true,
                prev: { translate: ['-100%', 0, -200], rotate: [0, 0, -15], opacity: 0, shadow: false },
                next: { translate: ['100%', 0, -200], rotate: [0, 0, 15], opacity: 0, shadow: false },
              }}
              modules={[EffectCreative, Keyboard]}
              keyboard={{ enabled: true }}
              className="mySwiper w-full h-full !overflow-visible"
            >
              {displayedStations.map((station) => (
                <SwiperSlide key={station.id} className="w-full h-full flex justify-center">
                  <div className="relative w-full aspect-square group" onClick={() => handleTogglePlay()}>
                    <motion.div 
                      key={`impact-${station.id}-${actionTrigger}`}
                      initial={false}
                      animate={{ 
                        scale: activeStationId === station.id ? [1, 0.94, 1] : 1 
                      }}
                      transition={{ 
                        duration: 0.4, 
                        type: "spring",
                        stiffness: 300,
                        damping: 20
                      }}
                      className="relative z-10 w-full h-full"
                    >
                      <motion.div
                        animate={{ scale: 1 }}
                        className="w-full h-full rounded-[2.5rem] overflow-hidden bg-white dark:bg-white/[0.05] border-2 transition-colors duration-700 relative"
                        style={{ borderColor: activeStationId === station.id ? `${nativeAccentColor}44` : 'transparent' }}
                      >
                        <StationCover station={station} className="w-full h-full" />
                        
                        {/* Stylish Bloom Pulse Effect on Play/Pause */}
                        {activeStationId === station.id && (
                          <motion.div
                            key={`bloom-${actionTrigger}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: [0, 0.5, 0], scale: [0.8, 1.25] }}
                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute inset-0 bg-[radial-gradient(circle,_rgba(255,255,255,0.8)_0%,_transparent_70%)] pointer-events-none z-40 blur-xl"
                          />
                        )}

                        <div className="absolute bottom-6 right-6 z-30" onClick={(e) => { e.stopPropagation(); toggleFavorite(station.id, e); }}>
                          <RippleButton className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${favorites.includes(station.id) ? 'bg-amber-500 text-white scale-105 shadow-lg shadow-amber-500/30' : 'bg-black/30 text-white/60'}`}>
                            {favorites.includes(station.id) ? <Icons.Star /> : <Icons.StarOutline />}
                          </RippleButton>
                        </div>
                      </motion.div>
                    </motion.div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-white/30 dark:bg-black/20 backdrop-blur-md rounded-[3rem] border border-white/10"
            >
              <div className="mb-6 opacity-30">
                <Icons.List className="w-16 h-16 mx-auto" />
              </div>
              <h2 className="text-2xl font-black mb-2 opacity-80">Плейлист пуст</h2>
              <p className="text-sm opacity-50 mb-8 font-medium">Добавьте свою станцию или начните с демо-списка</p>
              
              <div className="flex flex-col gap-3 w-full">
                <RippleButton 
                  onClick={() => { setEditingStation(null); setShowEditor(true); }}
                  className="w-full py-4 text-white rounded-2xl font-black shadow-lg"
                  style={{ backgroundColor: nativeAccentColor }}
                >
                  + Добавить станцию
                </RippleButton>
                
                <RippleButton 
                  onClick={() => { 
                    setStations(DEFAULT_STATIONS); 
                    setSnackbar('Демо-список загружен'); 
                    hapticImpact('medium'); 
                  }}
                  className="w-full py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-black opacity-60"
                >
                  Загрузить демо-список
                </RippleButton>
              </div>
            </motion.div>
          )}
        </div>

        <div className="w-full max-w-[360px] px-2 z-10 transition-all duration-500">
          <motion.div layout className="w-full flex flex-col items-center bg-white/80 dark:bg-white/[0.015] backdrop-blur-[70px] border border-white/50 dark:border-white/10 rounded-[3.5rem] py-8 px-6 shadow-xl" drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(_, info) => info.offset.y < -50 && setShowPlaylist(true)}>
            <div className="w-full flex flex-col items-center gap-6">
              <div className="text-center w-full px-2 min-h-[50px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  <motion.div key={activeStation?.id || 'none'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <h2 className="text-xl font-black truncate leading-tight tracking-tight">{activeStation?.name || (hasStations ? '...' : 'Радио')}</h2>
                    <p className="text-[10px] opacity-40 dark:opacity-60 uppercase tracking-[0.3em] font-black mt-1">
                      {isActuallyPlaying ? (status === 'loading' ? 'Загрузка...' : 'В эфире') : (hasStations ? 'Пауза' : 'Нет станций')}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="w-full max-w-[240px] flex flex-col">
                <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full appearance-none transition-all cursor-pointer" style={{ accentColor: nativeAccentColor }} />
              </div>

              <div className="w-full flex items-center justify-between px-2">
                <RippleButton onClick={() => navigateStation('prev')} className={`p-4 transition-all ${displayedStations.length > 1 ? 'opacity-50 hover:opacity-100' : 'opacity-10 pointer-events-none'}`}><Icons.Prev /></RippleButton>
                <RippleButton onClick={() => handleTogglePlay()} disabled={!hasStations} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl text-white active:scale-90 ${!hasStations ? 'opacity-30 grayscale pointer-events-none' : ''}`} style={{ backgroundColor: nativeAccentColor, boxShadow: `0 15px 40px -5px ${nativeAccentColor}77` }}>
                  {isActuallyPlaying ? <Icons.Pause className="w-8 h-8" /> : <Icons.Play className="w-8 h-8 ml-1" />}
                </RippleButton>
                <RippleButton onClick={() => navigateStation('next')} className={`p-4 transition-all ${displayedStations.length > 1 ? 'opacity-50 hover:opacity-100' : 'opacity-10 pointer-events-none'}`}><Icons.Next /></RippleButton>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2 mt-6 text-black/10 dark:text-white/10 w-full active:scale-105 transition-transform cursor-pointer">
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
            <motion.div drag={isPlaylistEditMode ? false : "y"} dragListener={!isPlaylistEditMode} dragControls={dragControls} dragDirectionLock dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 1 }} dragMomentum={false} onDragEnd={(_, info) => (info.offset.y > 100 || info.velocity.y > 500) && setShowPlaylist(false)} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.5 }} className="fixed bottom-0 left-0 right-0 h-[92vh] bg-white/95 dark:bg-black/60 rounded-t-[3.5rem] z-40 flex flex-col overflow-hidden pb-10 border-t border-white/20 dark:border-white/10 backdrop-blur-[80px]">
              <div className="w-full flex items-center justify-between px-8 pt-7 pb-3 shrink-0 touch-none">
                <div className="w-32" /> 
                <div className="w-12 h-1.5 bg-black/10 dark:bg-white/10 rounded-full cursor-grab active:cursor-grabbing" onPointerDown={(e) => !isPlaylistEditMode && dragControls.start(e)} />
                <div className="w-32 text-right">
                  <RippleButton onClick={() => setIsPlaylistEditMode(!isPlaylistEditMode)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${isPlaylistEditMode ? 'text-white' : 'bg-black/5 dark:bg-white/10 text-gray-500'}`} style={{ backgroundColor: isPlaylistEditMode ? nativeAccentColor : undefined }}>{isPlaylistEditMode ? 'Готово' : 'РЕДАКТ.'}</RippleButton>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="flex items-center bg-black/5 dark:bg-white/[0.04] rounded-[1.25rem] p-1.5 backdrop-blur-xl border border-white/5 transition-colors">
                  <button onClick={() => setPlaylistFilter('all')} className={`flex-1 py-3 text-sm font-black rounded-[1rem] ${playlistFilter === 'all' ? 'bg-white dark:bg-white/10' : 'opacity-50'}`} style={{ color: playlistFilter === 'all' ? nativeAccentColor : undefined }}>Все станции</button>
                  <button onClick={() => setPlaylistFilter('favorites')} className={`flex-1 py-3 text-sm font-black rounded-[1rem] ${playlistFilter === 'favorites' ? 'bg-white dark:bg-white/10' : 'opacity-50'}`} style={{ color: playlistFilter === 'favorites' ? nativeAccentColor : undefined }}>Избранное</button>
                </div>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto px-6 flex flex-col overscroll-contain no-scrollbar" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                {stationsInPlaylist.length > 0 ? (
                  <ReorderGroup axis="y" values={stationsInPlaylist} onReorder={handleReorder} className="space-y-2 pb-10">
                    {stationsInPlaylist.map(s => (
                        <ReorderableStationItem 
                          key={s.id} 
                          station={s} 
                          isActive={activeStationId === s.id} 
                          isPlaying={playingStationId === s.id} 
                          isFavorite={favorites.includes(s.id)} 
                          isEditMode={isPlaylistEditMode} 
                          status={status} 
                          accentColor={nativeAccentColor} 
                          destructiveColor={nativeDestructiveColor} 
                          hapticImpact={hapticImpact} 
                          onSelect={() => { 
                            if (playingStationId === s.id && (status === 'playing' || status === 'loading')) {
                              stop();
                            } else {
                              setActiveStationId(s.id); 
                              setPlayingStationId(s.id); 
                              if (favorites.includes(s.id)) setLastPlayedFavoriteId(s.id);
                              play(s.streamUrl); 
                            }
                          }} 
                          onToggleFavorite={(e) => toggleFavorite(s.id, e)} 
                          onEdit={(e) => { 
                            e.stopPropagation(); 
                            setEditingStation(s); 
                            setEditorCoverPreview(s.coverUrl || '');
                            setShowEditor(true); 
                          }} 
                          onDelete={(e) => handleDelete(s.id, e)} 
                        />
                    ))}
                  </ReorderGroup>
                ) : <div className="flex-1 flex flex-col items-center justify-center text-center p-10 font-black opacity-30 text-xl">Плейлист пуст</div>}
                <div className="mt-8 flex flex-col gap-4 mb-safe pb-16">
                  {isPlaylistEditMode && (
                    <div className="flex flex-col gap-4">
                      <RippleButton onClick={() => { setEditingStation(null); setEditorCoverPreview(''); setShowEditor(true); }} className="w-full p-6 rounded-[2rem] border-2 border-dashed border-black/5 dark:border-white/10 opacity-40 font-black flex items-center justify-center gap-3 transition-opacity hover:opacity-100"><Icons.Add /> Добавить станцию</RippleButton>
                      <RippleButton onClick={handleClearAll} className="w-full flex items-center justify-center gap-2 p-4 bg-red-500/5 dark:bg-red-500/10 text-red-500 rounded-2xl text-[10px] font-black border border-red-500/20"><Icons.Reset /> Очистить список</RippleButton>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <RippleButton onClick={handleImport} className="flex flex-col items-center justify-center p-4 bg-black/5 dark:bg-white/5 rounded-2xl text-[10px] font-black opacity-60"><Icons.Import /> Из файла</RippleButton>
                    <RippleButton onClick={handleImportFromClipboard} className="flex flex-col items-center justify-center p-4 bg-black/5 dark:bg-white/5 rounded-2xl text-[10px] font-black opacity-60"><Icons.Paste /> Из буфера</RippleButton>
                  </div>
                  <RippleButton onClick={() => setShowExportModal(true)} className="w-full flex items-center justify-center gap-2 p-4 bg-black/5 dark:bg-white/5 rounded-2xl text-[10px] font-black opacity-60"><Icons.Export /> Экспорт плейлиста</RippleButton>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- MODALS --- */}
      
      {/* Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditor(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#1c1c1c] rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
              {/* Titles removed per user request */}
              
              {/* Cover Preview Section */}
              <div className="flex justify-center mb-8 mt-4">
                 <div className="w-40 h-40 rounded-3xl overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center border-2 border-dashed border-black/10 relative">
                   {editorCoverPreview ? (
                      <StationCover 
                        station={{ name: 'Preview', coverUrl: editorCoverPreview }} 
                        className="w-full h-full" 
                        showTags={false} 
                      />
                   ) : (
                      <Icons.Add className="w-8 h-8 opacity-20" />
                   )}
                 </div>
              </div>

              <form onSubmit={addOrUpdateStation} className="space-y-4">
                <div>
                  <input name="name" defaultValue={editingStation?.name} placeholder="Название станции" required className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-5 py-4 font-bold outline-none border-2 border-transparent focus:border-blue-500/30 transition-all" />
                </div>
                <div>
                  <input name="url" defaultValue={editingStation?.streamUrl} placeholder="Адрес потока (Stream URL)" required className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-5 py-4 font-bold outline-none border-2 border-transparent focus:border-blue-500/30 transition-all" />
                </div>
                <div>
                  <input 
                    name="coverUrl" 
                    defaultValue={editingStation?.coverUrl} 
                    placeholder="Адрес обложки (jpg, png, webp, svg, mov, mp4)"
                    onChange={(e) => setEditorCoverPreview(e.target.value)}
                    className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-5 py-4 font-bold outline-none border-2 border-transparent focus:border-blue-500/30 transition-all" 
                  />
                </div>
                <div>
                  <input name="homepageUrl" defaultValue={editingStation?.homepageUrl} placeholder="Домашняя страница" className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-5 py-4 font-bold outline-none border-2 border-transparent focus:border-blue-500/30 transition-all" />
                </div>
                <div>
                  <input name="tags" defaultValue={editingStation?.tags?.join(', ')} placeholder="Теги (через запятую)" className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-5 py-4 font-bold outline-none border-2 border-transparent focus:border-blue-500/30 transition-all" />
                </div>
                <div className="flex gap-3 pt-6">
                  <RippleButton type="button" onClick={() => setShowEditor(false)} className="flex-1 py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-black opacity-60">Отмена</RippleButton>
                  <RippleButton type="submit" className="flex-1 py-4 text-white rounded-2xl font-black shadow-lg" style={{ backgroundColor: nativeAccentColor }}>Сохранить</RippleButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sleep Timer Modal */}
      <AnimatePresence>
        {showSleepTimerModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSleepTimerModal(false)} />
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="relative w-full max-w-sm bg-white dark:bg-[#1c1c1c] rounded-[2.5rem] p-8 shadow-2xl">
              <h2 className="text-2xl font-black mb-6 text-center">Таймер сна</h2>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[15, 30, 45, 60, 90, 120].map(min => (
                  <RippleButton key={min} onClick={() => handleSetSleepTimer(min)} className="py-3 bg-black/5 dark:bg-white/5 rounded-xl font-black hover:bg-blue-500 hover:text-white transition-all text-xs">{min} м</RippleButton>
                ))}
              </div>
              
              <div className="mb-6">
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={customSleepMinutes} 
                    onChange={(e) => setCustomSleepMinutes(e.target.value)}
                    placeholder="Минуты"
                    className="flex-1 bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3 font-bold outline-none text-center" 
                  />
                  <RippleButton 
                    onClick={() => {
                      const val = parseInt(customSleepMinutes);
                      if (!isNaN(val) && val > 0) handleSetSleepTimer(val);
                    }}
                    disabled={!customSleepMinutes}
                    className="px-6 rounded-xl text-white font-black transition-opacity disabled:opacity-20"
                    style={{ backgroundColor: nativeAccentColor }}
                  > OK
                  </RippleButton>
                </div>
              </div>

              <RippleButton onClick={() => handleSetSleepTimer(0)} className="w-full py-4 text-red-500 bg-red-500/10 rounded-2xl font-black">Отключить таймер</RippleButton>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <AnimatePresence>
        {showConfirmModal && confirmData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowConfirmModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-[#252525] p-8 rounded-[2.5rem] text-center max-w-xs shadow-2xl">
              <p className="font-black text-xl mb-6">{confirmData.message}</p>
              <div className="flex gap-4">
                <RippleButton onClick={() => setShowConfirmModal(false)} className="flex-1 py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-black opacity-40">Нет</RippleButton>
                <RippleButton onClick={confirmData.onConfirm} className="flex-1 py-4 text-white rounded-2xl font-black shadow-lg" style={{ backgroundColor: nativeDestructiveColor }}>Да</RippleButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowExportModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-white dark:bg-[#1c1c1c] rounded-[2.5rem] p-8 shadow-2xl">
              <h2 className="text-2xl font-black mb-4">Экспорт данных</h2>
              <p className="opacity-60 text-sm mb-6 font-medium">Выберите способ сохранения плейлиста.</p>
              <div className="space-y-3">
                <RippleButton onClick={handleExportToClipboard} className="w-full py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-black flex items-center justify-center gap-3"><Icons.Copy /> Копировать в буфер</RippleButton>
                <RippleButton onClick={handleExport} className="w-full py-4 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-3" style={{ backgroundColor: nativeAccentColor }}><Icons.Export /> Скачать .json файл</RippleButton>
                <RippleButton onClick={() => setShowExportModal(false)} className="w-full py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-black opacity-60">Отмена</RippleButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* About Modal */}
      <AnimatePresence>
        {showAboutModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAboutModal(false)} />
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="relative w-full max-w-sm bg-white dark:bg-[#1c1c1c] rounded-[2.5rem] p-8 shadow-2xl text-center">
              <Logo className="w-16 h-16 mx-auto mb-4" style={{ color: nativeAccentColor }} />
              <h2 className="text-2xl font-black mb-1">Radio Player</h2>
              <p className="opacity-40 text-[10px] font-black uppercase tracking-widest mb-6">v{APP_VERSION}</p>
              <div className="space-y-4 text-left bg-black/5 dark:bg-white/5 p-4 rounded-2xl text-xs font-medium opacity-80 mb-6">
                <p>• Нативное управление (HLS поддержка)</p>
                <p>• Тёмная и светлая темы</p>
                <p>• Таймер сна и избранное</p>
                <p>• Импорт и экспорт плейлистов</p>
              </div>
              <RippleButton onClick={() => setShowAboutModal(false)} className="w-full py-4 text-white rounded-2xl font-black shadow-lg" style={{ backgroundColor: nativeAccentColor }}>Закрыть</RippleButton>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>{snackbar && <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} className="fixed bottom-12 left-8 right-8 z-[100] bg-black/95 text-white px-8 py-5 rounded-[2.5rem] font-bold shadow-2xl">{snackbar}</motion.div>}</AnimatePresence>
    </div>
  );
};
