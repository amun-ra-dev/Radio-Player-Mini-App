
// Build: 2.0.0
// - Feature: Full Dark Mode support synced with Telegram theme.
// - UX: Refined dark mode color palette for Material design feel.
// - Fix: Swiper and Modal styles optimized for dark backgrounds.

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
      <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} className="w-1 bg-white rounded-full shadow-sm" />
      <motion.div animate={{ height: [12, 6, 12] }} transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut", delay: 0.1 }} className="w-1 bg-white rounded-full shadow-sm" />
      <motion.div animate={{ height: [6, 10, 6] }} transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut", delay: 2 }} className="w-1 bg-white rounded-full shadow-sm" />
    </div>
  </div>
);

const StationCover: React.FC<{ station: Station | null | undefined; className?: string; showTags?: boolean }> = ({ station, className = "", showTags = true }) => {
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
          <span key={tag} className="text-[8px] font-black uppercase px-2 py-1 bg-black/50 backdrop-blur-md text-white rounded-lg border border-white/10 shadow-sm">
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
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
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
      whileDrag={{ scale: 1.02, zIndex: 100, backgroundColor: "var(--tg-theme-secondary-bg-color, #2c2c2c)", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.3)" }}
      className={`flex items-center gap-3 p-2 mb-2 rounded-[1.25rem] transition-colors group relative border-2 ${isActive ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-500/20' : 'hover:bg-gray-50 dark:hover:bg-white/5 bg-white dark:bg-[#1c1c1c] border-transparent'} cursor-grab active:cursor-grabbing`}
      onClick={() => !isDragging && onSelect()}
    >
      <div className="relative w-12 h-12 shrink-0 overflow-hidden rounded-xl shadow-sm bg-gray-100 dark:bg-[#252525] pointer-events-none">
        <StationCover station={station} className="w-full h-full" showTags={false} />
        <AnimatePresence>
          {isPlaying && (status === 'playing' || status === 'loading') && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><MiniEqualizer /></motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex-1 min-w-0 pointer-events-none">
        <p className={`font-bold text-base truncate leading-tight ${isActive ? 'text-blue-600 dark:text-blue-400' : 'dark:text-white/90'}`}>{station.name}</p>
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
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
  const originalVolumeRef = useRef<number>(0.45);
  const lastNonZeroVolumeRef = useRef<number>(0.45);
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
  useEffect(() => { if (!snackbar) return; const timer = setTimeout(() => setSnackbar(null), 3000); return () => clearTimeout(timer); }, [snackbar]);

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
        if (nextList[targetIdx]) {
            setActiveStationId(nextList[targetIdx].id);
        }
    }
  }, [onlyFavoritesMode, hapticImpact, hapticNotification, hasStations, hasFavorites, activeStationId, favorites, stations, swiperInstance]);

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
    setShowEditor(false); setShowPlaylist(false); setShowImportModal(false); setShowConfirmModal(false);
    setShowExportModal(false); setShowSleepTimerModal(false); setShowAboutModal(false); setEditingStation(null);
  }, []);

  useEffect(() => {
    const isModalOpen = showEditor || showPlaylist || showImportModal || showConfirmModal || showExportModal || showSleepTimerModal || showAboutModal;
    setBackButton(isModalOpen, closeAllModals);
  }, [showEditor, showPlaylist, showImportModal, showConfirmModal, showExportModal, showSleepTimerModal, showAboutModal, setBackButton, closeAllModals]);

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
        case 'm': case 'ь': if (volume > 0) { lastNonZeroVolumeRef.current = volume; setVolume(0); } else { setVolume(lastNonZeroVolumeRef.current || 0.45); } break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, navigateStation, setVolume, volume]);

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

  const handleExport = (type: 'all' | 'favorites') => {
    const list = type === 'all' ? stations : stations.filter(s => favorites.includes(s.id));
    if (type === 'favorites' && list.length === 0) { hapticNotification('warning'); setSnackbar('Нет избранного для экспорта'); return; }
    const json = list.map(s => ({ id: s.id, name: s.name, url: s.streamUrl, coverUrl: s.coverUrl, tags: s.tags }));
    const text = `🤖 @mdsradibot Station List:\n\n\`\`\`json\n${JSON.stringify(json, null, 2)}\n\`\`\``;
    navigator.clipboard.writeText(text).then(() => { hapticNotification('success'); setSnackbar(`Список скопирован!`); }).catch(() => { hapticNotification('error'); setSnackbar('Ошибка копирования'); });
    setShowExportModal(false);
  };

  const processImportText = (text: string) => {
    try {
      let jsonStr = text.trim();
      const start = text.indexOf('['); const end = text.lastIndexOf(']');
      if (start !== -1 && end !== -1) jsonStr = text.substring(start, end + 1);
      const parsed = JSON.parse(jsonStr);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const normalized = list.filter((s: any) => s.name && (s.url || s.streamUrl)).map((s: any) => ({
        id: s.id || Math.random().toString(36).substr(2, 9),
        name: s.name, streamUrl: s.url || s.streamUrl, coverUrl: s.coverUrl || '', tags: s.tags || [], addedAt: Date.now()
      }));
      if (normalized.length === 0) { setSnackbar('Нет станций'); return; }
      setStations(prev => {
        const existingUrls = new Set(prev.map(s => s.streamUrl));
        const unique = normalized.filter(s => !existingUrls.has(s.streamUrl));
        if (unique.length === 0) { setSnackbar('Станции уже есть'); return prev; }
        hapticNotification('success'); setSnackbar(`Добавлено: ${unique.length}`);
        return [...prev, ...unique];
      });
      setShowImportModal(false);
    } catch (e) { hapticNotification('error'); setSnackbar('Ошибка формата'); }
  };

  const handleImport = async () => {
    try { const text = await navigator.clipboard.readText(); if (text && (text.includes('[') || text.includes('{'))) processImportText(text); else setShowImportModal(true); } catch (e) { setShowImportModal(true); }
  };

  const handleReset = () => {
    setConfirmData({ message: 'Очистить весь плейлист?', onConfirm: () => { setStations([]); setFavorites([]); setOnlyFavoritesMode(false); setActiveStationId(''); setPlayingStationId(''); stop(); hapticImpact('heavy'); setSnackbar('Плейлист очищен'); } });
    setShowConfirmModal(true);
  };

  const handleDemo = () => {
    setConfirmData({
      message: 'Добавить стандартный список станций?',
      onConfirm: () => {
        setStations(DEFAULT_STATIONS);
        if (DEFAULT_STATIONS.length > 0) { setActiveStationId(DEFAULT_STATIONS[0].id); setPlayingStationId(DEFAULT_STATIONS[0].id); }
        setSnackbar(`Добавлено станций: ${DEFAULT_STATIONS.length}`); hapticNotification('success');
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

  useEffect(() => { if (showEditor) { setEditorPreviewUrl(editingStation?.coverUrl || ''); setEditorName(editingStation?.name || ''); setEditorTags(editingStation?.tags?.join(', ') || ''); } }, [showEditor, editingStation]);

  const canPlay = Boolean(activeStation?.streamUrl);

  return (
    <div className="flex flex-col overflow-hidden text-[#222222] dark:text-white bg-[#f5f5f5] dark:bg-[#121212]" style={{ height: 'var(--tg-viewport-height, 100vh)' }}>
      {/* Header (Head) */}
      <div className="flex items-center justify-between px-6 bg-white dark:bg-[#1f1f1f] shadow-md z-10 shrink-0 border-b border-gray-100 dark:border-gray-800" style={{ paddingTop: isMobile ? 'calc(var(--tg-safe-top, 0px) + 46px)' : 'calc(var(--tg-safe-top, 0px) + 16px)', paddingBottom: '12px' }}>
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

      <main className="flex-1 flex flex-col items-center justify-around py-4 overflow-hidden relative">
        {/* Carousel (Карусель) */}
        <div className="relative w-[340px] aspect-square shrink-0">
          {hasStations ? (
            <Swiper
              onSwiper={setSwiperInstance}
              onSlideChange={(swiper) => {
                if (isReorderingRef.current) return;
                const targetStation = displayedStations[swiper.realIndex];
                if (targetStation) {
                    setActiveStationId(targetStation.id);
                    if (status === 'playing' || status === 'loading') {
                        setPlayingStationId(targetStation.id);
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
                prev: {
                  translate: ['-120%', 0, 0],
                  rotate: [0, 0, -20],
                  opacity: 0,
                },
                next: {
                  translate: ['12px', 0, -100],
                  scale: 0.9,
                  opacity: 0.6,
                },
              }}
              modules={[EffectCreative, Keyboard]}
              keyboard={{ enabled: true }}
              className="mySwiper w-full h-full !overflow-visible"
            >
              {displayedStations.map((station) => (
                <SwiperSlide key={station.id} className="w-full h-full flex justify-center">
                  <div className={`relative w-full aspect-square rounded-[2.5rem] shadow-2xl dark:shadow-black/60 overflow-hidden bg-white dark:bg-[#1c1c1c] ${canPlay ? 'cursor-pointer' : 'cursor-default'}`} onClick={() => canPlay && handleTogglePlay()}>
                    <StationCover station={station} className="w-full h-full" />
                    <div className="absolute bottom-6 right-6 z-20" onClick={(e) => { e.stopPropagation(); toggleFavorite(station.id, e); }}>
                      <RippleButton className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${favorites.includes(station.id) ? 'bg-amber-500 text-white scale-105' : 'bg-black/30 text-white/60 hover:bg-black/40'}`}>
                        {favorites.includes(station.id) ? <Icons.Star /> : <Icons.StarOutline />}
                      </RippleButton>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          ) : (
            <div className="w-full h-full">
              <div className="w-full aspect-square mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl bg-[#1a4ab2] flex flex-col items-center justify-center text-center p-8">
                <h2 className="text-white text-3xl font-black mb-2">Нет станций</h2>
                <p className="text-white/80 text-sm font-bold mb-8">Добавьте первую станцию в плейлист</p>
                <div className="flex flex-col gap-4 w-full">
                  <RippleButton onClick={() => { setEditingStation(null); setShowEditor(true); }} className="w-full py-4 bg-[#2f6ff7] hover:bg-[#4a84ff] text-white rounded-2xl font-black shadow-lg shadow-blue-900/40">Добавить станцию</RippleButton>
                  <div className="grid grid-cols-2 gap-3">
                    <RippleButton onClick={handleImport} className="py-4 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-black">Импорт JSON</RippleButton>
                    <RippleButton onClick={handleDemo} className="py-4 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-black">Демо</RippleButton>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info & Controls Area */}
        <div className="w-full">
          <motion.div className="max-w-[360px] w-full flex flex-col items-center mx-auto" drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(_, info) => info.offset.y < -50 && setShowPlaylist(true)}>
            <div className="w-full flex flex-col items-center gap-6 py-4 px-6">
              
              <div className="text-center w-full px-4 min-h-[60px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  <motion.div key={activeStation?.id || 'none'} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
                    <h2 className="text-3xl font-black mb-1 truncate leading-tight dark:text-white">{activeStation?.name || 'Пусто'}</h2>
                    <p className="text-[10px] opacity-40 dark:opacity-60 uppercase tracking-[0.2em] font-black dark:text-white/80">
                        {!activeStation ? 'Выберите источник' : 
                         (playingStationId === activeStationId && status === 'playing' ? 'В эфире' : 
                          playingStationId === activeStationId && status === 'loading' ? 'Загрузка...' : 
                          'Пауза')}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="w-full max-w-[300px] flex flex-col gap-3">
                <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-[#2c2c2c] rounded-full appearance-none accent-blue-600" disabled={!canPlay} />
              </div>

              <div className="w-full max-w-[360px] flex items-center justify-around mt-2">
                <RippleButton onClick={() => navigateStation('prev')} className={`p-5 transition-all ${displayedStations.length > 1 ? 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 active:scale-90' : 'text-gray-300 dark:text-gray-700 opacity-20 pointer-events-none'}`}><Icons.Prev /></RippleButton>
                <RippleButton onClick={() => canPlay && handleTogglePlay()} className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${canPlay ? 'bg-blue-600 text-white shadow-blue-600/30 dark:shadow-blue-500/10' : 'bg-gray-200 dark:bg-[#2c2c2c] text-gray-400 dark:text-gray-600'}`} disabled={!canPlay}>
                    {(playingStationId === activeStationId) && (status === 'playing' || status === 'loading') ? <Icons.Pause /> : <Icons.Play />}
                </RippleButton>
                <RippleButton onClick={() => navigateStation('next')} className={`p-5 transition-all ${displayedStations.length > 1 ? 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 active:scale-90' : 'text-gray-300 dark:text-gray-700 opacity-20 pointer-events-none'}`}><Icons.Next /></RippleButton>
              </div>

            </div>
            
            <div className="flex flex-col items-center gap-2 pt-2 text-gray-300 dark:text-gray-700 cursor-grab opacity-50 hover:opacity-100 transition-opacity w-full">
              <div className="w-10 h-1 rounded-full bg-current mx-auto" />
              <span className="text-[9px] uppercase font-bold tracking-widest text-center">Плейлист</span>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Modals and other UI components */}
      <AnimatePresence>
        {showPlaylist && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-30 backdrop-blur-sm" onClick={closeAllModals} />
            <motion.div drag="y" dragListener={false} dragControls={dragControls} dragDirectionLock dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 1 }} dragMomentum={false} onDragEnd={(_, info) => (info.offset.y > 100 || info.velocity.y > 500) && setShowPlaylist(false)} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }} className="fixed bottom-0 left-0 right-0 h-[88vh] bg-white dark:bg-[#181818] rounded-t-[3rem] z-40 flex flex-col shadow-2xl overflow-hidden pb-10">
              <div className="w-full flex flex-col items-center pt-5 pb-2 shrink-0 touch-none cursor-grab active:cursor-grabbing" onPointerDown={(e) => dragControls.start(e)}><div className="w-16 h-1.5 bg-gray-200 dark:bg-[#333] rounded-full mb-3" /></div>
              <div className="px-4 pb-2">
                <div className="flex items-center bg-gray-100 dark:bg-[#252525] rounded-2xl p-1">
                  <button onClick={() => setPlaylistFilter('all')} className={`flex-1 py-2 text-sm font-black rounded-[0.8rem] transition-all ${playlistFilter === 'all' ? 'bg-white dark:bg-[#333] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Все</button>
                  <button onClick={() => setPlaylistFilter('favorites')} className={`flex-1 py-2 text-sm font-black rounded-[0.8rem] transition-all ${playlistFilter === 'favorites' ? 'bg-white dark:bg-[#333] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Избранное</button>
                </div>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto px-4 flex flex-col overscroll-contain" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                {stationsInPlaylist.length > 0 ? (
                  <ReorderGroup axis="y" values={stationsInPlaylist} onReorder={handleReorder} className="space-y-1">
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
                ) : <div className="flex-1 flex flex-col items-center justify-center text-center p-8"><h3 className="text-lg font-black text-gray-400 dark:text-gray-600">{playlistFilter === 'favorites' ? 'Нет избранных' : 'Плейлист пуст'}</h3></div>}
                <div className="mt-6 flex flex-col gap-4 mb-safe">
                  <RippleButton onClick={() => { setEditingStation(null); setShowEditor(true); setShowPlaylist(false); }} className="w-full p-5 rounded-[1.5rem] border-2 border-dashed border-gray-200 dark:border-[#333] text-gray-400 dark:text-gray-600 font-black flex items-center justify-center gap-2"><Icons.Add /> Добавить станцию</RippleButton>
                  <div className="grid grid-cols-3 gap-3">
                    <RippleButton onClick={handleImport} className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-[#252525] rounded-2xl text-[10px] font-black text-gray-500 dark:text-gray-400"><Icons.Import /> <span className="mt-1">Импорт</span></RippleButton>
                    <RippleButton onClick={() => setShowExportModal(true)} className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-[#252525] rounded-2xl text-[10px] font-black text-gray-500 dark:text-gray-400"><Icons.Export /> <span className="mt-1">Экспорт</span></RippleButton>
                    <RippleButton onClick={handleReset} className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-[#252525] rounded-2xl text-[10px] font-black text-red-400/70 dark:text-red-900/50"><Icons.Reset /> <span className="mt-1">Очистить</span></RippleButton>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#1f1f1f] rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg mb-6"><Logo className="w-10 h-10" /></div>
              <h3 className="text-xl font-black mb-1 dark:text-white">Radio Player</h3>
              <p className="text-[10px] font-black opacity-30 dark:opacity-50 uppercase tracking-[0.3em] mb-6 dark:text-white">Build 2.0.0</p>
              <div className="text-sm font-bold text-gray-500 dark:text-gray-400 text-center mb-8">Стильный и мощный плеер для Telegram. Поддержка HLS, AAC, MP3 и экспорт плейлистов.</div>
              <RippleButton onClick={closeAllModals} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/20">Понятно</RippleButton>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#1f1f1f] rounded-[2.5rem] p-8 shadow-2xl my-auto">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-black dark:text-white">{editingStation ? 'Настройки' : 'Новая станция'}</h3>
                <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg bg-gray-100 dark:bg-[#252525] shrink-0">
                  <StationCover station={{ name: editorName, coverUrl: editorPreviewUrl, tags: editorTags.split(',').map(t => t.trim()).filter(Boolean) } as any} className="w-full h-full" showTags={false} />
                </div>
              </div>
              <form onSubmit={addOrUpdateStation} className="flex flex-col gap-4">
                <input name="name" required value={editorName} onChange={(e) => setEditorName(e.target.value)} placeholder="Название станции" className="w-full bg-gray-100 dark:bg-[#252525] text-gray-900 dark:text-white rounded-xl px-4 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" />
                <input name="url" type="url" required defaultValue={editingStation?.streamUrl || ''} placeholder="URL потока (mp3, aac, m3u8)" className="w-full bg-gray-100 dark:bg-[#252525] text-gray-900 dark:text-white rounded-xl px-4 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" />
                <input name="coverUrl" type="url" value={editorPreviewUrl} onChange={(e) => setEditorPreviewUrl(e.target.value)} placeholder="URL обложки (картинка)" className="w-full bg-gray-100 dark:bg-[#252525] text-gray-900 dark:text-white rounded-xl px-4 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" />
                <input name="tags" value={editorTags} onChange={(e) => setEditorTags(e.target.value)} placeholder="Теги (рок, чилл, 90-е...)" className="w-full bg-gray-100 dark:bg-[#252525] text-gray-900 dark:text-white rounded-xl px-4 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" />
                <div className="flex gap-3 mt-4">
                  <RippleButton type="button" onClick={closeAllModals} className="flex-1 py-4 bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-400 rounded-2xl font-black">Отмена</RippleButton>
                  <RippleButton type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/20">Сохранить</RippleButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSleepTimerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#1f1f1f] rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-2xl font-black mb-4 dark:text-white">Таймер сна</h3>
              {timeRemaining && <div className="text-center font-black text-2xl text-blue-600 dark:text-blue-400 mb-6">{timeRemaining}</div>}
              <div className="grid grid-cols-2 gap-2 mb-6">{[15, 30, 45, 60].map(m => <RippleButton key={m} onClick={() => handleSetSleepTimer(m)} className="py-3 bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 rounded-xl font-bold">{m} мин</RippleButton>)}</div>
              <form onSubmit={handleCustomTimerSubmit} className="grid grid-cols-2 gap-2 w-full">
                <input type="number" value={customTimerInput} onChange={(e) => setCustomTimerInput(e.target.value)} placeholder="Мин" className="w-full h-12 bg-gray-100 dark:bg-[#252525] text-gray-900 dark:text-white rounded-xl px-4 outline-none font-bold text-center focus:ring-2 focus:ring-blue-500/50 transition-all" />
                <RippleButton type="submit" className="w-full h-12 bg-blue-600 text-white rounded-xl font-black flex items-center justify-center shadow-lg shadow-blue-600/20">OK</RippleButton>
              </form>
              {sleepTimerEndDate && <RippleButton onClick={() => handleSetSleepTimer(0)} className="w-full mt-4 h-12 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl font-black flex items-center justify-center">Сбросить</RippleButton>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#1f1f1f] rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-2xl font-black mb-6 dark:text-white">Экспорт JSON</h3>
              <div className="flex flex-col gap-3">
                <RippleButton onClick={() => handleExport('all')} className="w-full py-4 bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 rounded-2xl font-bold">Весь список</RippleButton>
                <RippleButton onClick={() => handleExport('favorites')} className="w-full py-4 bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 rounded-2xl font-bold">Только избранное</RippleButton>
                <RippleButton onClick={closeAllModals} className="w-full py-3 text-gray-400 dark:text-gray-600 font-bold">Закрыть</RippleButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#1f1f1f] rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-2xl font-black mb-6 dark:text-white">Импорт</h3>
              <form onSubmit={(e) => { e.preventDefault(); const t = new FormData(e.currentTarget).get('t') as string; processImportText(t); }} className="flex flex-col gap-4">
                <textarea name="t" required placeholder="Вставьте JSON здесь..." className="w-full bg-gray-100 dark:bg-[#252525] text-gray-900 dark:text-white rounded-xl px-4 py-3 outline-none font-bold h-32 resize-none text-sm placeholder:text-gray-400 dark:placeholder:text-gray-600" />
                <div className="flex gap-2">
                  <RippleButton type="button" onClick={closeAllModals} className="flex-1 py-4 bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-400 rounded-2xl font-black">Отмена</RippleButton>
                  <RippleButton type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/20">Импорт</RippleButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirmModal && confirmData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeAllModals} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#1f1f1f] rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-xl font-black mb-4 dark:text-white">Подтверждение</h3>
              <p className="font-bold text-gray-500 dark:text-gray-400 mb-8">{confirmData.message}</p>
              <div className="flex gap-3">
                <RippleButton onClick={closeAllModals} className="flex-1 py-4 bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-400 rounded-2xl font-black">Нет</RippleButton>
                <RippleButton onClick={() => { confirmData.onConfirm(); closeAllModals(); }} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black shadow-lg shadow-red-500/20">Да</RippleButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {snackbar && (
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.9 }} className="fixed bottom-10 left-6 right-6 z-50 bg-gray-900/90 dark:bg-[#333]/95 backdrop-blur-xl text-white px-6 py-4 rounded-[1.5rem] font-bold flex items-center justify-between shadow-2xl">
            <span className="truncate pr-4">{snackbar}</span>
            <button onClick={() => setSnackbar(null)} className="shrink-0 text-blue-400 dark:text-blue-300 font-black uppercase text-xs">OK</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
