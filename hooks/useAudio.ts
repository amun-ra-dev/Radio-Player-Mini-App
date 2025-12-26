
import { useState, useRef, useEffect, useCallback } from 'react';
import { PlayerStatus } from '../types.ts';

declare const Hls: any;

export const useAudio = (streamUrl: string | null) => {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [volume, setVolume] = useState(0.5);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const shouldBePlayingRef = useRef(false);
  
  const requestVersionRef = useRef(0);
  const playPromiseRef = useRef<Promise<void> | null>(null);
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

    // If it's a "flicker" error (status resetting too fast), we might want to delay retry
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

  const stopAndCleanup = useCallback(async () => {
    shouldBePlayingRef.current = false;
    requestVersionRef.current++;
    currentLoadedUrlRef.current = null;
    
    // If a play promise is pending, we should wait or handle it
    if (playPromiseRef.current) {
      try { await playPromiseRef.current; } catch {}
      playPromiseRef.current = null;
    }

    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch (e) { console.warn("Error destroying HLS instance:", e); }
      hlsRef.current = null;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
    }
    setStatus('paused');
  }, []);

  const playAudioInternal = useCallback(async (overrideUrl?: string) => {
    const urlToPlay = overrideUrl || streamUrl;
    if (!urlToPlay || !audioRef.current) {
        if (!urlToPlay) setStatus('idle');
        return;
    }

    // Prepare for new play request
    shouldBePlayingRef.current = true;
    const currentVersion = ++requestVersionRef.current;
    
    // Reset status UI immediately to prevent "flicker"
    setStatus('loading');
    
    // Cleanup previous HLS instances
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

    try {
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
          const p = audio.play();
          playPromiseRef.current = p;
          p.catch(e => {
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
        // Native path (MP3/AAC)
        // Resetting src is essential for live streams to jump to the edge
        audio.pause();
        audio.src = urlToPlay;
        currentLoadedUrlRef.current = urlToPlay;
        audio.load(); 
        
        if (currentVersion !== requestVersionRef.current) return;
        
        syncVolume();
        const p = audio.play();
        playPromiseRef.current = p;
        try {
          await p;
        } catch (e: any) {
          if (e.name !== 'AbortError' && currentVersion === requestVersionRef.current) {
             console.error("Native playback failed:", e);
             handleAudioError(e);
          }
        }
      }
    } catch (err) {
      if (currentVersion === requestVersionRef.current) {
        handleAudioError(err);
      }
    }
  }, [streamUrl, handleAudioError, syncVolume]);

  // Master Setup for Audio Element Events
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
      if (!shouldBePlayingRef.current) setStatus('paused');
    };

    const onCanPlay = () => {
      // For some browsers, we might need a push here
      if (shouldBePlayingRef.current && status === 'loading') {
        // Optional: audio.play() if not already trying
      }
    };

    const onError = (e: any) => handleAudioError(e);

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);
    
    return () => { 
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
    };
  }, [handleAudioError]);

  // Clean exit on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) try { hlsRef.current.destroy(); } catch {}
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // Update volume when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const stop = useCallback(() => {
    stopAndCleanup();
  }, [stopAndCleanup]);

  return {
    status,
    volume,
    setVolume,
    play: playAudioInternal,
    stop
  };
};
