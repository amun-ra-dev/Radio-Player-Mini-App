
// Build: 2.3.1
// - UI: Removed 'Demo' button from Playlist modal (Убрал кнопку Демо из плейлиста).
// - Logic: Robust JSON searching in clipboard text.
// - UX: Auto-fallback to manual input if clipboard access fails.

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

const APP_VERSION = "2.3.1";

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
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  hapticImpact: (style?: any) => void;
}

const ReorderableStationItem: React.FC<ReorderItemProps> = ({
  station, isActive, isPlaying, isFavorite, status, onSelect, onEdit, onDelete, onToggleFavorite, hapticImpact
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
      className={`flex items-center gap-3 p-2 mb-2 rounded-[1.25rem] transition-colors group relative border-2 ${isActive ? 'bg-blue-100/50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-500/30' : 'hover:bg-gray-50 dark:hover:bg-white/5 bg-white dark:bg-[#1c1c1c] border-transparent'} cursor-grab active:cursor-grabbing`}
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
        <p className={`font-bold text-base truncate leading-tight ${isActive ? 'text-blue-700 dark:text-blue-300' : 'dark:text-white/90'}`}>{station.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {station.tags && station.tags.length > 0 && (
            <div className="flex gap-1">
              {station.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-gray-100 dark:bg-[#333] text-gray-500 dark:text-gray-400 rounded-md">{tag}</span>
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
        <RippleButton onClick={onEdit} className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-blue-500"><Icons.Settings /></RippleButton>
        <RippleButton onClick={onDelete} className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-red-500">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
        </RippleButton>
      </div>
    </ReorderItem>
  );
};

export const App: React.FC = () => {
  const { hapticImpact, hapticNotification, setBackButton, isMobile } = useTelegram();
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
  useEffect(() => { if (!snackbar) return; const timer = setTimeout(() => setSnackbar(null), 3500); return () => clearTimeout(timer); }, [snackbar]);

  const hasStations = stations.length > 0;
  const hasFavorites = favorites.length > 0;

  useEffect(() => { if (!hasFavorites && onlyFavoritesMode) setOnlyFavoritesMode(false); }, [hasFavorites, onlyFavoritesMode]);

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

  const playingStation = useMemo<Station | null>(() => {
    if (!stations.length) return null;
    return stations.find(s => s.id === playingStationId) || null;
  }, [stations, playingStationId]);

  const { status, volume, setVolume, togglePlay: baseTogglePlay, play, stop } = useAudio(playingStation?.streamUrl || null);

  const handleTogglePlay = useCallback(() => {
    if (!activeStation) return;
    if (playingStationId === activeStationId && status !== 'idle') {
      baseTogglePlay();
    } else {
      setPlayingStationId(activeStationId);
      hapticImpact('medium');
      play(activeStation.streamUrl);
    }
  }, [activeStationId, playingStationId, status, baseTogglePlay, activeStation, hapticImpact, play]);

  useEffect(() => {
    if (!displayedStations.length) { if (activeStationId) setActiveStationId(''); return; }
    if (!activeStationId || !displayedStations.some(s => s.id === activeStationId)) { 
        setActiveStationId(displayedStations[0].id); 
    }
  }, [displayedStations, activeStationId]);

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
    setTimeout(() => { isReorderingRef.current = false; }, 50);
  };

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
    if (swiperInstance) {
        const nextList = nextMode ? stations.filter(s => favorites.includes(s.id)) : stations;
        const targetIdx = Math.min(swiperInstance.realIndex, nextList.length - 1);
        if (nextList[targetIdx]) setActiveStationId(nextList[targetIdx].id);
    }
  }, [onlyFavoritesMode, hapticImpact, hapticNotification, hasStations, hasFavorites, stations, swiperInstance]);

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
        hapticImpact('light');
        play(station.streamUrl);
    }
  }, [activeStationId, handleTogglePlay, hapticImpact, play]);

  const closeAllModals = useCallback(() => {
    setShowEditor(false); setShowPlaylist(false); setShowConfirmModal(false);
    setShowSleepTimerModal(false); setShowAboutModal(false); setShowManualImport(false);
    setEditingStation(null);
  }, []);

  useEffect(() => {
    const isModalOpen = showEditor || showPlaylist || showConfirmModal || showSleepTimerModal || showAboutModal || showManualImport;
    setBackButton(isModalOpen, closeAllModals);
  }, [showEditor, showPlaylist, showConfirmModal, showSleepTimerModal, showAboutModal, showManualImport, setBackButton, closeAllModals]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); handleTogglePlay(); break;
        case 'arrowleft': navigateStation('prev'); break;
        case 'arrowright': navigateStation('next'); break;
        case 'arrowup': e.preventDefault(); setVolume(prev => Math.min(1, prev + 0.05)); break;
        case 'arrowdown': e.preventDefault(); setVolume(prev => Math.max(0, prev - 0.05)); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, navigateStation, setVolume]);

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

  // --- Export Logic ---
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
    
    const text = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(text)
      .then(() => { 
        hapticNotification('success'); 
        setSnackbar(`Экспорт v2 завершен! Скопировано ${stations.length} станций.`); 
      })
      .catch(() => { 
        hapticNotification('error'); 
        setSnackbar('Ошибка экспорта'); 
      });
  };

  // --- Import Logic ---
  const processImportText = (text: string, isManual = false) => {
    try {
      let jsonStr = text.trim();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      const startArr = text.indexOf('[');
      const endArr = text.lastIndexOf(']');

      // Находим границы JSON
      if (start !== -1 && end !== -1 && (startArr === -1 || start < startArr)) {
        jsonStr = text.substring(start, end + 1);
      } else if (startArr !== -1 && endArr !== -1) {
        jsonStr = text.substring(startArr, endArr + 1);
      }

      const parsed = JSON.parse(jsonStr);
      let importedStations: any[] = [];

      if (parsed.schemaVersion === 2 && Array.isArray(parsed.stations)) {
        importedStations = parsed.stations;
      } else if (Array.isArray(parsed)) {
        importedStations = parsed;
      } else if (typeof parsed === 'object') {
        importedStations = [parsed];
      }

      const urlPattern = /^https?:\/\/.+/i;
      const valid = importedStations.filter(s => 
        (s.title || s.name) && 
        (s.streamUrl || s.url) && 
        urlPattern.test(s.streamUrl || s.url)
      );

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

      let added = 0;
      let updated = 0;

      setStations(prev => {
        const next = [...prev];
        const nextFavs = [...favorites];

        valid.forEach(imp => {
          const impUrl = imp.streamUrl || imp.url;
          const impTitle = imp.title || imp.name;
          const impCover = imp.coverUrl || imp.cover || '';
          const impTags = Array.isArray(imp.tags) ? imp.tags : [];
          const impFav = imp.isFavorite === true;

          const existingIdx = next.findIndex(s => s.streamUrl === impUrl);

          if (existingIdx !== -1) {
            next[existingIdx] = {
              ...next[existingIdx],
              name: impTitle,
              coverUrl: impCover || next[existingIdx].coverUrl,
              tags: impTags.length > 0 ? impTags : next[existingIdx].tags
            };
            if (impFav && !nextFavs.includes(next[existingIdx].id)) {
              nextFavs.push(next[existingIdx].id);
            }
            updated++;
          } else {
            const newId = imp.id || Math.random().toString(36).substr(2, 9);
            next.push({
              id: newId,
              name: impTitle,
              streamUrl: impUrl,
              coverUrl: impCover || `https://picsum.photos/400/400?random=${Math.random()}`,
              tags: impTags,
              addedAt: Date.now()
            });
            if (impFav) nextFavs.push(newId);
            added++;
          }
        });

        setFavorites(nextFavs);
        return next;
      });

      hapticNotification('success');
      setSnackbar(`Итог: +${added} добавлено, ~${updated} обновлено`);
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
      // Fallback if clipboard access denied
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
          const existingUrls = new Set(prev.map(s => s.streamUrl));
          const unique = DEFAULT_STATIONS.filter(s => !existingUrls.has(s.streamUrl));
          if (!activeStationId && unique.length > 0) setActiveStationId(unique[0].id);
          return [...prev, ...unique];
        });
        setSnackbar(`Добавлено станций: ${DEFAULT_STATIONS.length}`); 
        hapticNotification('success');
      }
    });
    setShowConfirmModal(true);
  };

  const addOrUpdateStation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const url = formData.get('url') as string;
    const coverUrl = formData.get('coverUrl') as string;
    const tagsStr = formData.get('tags') as string;
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

  return (
    <div className="flex flex-col overflow-hidden text-[#222222] dark:text-white bg-[radial-gradient(circle_at_center,_#ffffff_0%,_#f0f7ff_100%)] dark:bg-[radial-gradient(circle_at_center,_#1a1c26_0%,_#12141a_100%)] transition-colors duration-500" style={{ height: 'var(--tg-viewport-height, 100vh)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 bg-blue-50/80 dark:bg-[#161922] border-b border-blue-100/50 dark:border-blue-900/30 z-20 shrink-0 backdrop-blur-md" style={{ paddingTop: isMobile ? 'calc(var(--tg-safe-top, 0px) + 46px)' : 'calc(var(--tg-safe-top, 0px) + 16px)', paddingBottom: '12px' }}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowAboutModal(true)}>
          <Logo className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-black tracking-tighter leading-none">Radio Player</h1>
        </div>
        <div className="flex items-center gap-1">
          <RippleButton onClick={toggleOnlyFavoritesMode} disabled={!hasStations} className={`w-[38px] h-[38px] flex items-center justify-center rounded-full transition-all duration-300 ${!hasStations ? 'opacity-20 pointer-events-none' : onlyFavoritesMode ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500 scale-110' : 'text-gray-400 dark:text-gray-500'}`}><Icons.Star /></RippleButton>
          <motion.button layout disabled={!hasStations} onClick={() => setShowSleepTimerModal(true)} className={`ripple h-[38px] rounded-full relative flex items-center justify-center transition-all ${!hasStations ? 'w-[38px] opacity-20 pointer-events-none' : (sleepTimerEndDate ? 'bg-blue-600 dark:bg-blue-500 text-white px-4' : 'w-[38px] text-gray-400 dark:text-gray-500')}`} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {sleepTimerEndDate ? (
                <motion.span key="time" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="font-black text-sm leading-none whitespace-nowrap">{timeRemaining ? `${Math.ceil((sleepTimerEndDate - Date.now()) / 60000)}m` : '...'}</motion.span>
              ) : <motion.div key="icon" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}><Icons.Timer /></motion.div>}
            </AnimatePresence>
          </motion.button>
          <RippleButton onClick={() => setShowPlaylist(true)} className="w-[38px] h-[38px] flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500"><Icons.List /></RippleButton>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-evenly py-6 overflow-hidden relative">
        {/* Carousel */}
        <div className="relative w-[340px] aspect-square shrink-0 transition-all duration-500">
          {hasStations ? (
            <Swiper
              onSwiper={setSwiperInstance}
              onSlideChange={(swiper) => {
                if (isReorderingRef.current) return;
                const targetStation = displayedStations[swiper.realIndex];
                if (targetStation) {
                    setActiveStationId(targetStation.id);
                    if (status === 'playing' || status === 'loading') setPlayingStationId(targetStation.id);
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
                  <div className={`relative w-full aspect-square rounded-[2.5rem] overflow-hidden bg-white dark:bg-[#1c1c1c] border-2 ${activeStationId === station.id ? 'border-blue-600/20 dark:border-blue-400/20 shadow-xl dark:shadow-blue-900/10' : 'border-transparent'} transition-all duration-500 ${canPlay ? 'cursor-pointer' : 'cursor-default'}`} onClick={() => canPlay && handleTogglePlay()}>
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
              <div className="w-full aspect-square mx-auto rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-[#2f6ff7] to-[#1a4ab2] flex flex-col items-center justify-center text-center p-8">
                <h2 className="text-white text-3xl font-black mb-2">Нет станций</h2>
                <p className="text-white/80 text-sm font-bold mb-8">Добавьте первую станцию в плейлист</p>
                <div className="flex flex-col gap-4 w-full">
                  <RippleButton onClick={() => { setEditingStation(null); setShowEditor(true); }} className="w-full py-4 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-black">Добавить станцию</RippleButton>
                  <div className="grid grid-cols-2 gap-3">
                    <RippleButton onClick={handleImport} className="py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black">Импорт</RippleButton>
                    <RippleButton onClick={handleDemo} className="py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black">Демо</RippleButton>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="w-full max-w-[360px] px-2 z-10 transition-all duration-500">
          <motion.div 
            layout
            className="w-full flex flex-col items-center bg-white/70 dark:bg-[#12141a]/80 backdrop-blur-3xl border border-white/40 dark:border-blue-500/20 rounded-[3.5rem] py-8 px-6 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
            drag="y" 
            dragConstraints={{ top: 0, bottom: 0 }} 
            onDragEnd={(_, info) => info.offset.y < -50 && setShowPlaylist(true)}
          >
            <div className="w-full flex flex-col items-center gap-6">
              <div className="text-center w-full px-2 min-h-[50px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  <motion.div key={activeStation?.id || 'none'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                    <h2 className="text-xl font-black mb-1 truncate leading-tight dark:text-white tracking-tight">{activeStation?.name || 'Пусто'}</h2>
                    <p className="text-[10px] opacity-40 dark:opacity-60 uppercase tracking-[0.3em] font-black dark:text-white/80">
                        {!activeStation ? 'Выберите источник' : 
                         (playingStationId === activeStationId && status === 'playing' ? 'В эфире' : 
                          playingStationId === activeStationId && status === 'loading' ? 'Загрузка...' : 
                          'Пауза')}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="w-full max-w-[240px] flex flex-col gap-3">
                <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-blue-100/60 dark:bg-white/10 rounded-full appearance-none accent-blue-600 transition-all hover:h-2 cursor-pointer" disabled={!canPlay} />
              </div>

              <div className="w-full flex items-center justify-between px-2">
                <RippleButton onClick={() => navigateStation('prev')} className={`p-4 transition-all ${displayedStations.length > 1 ? 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 active:scale-90' : 'text-gray-300 dark:text-gray-700 opacity-20 pointer-events-none'}`}><Icons.Prev /></RippleButton>
                <RippleButton onClick={() => canPlay && handleTogglePlay()} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-xl ${canPlay ? 'bg-blue-600 text-white shadow-blue-600/30' : 'bg-gray-200 dark:bg-white/5 text-gray-400 dark:text-gray-600'}`} disabled={!canPlay}>
                    {(playingStationId === activeStationId) && (status === 'playing' || status === 'loading') ? <Icons.Pause className="w-8 h-8" /> : <Icons.Play className="w-8 h-8" />}
                </RippleButton>
                <RippleButton onClick={() => navigateStation('next')} className={`p-4 transition-all ${displayedStations.length > 1 ? 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 active:scale-90' : 'text-gray-300 dark:text-gray-700 opacity-20 pointer-events-none'}`}><Icons.Next /></RippleButton>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2 mt-6 text-blue-400/40 dark:text-white/20 cursor-grab w-full active:scale-105 transition-transform">
              <div className="w-12 h-1 rounded-full bg-current mx-auto" />
              <span className="text-[9px] uppercase font-black tracking-[0.3em] text-center ml-1">Плейлист</span>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Playlist Modal */}
      <AnimatePresence>
        {showPlaylist && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 z-30 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div drag="y" dragListener={false} dragControls={dragControls} dragDirectionLock dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 1 }} dragMomentum={false} onDragEnd={(_, info) => (info.offset.y > 100 || info.velocity.y > 500) && setShowPlaylist(false)} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.5 }} className="fixed bottom-0 left-0 right-0 h-[90vh] bg-[#f8faff] dark:bg-[#0f1118] rounded-t-[3.5rem] z-40 flex flex-col overflow-hidden pb-10">
              <div className="w-full flex flex-col items-center pt-6 pb-4 shrink-0 touch-none cursor-grab active:cursor-grabbing" onPointerDown={(e) => dragControls.start(e)}><div className="w-20 h-1.5 bg-blue-100 dark:bg-white/10 rounded-full mb-3" /></div>
              <div className="px-6 pb-4">
                <div className="flex items-center bg-blue-50/50 dark:bg-[#1e2129]/50 rounded-[1.25rem] p-1.5 backdrop-blur-xl">
                  <button onClick={() => setPlaylistFilter('all')} className={`flex-1 py-3 text-sm font-black rounded-[1rem] transition-all ${playlistFilter === 'all' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Все станции</button>
                  <button onClick={() => setPlaylistFilter('favorites')} className={`flex-1 py-3 text-sm font-black rounded-[1rem] transition-all ${playlistFilter === 'favorites' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Избранное</button>
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
                            hapticImpact={hapticImpact} 
                            onSelect={() => handleSelectStation(s)} 
                            onToggleFavorite={(e) => toggleFavorite(s.id, e)} 
                            onEdit={(e) => { e.stopPropagation(); setEditingStation(s); setShowEditor(true); setShowPlaylist(false); }} 
                            onDelete={(e) => handleDelete(s.id, e)} 
                        />
                    ))}
                  </ReorderGroup>
                ) : <div className="flex-1 flex flex-col items-center justify-center text-center p-10"><h3 className="text-xl font-black text-gray-400 dark:text-gray-700">{playlistFilter === 'favorites' ? 'Нет избранных' : 'Плейлист пуст'}</h3></div>}
                <div className="mt-8 flex flex-col gap-4 mb-safe pb-16">
                  <RippleButton onClick={() => { setEditingStation(null); setShowEditor(true); setShowPlaylist(false); }} className="w-full p-6 rounded-[2rem] border-2 border-dashed border-blue-100 dark:border-white/5 text-blue-400 dark:text-white/20 font-black flex items-center justify-center gap-3 transition-all hover:bg-blue-50/50 dark:hover:bg-white/5"><Icons.Add /> Добавить станцию</RippleButton>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <RippleButton onClick={handleImport} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-white/5 rounded-2xl text-[10px] font-black text-gray-500 dark:text-gray-400"><Icons.Import /> <span className="mt-1">Импорт</span></RippleButton>
                    <RippleButton onClick={handleExport} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-white/5 rounded-2xl text-[10px] font-black text-gray-500 dark:text-gray-400"><Icons.Export /> <span className="mt-1">Экспорт</span></RippleButton>
                    <RippleButton onClick={handleReset} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-white/5 rounded-2xl text-[10px] font-black text-red-400/70 dark:text-red-900/50"><Icons.Reset /> <span className="mt-1">Сброс</span></RippleButton>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* About Modal */}
      <AnimatePresence>
        {showAboutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-[#f8faff] dark:bg-[#12141a] rounded-[3.5rem] p-10 flex flex-col border border-white/20 dark:border-white/5">
              <div className="flex flex-col items-center mb-8">
                <div className="w-20 h-20 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/30"><Logo className="w-12 h-12" /></div>
                <h3 className="text-3xl font-black dark:text-white tracking-tighter">Radio Player</h3>
                <p className="text-[11px] font-black opacity-30 dark:opacity-40 uppercase tracking-[0.4em] dark:text-white mt-1">Build {APP_VERSION}</p>
              </div>

              <div className="text-[13px] font-bold text-gray-400 dark:text-gray-500 text-center mb-8 px-6 leading-relaxed">Премиальный плеер с интеллектуальной дедупликацией при импорте.</div>
              
              <RippleButton onClick={closeAllModals} className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black shadow-2xl shadow-blue-600/20 transition-transform active:scale-95">Закрыть</RippleButton>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Import Modal */}
      <AnimatePresence>
        {showManualImport && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-white dark:bg-[#12141a] rounded-[3.5rem] p-8 flex flex-col border border-blue-50/10 dark:border-white/5">
              <h3 className="text-2xl font-black mb-2 dark:text-white text-center tracking-tighter">Ручной импорт</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-6 font-bold">Вставьте JSON-код вашего плейлиста в поле ниже</p>
              
              <textarea 
                value={manualImportValue}
                onChange={(e) => setManualImportValue(e.target.value)}
                placeholder='{ "stations": [...] }'
                className="w-full h-48 bg-blue-50/50 dark:bg-white/5 text-gray-900 dark:text-white rounded-[1.5rem] p-4 outline-none font-mono text-[10px] focus:ring-2 focus:ring-blue-500/50 transition-all mb-6 resize-none"
              />
              
              <div className="flex gap-4">
                <RippleButton onClick={closeAllModals} className="flex-1 py-4 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-2xl font-black text-sm">Отмена</RippleButton>
                <RippleButton 
                  onClick={() => processImportText(manualImportValue, true)} 
                  disabled={!manualImportValue.trim()}
                  className={`flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-600/20 ${!manualImportValue.trim() && 'opacity-50 pointer-events-none'}`}
                >
                  Импорт
                </RippleButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-white dark:bg-[#12141a] rounded-[3.5rem] p-10 shadow-none my-auto border border-blue-50/10 dark:border-white/5">
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-3xl font-black dark:text-white tracking-tighter">{editingStation ? 'Настройки' : 'Новая станция'}</h3>
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/5 shrink-0 shadow-xl shadow-black/10">
                  <StationCover station={{ name: editorName, coverUrl: editorPreviewUrl, tags: editorTags.split(',').map(t => t.trim()).filter(Boolean) } as any} className="w-full h-full" showTags={false} />
                </div>
              </div>
              <form onSubmit={addOrUpdateStation} className="flex flex-col gap-4">
                <div className="space-y-3">
                  <input name="name" required value={editorName} onChange={(e) => setEditorName(e.target.value)} placeholder="Название радио" className="w-full bg-blue-50/50 dark:bg-white/5 text-gray-900 dark:text-white rounded-[1.25rem] px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500/50 transition-all" />
                  <input name="url" type="url" required defaultValue={editingStation?.streamUrl || ''} placeholder="URL потока" className="w-full bg-blue-50/50 dark:bg-white/5 text-gray-900 dark:text-white rounded-[1.25rem] px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500/50 transition-all" />
                  <input name="coverUrl" type="url" value={editorPreviewUrl} onChange={(e) => setEditorPreviewUrl(e.target.value)} placeholder="URL обложки" className="w-full bg-blue-50/50 dark:bg-white/5 text-gray-900 dark:text-white rounded-[1.25rem] px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500/50 transition-all" />
                  <input name="tags" value={editorTags} onChange={(e) => setEditorTags(e.target.value)} placeholder="Теги (через запятую)" className="w-full bg-blue-50/50 dark:bg-white/5 text-gray-900 dark:text-white rounded-[1.25rem] px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500/50 transition-all" />
                </div>
                <div className="flex gap-4 mt-6">
                  <RippleButton type="button" onClick={closeAllModals} className="flex-1 py-4 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-2xl font-black transition-all active:scale-95">Отмена</RippleButton>
                  <RippleButton type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-600/20 transition-all active:scale-95">Сохранить</RippleButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Snackbar */}
      <AnimatePresence>
        {snackbar && (
          <motion.div initial={{ opacity: 0, y: 60, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 60, scale: 0.9 }} className="fixed bottom-12 left-8 right-8 z-[100] bg-gray-900/90 dark:bg-blue-900/95 backdrop-blur-2xl text-white px-8 py-5 rounded-[2.5rem] font-bold flex items-center justify-between shadow-2xl border border-white/10">
            <span className="truncate pr-4 tracking-tight text-sm">{snackbar}</span>
            <button onClick={() => setSnackbar(null)} className="shrink-0 text-blue-400 dark:text-blue-300 font-black uppercase text-xs tracking-widest ml-4">OK</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleep Timer Modal */}
      <AnimatePresence>
        {showSleepTimerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-white dark:bg-[#12141a] rounded-[3.5rem] p-10 border border-blue-50/10 dark:border-white/5">
              <h3 className="text-2xl font-black mb-6 dark:text-white text-center tracking-tighter">Таймер сна</h3>
              {timeRemaining && <div className="text-center font-black text-3xl text-blue-600 dark:text-blue-400 mb-8 tabular-nums">{timeRemaining}</div>}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {[15, 30, 45, 60].map(m => (
                  <RippleButton key={m} onClick={() => handleSetSleepTimer(m)} className="py-4 bg-blue-50 dark:bg-white/5 text-blue-700 dark:text-blue-300 rounded-[1.5rem] font-black text-lg">{m}м</RippleButton>
                ))}
              </div>
              <form onSubmit={handleCustomTimerSubmit} className="grid grid-cols-2 gap-3 w-full">
                <input type="number" value={customTimerInput} onChange={(e) => setCustomTimerInput(e.target.value)} placeholder="Свой" className="w-full h-14 bg-blue-50 dark:bg-white/5 text-gray-900 dark:text-white rounded-[1.5rem] px-4 outline-none font-black text-center focus:ring-2 focus:ring-blue-500/50 transition-all" />
                <RippleButton type="submit" className="w-full h-14 bg-blue-600 text-white rounded-[1.5rem] font-black shadow-xl shadow-blue-600/20">OK</RippleButton>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <AnimatePresence>
        {showConfirmModal && confirmData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative w-full max-w-sm bg-white dark:bg-[#12141a] rounded-[3.5rem] p-10 border border-red-50/10 dark:border-white/5">
              <h3 className="text-2xl font-black mb-4 dark:text-white text-center tracking-tight">Внимание</h3>
              <p className="font-bold text-gray-500 dark:text-gray-400 mb-10 text-center leading-relaxed">{confirmData.message}</p>
              <div className="flex gap-4">
                <RippleButton onClick={closeAllModals} className="flex-1 py-4 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-2xl font-black transition-all active:scale-95">Нет</RippleButton>
                <RippleButton onClick={() => { confirmData.onConfirm(); closeAllModals(); }} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black shadow-xl shadow-red-500/30 transition-all active:scale-95">Да</RippleButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
