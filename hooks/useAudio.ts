
import { useState, useRef, useEffect, useCallback } from 'react';
import { PlayerStatus } from '../types.ts';

declare const Hls: any;

export const useAudio = (streamUrl: string | null) => {
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

  const syncVolume = useCallback(() => {
    if (audioRef.current) {
        audioRef.current.volume = volume;
        audioRef.current.muted = false;
    }
  }, [volume]);

  const handleAudioError = useCallback((e?: any) => {
    if (!shouldBePlayingRef.current) return;

    const error = audioRef.current?.error;
    console.warn(`Audio playback error [${audioRef.current?.src}]:`, error?.message || 'Unknown error', e);

    if (retryCountRef.current < 5) { 
      retryCountRef.current++;
      const delay = 1000 * Math.pow(1.5, retryCountRef.current);
      console.log(`Retrying playback in ${Math.round(delay)}ms (attempt ${retryCountRef.current})...`);
      
      setTimeout(() => {
        if (shouldBePlayingRef.current) {
          playAudioInternal(currentLoadedUrlRef.current || undefined);
        }
      }, delay);
    } else {
      setStatus('error');
      shouldBePlayingRef.current = false;
      currentLoadedUrlRef.current = null;
    }
  }, []);

  const playAudioInternal = useCallback((overrideUrl?: string) => {
    const urlToPlay = overrideUrl || streamUrl;
    if (!urlToPlay || !audioRef.current) {
        if (!urlToPlay) setStatus('idle');
        return;
    }

    const currentVersion = ++requestVersionRef.current;
    shouldBePlayingRef.current = true;
    
    // UI Feedback: Immediately go to loading
    setStatus('loading');
    
    // 1. Cleanup HLS
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }

    const audio = audioRef.current;
    syncVolume();

    const isHlsUrl = (url: string) => {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('.m3u8');
    };

    if (isHlsUrl(urlToPlay) && typeof Hls !== 'undefined' && Hls.isSupported()) {
      currentLoadedUrlRef.current = urlToPlay;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        manifestLoadingMaxRetry: 3,
        xhrSetup: (xhr: any) => {
          xhr.withCredentials = false;
        }
      });
      hlsRef.current = hls;
      hls.loadSource(urlToPlay);
      hls.attachMedia(audio);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (currentVersion !== requestVersionRef.current) return;
        syncVolume();
        audio.play().catch(e => {
           if (e.name !== 'AbortError' && currentVersion === requestVersionRef.current) {
              handleAudioError(e);
           }
        });
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
      // Native Audio Path (MP3/AAC)
      // IMPORTANT: We do NOT use async/await here to keep the user gesture intact
      audio.pause();
      audio.src = urlToPlay;
      currentLoadedUrlRef.current = urlToPlay;
      audio.load(); 
      syncVolume();
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          if (e.name !== 'AbortError' && currentVersion === requestVersionRef.current) {
             console.error("Native playback failed:", e);
             handleAudioError(e);
          }
        });
      }
    }
  }, [streamUrl, handleAudioError, syncVolume]);

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
      audioRef.current.load();
    }
    setStatus('paused');
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    
    const onPlaying = () => { 
      if (shouldBePlayingRef.current) {
        setStatus('playing'); 
        retryCountRef.current = 0; 
      }
    };

    const onWaiting = () => { 
      if (shouldBePlayingRef.current) setStatus('loading'); 
    };

    const onPause = () => { 
      // Only set paused if we explicitly meant to be paused
      if (!shouldBePlayingRef.current) setStatus('paused');
    };

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
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) try { hlsRef.current.destroy(); } catch {}
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  return {
    status,
    volume,
    setVolume,
    play: playAudioInternal,
    stop: stopAndCleanup
  };
};
