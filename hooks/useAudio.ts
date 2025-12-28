
import { useState, useRef, useEffect, useCallback } from 'react';
import { PlayerStatus, Station } from '../types.ts';

declare const Hls: any;

export const useAudio = (currentStation: Station | null) => {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('radio_volume');
    return saved !== null ? parseFloat(saved) : 0.5;
  });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const shouldBePlayingRef = useRef(false);
  
  const requestVersionRef = useRef(0);
  const currentLoadedUrlRef = useRef<string | null>(null);

  // Синхронизация метаданных с ОС
  const updateMediaSession = useCallback(() => {
    if (!currentStation || !('mediaSession' in navigator)) return;

    const metadata = {
      title: currentStation.name,
      artist: 'Radio Player',
      album: currentStation.tags?.join(', ') || '',
      artwork: [
        { src: currentStation.coverUrl || '', sizes: '512x512', type: 'image/jpeg' }
      ]
    };

    navigator.mediaSession.metadata = new window.MediaMetadata(metadata);
  }, [currentStation]);

  const syncVolume = useCallback(() => {
    if (audioRef.current) {
        audioRef.current.volume = volume;
        audioRef.current.muted = false;
    }
  }, [volume]);

  const handleAudioError = useCallback((e?: any) => {
    if (!shouldBePlayingRef.current) return;

    const error = audioRef.current?.error;
    console.warn(`Audio playback error:`, error?.message || 'Unknown error', e);

    if (retryCountRef.current < 5) { 
      retryCountRef.current++;
      const delay = 1000 * Math.pow(1.5, retryCountRef.current);
      setTimeout(() => {
        if (shouldBePlayingRef.current) {
          playAudioInternal(currentLoadedUrlRef.current || undefined);
        }
      }, delay);
    } else {
      setStatus('error');
      shouldBePlayingRef.current = false;
    }
  }, []);

  const playAudioInternal = useCallback((overrideUrl?: string) => {
    const urlToPlay = overrideUrl || currentStation?.streamUrl;
    if (!urlToPlay || !audioRef.current) {
        if (!urlToPlay) setStatus('idle');
        return;
    }

    const currentVersion = ++requestVersionRef.current;
    shouldBePlayingRef.current = true;
    setStatus('loading');
    
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }

    const audio = audioRef.current;
    syncVolume();
    updateMediaSession();

    const isHlsUrl = (url: string) => url.toLowerCase().includes('.m3u8');

    if (isHlsUrl(urlToPlay) && typeof Hls !== 'undefined' && Hls.isSupported()) {
      currentLoadedUrlRef.current = urlToPlay;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingMaxRetry: 3
      });
      hlsRef.current = hls;
      hls.loadSource(urlToPlay);
      hls.attachMedia(audio);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (currentVersion !== requestVersionRef.current) return;
        audio.play().catch(handleAudioError);
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (currentVersion !== requestVersionRef.current) return;
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
            case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
            default: handleAudioError(); break;
          }
        }
      });
    } else {
      audio.src = urlToPlay;
      currentLoadedUrlRef.current = urlToPlay;
      audio.load(); 
      syncVolume();
      audio.play().catch(handleAudioError);
    }
  }, [currentStation, handleAudioError, syncVolume, updateMediaSession]);

  const stopAndCleanup = useCallback(() => {
    shouldBePlayingRef.current = false;
    requestVersionRef.current++;
    currentLoadedUrlRef.current = null;
    
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setStatus('paused');
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;
    
    const onPlaying = () => { 
      if (shouldBePlayingRef.current) {
        setStatus('playing'); 
        retryCountRef.current = 0; 
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      }
    };

    const onPause = () => { if (!shouldBePlayingRef.current) setStatus('paused'); };
    const onWaiting = () => { if (shouldBePlayingRef.current) setStatus('loading'); };
    const onError = (e: any) => handleAudioError(e);

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
  }, [handleAudioError]);

  useEffect(() => {
    localStorage.setItem('radio_volume', volume.toString());
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Настройка системных кнопок управления
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const actionHandlers: [MediaSessionAction, () => void][] = [
      ['play', () => playAudioInternal()],
      ['pause', () => stopAndCleanup()],
      ['stop', () => stopAndCleanup()],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        console.warn(`The media session action "${action}" is not supported yet.`);
      }
    }

    return () => {
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {}
      }
    };
  }, [playAudioInternal, stopAndCleanup]);

  return {
    status,
    volume,
    setVolume,
    play: playAudioInternal,
    stop: stopAndCleanup
  };
};
