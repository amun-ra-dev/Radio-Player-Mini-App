
import { useState, useRef, useEffect, useCallback } from 'react';
import { PlayerStatus, Station } from '../types.ts';

declare const Hls: any;

export const useAudio = (
  currentStation: Station | null,
  onNext?: () => void,
  onPrev?: () => void
) => {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('radio_volume');
    return saved !== null ? parseFloat(saved) : 0.5;
  });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const shouldBePlayingRef = useRef(false);
  const currentLoadedUrlRef = useRef<string | null>(null);
  const requestVersionRef = useRef(0);

  // Синхронизация метаданных с системным плеером ОС
  const updateMediaSession = useCallback((station: Station) => {
    if (!station || !('mediaSession' in navigator)) return;

    const metadata = {
      title: station.name,
      artist: 'Radio Player',
      album: station.tags?.join(', ') || 'Интернет Радио',
      artwork: [
        { src: station.coverUrl || '', sizes: '512x512', type: 'image/jpeg' }
      ]
    };

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata(metadata);
    } catch (e) {
      console.error('MediaSession Metadata error:', e);
    }
  }, []);

  const stopAndCleanup = useCallback(() => {
    shouldBePlayingRef.current = false;
    requestVersionRef.current++;
    currentLoadedUrlRef.current = null;
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    if (audioRef.current) {
      const audio = audioRef.current;
      audio.pause();
      audio.removeAttribute('src'); 
      audio.load(); // Принудительно сбрасываем буфер
    }
    
    setStatus('paused');
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }, []);

  const playAudioInternal = useCallback((overrideUrl?: string, stationInfo?: Station) => {
    const targetStation = stationInfo || currentStation;
    const urlToPlay = overrideUrl || targetStation?.streamUrl;
    
    if (!urlToPlay || !audioRef.current) {
        if (!urlToPlay) setStatus('idle');
        return;
    }

    // Принудительно очищаем старый поток ПЕРЕД запуском нового
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }

    const currentVersion = ++requestVersionRef.current;
    shouldBePlayingRef.current = true;
    setStatus('loading');
    
    const audio = audioRef.current;
    audio.volume = volume;
    audio.muted = false;
    
    if (targetStation) updateMediaSession(targetStation);

    const isHlsUrl = (url: string) => url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('playlist');

    const handlePlayError = (e: any) => {
      if (currentVersion !== requestVersionRef.current) return;
      console.warn('Playback error:', e);
      setStatus('error');
    };

    if (isHlsUrl(urlToPlay) && typeof Hls !== 'undefined' && Hls.isSupported()) {
      currentLoadedUrlRef.current = urlToPlay;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        liveDurationInfinity: true,
        manifestLoadingMaxRetry: 5,
        levelLoadingMaxRetry: 5
      });
      hlsRef.current = hls;
      hls.loadSource(urlToPlay);
      hls.attachMedia(audio);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (currentVersion !== requestVersionRef.current) return;
        audio.play().catch(handlePlayError);
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (currentVersion !== requestVersionRef.current) return;
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              stopAndCleanup();
              setStatus('error');
              break;
          }
        }
      });
    } else {
      audio.src = urlToPlay;
      currentLoadedUrlRef.current = urlToPlay;
      audio.play().catch(handlePlayError);
    }
  }, [currentStation, volume, updateMediaSession, stopAndCleanup]);

  // Обработка системных событий аудио-элемента
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
    }

    const audio = audioRef.current;
    
    const onPlaying = () => { 
      if (shouldBePlayingRef.current) {
        setStatus('playing'); 
        retryCountRef.current = 0; 
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      }
    };

    const onPause = () => { 
      if (!shouldBePlayingRef.current) {
        setStatus('paused');
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      }
    };

    const onWaiting = () => { 
      if (shouldBePlayingRef.current) setStatus('loading'); 
    };

    const onError = () => {
      if (!shouldBePlayingRef.current) return;
      setStatus('error');
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('error', onError);
    
    return () => { 
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('error', onError);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('radio_volume', volume.toString());
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Системные кнопки управления (Lock Screen)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const actionHandlers: [MediaSessionAction, (() => void) | null][] = [
      ['play', () => playAudioInternal()],
      ['pause', () => stopAndCleanup()],
      ['stop', () => stopAndCleanup()],
      ['nexttrack', onNext || null],
      ['previoustrack', onPrev || null],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        console.warn(`Media session action "${action}" not supported.`);
      }
    }
  }, [playAudioInternal, stopAndCleanup, onNext, onPrev]);

  return {
    status,
    volume,
    setVolume,
    play: playAudioInternal,
    stop: stopAndCleanup
  };
};
