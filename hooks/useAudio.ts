
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
  const currentLoadedUrlRef = useRef<string | null>(null);

  const playAudioRef = useRef<((overrideUrl?: string) => void) | null>(null);

  const handleAudioError = useCallback((_e?: any) => {
    if (!shouldBePlayingRef.current) return;

    if (retryCountRef.current < 3) {
      retryCountRef.current++;
      const delay = retryCountRef.current === 1 ? 1500 : retryCountRef.current === 2 ? 4000 : 8000;
      console.log(`Audio error, retrying in ${delay}ms (attempt ${retryCountRef.current})...`);
      setTimeout(() => {
        if (shouldBePlayingRef.current) {
          playAudioRef.current?.();
        }
      }, delay);
    } else {
      setStatus('error');
      shouldBePlayingRef.current = false;
      currentLoadedUrlRef.current = null;
    }
  }, []);

  const playAudio = useCallback(async (overrideUrl?: string) => {
    const urlToPlay = overrideUrl || streamUrl;
    if (!urlToPlay || !audioRef.current) {
        if (!urlToPlay) setStatus('idle');
        return;
    }

    shouldBePlayingRef.current = true;

    if (urlToPlay === currentLoadedUrlRef.current && (status === 'playing' || status === 'loading')) {
      return;
    }

    const currentVersion = ++requestVersionRef.current;
    currentLoadedUrlRef.current = urlToPlay;
    
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch (e) { console.warn("Error destroying HLS instance:", e); }
      hlsRef.current = null;
    }

    setStatus('loading');
    
    const audio = audioRef.current;
    audio.volume = volume;

    const useHls = (url: string) => {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('.m3u8');
    };

    try {
      if (useHls(urlToPlay) && typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60,
          manifestLoadingMaxRetry: 2
        });
        hlsRef.current = hls;
        hls.loadSource(urlToPlay);
        hls.attachMedia(audio);
        
        hls.on(Hls.Events.MANIFEST_PARSED, async () => {
          if (currentVersion !== requestVersionRef.current) return;
          try { await audio.play(); } catch (e: any) {
            if (e.name !== 'AbortError' && currentVersion === requestVersionRef.current) {
              handleAudioError();
            }
          }
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
        if (audio.src !== urlToPlay) {
          audio.src = urlToPlay;
        }
        
        if (currentVersion !== requestVersionRef.current) return;
        try {
          await audio.play();
        } catch (e: any) {
          if (e.name !== 'AbortError' && currentVersion === requestVersionRef.current) {
            console.error("Native Playback failed:", e);
          }
        }
      }
    } catch (err) {
      if (currentVersion === requestVersionRef.current) {
        handleAudioError();
      }
    }
  }, [streamUrl, volume, handleAudioError, status]);

  playAudioRef.current = playAudio;

  const stopAndCleanup = useCallback(() => {
    requestVersionRef.current++;
    currentLoadedUrlRef.current = null;
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch (e) { console.warn("Error destroying HLS instance:", e); }
      hlsRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "none";
      audio.crossOrigin = "anonymous";
      
      // КРИТИЧНО: Разрешаем Remote Playback
      audio.disableRemotePlayback = false;
      
      audio.onplaying = () => { setStatus('playing'); retryCountRef.current = 0; };
      audio.onpause = () => { setStatus(prev => (prev === 'loading' || shouldBePlayingRef.current) ? 'loading' : 'paused'); };
      audio.onwaiting = () => { if (shouldBePlayingRef.current) setStatus('loading'); };
      audio.onerror = handleAudioError;
      
      audioRef.current = audio;
    }

    return () => { stopAndCleanup(); };
  }, [handleAudioError, stopAndCleanup]);

  const lastEffectUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (streamUrl && streamUrl !== lastEffectUrlRef.current) {
      lastEffectUrlRef.current = streamUrl;
      if (shouldBePlayingRef.current) {
        playAudioRef.current?.(streamUrl);
      }
    } else if (!streamUrl) {
      lastEffectUrlRef.current = null;
    }
  }, [streamUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const stop = useCallback(() => {
    shouldBePlayingRef.current = false;
    stopAndCleanup();
    setStatus('paused');
  }, [stopAndCleanup]);

  const togglePlay = useCallback(() => {
    if (status === 'playing' || status === 'loading') {
      stop();
    } else {
      playAudio();
    }
  }, [status, stop, playAudio]);

  const promptCast = useCallback(async () => {
    const audio = audioRef.current;
    if (audio && (audio as any).remote) {
      try {
        // Если src пустой, браузер может проигнорировать вызов. 
        // Подставляем текущий URL если он есть.
        if (!audio.src && streamUrl) {
          audio.src = streamUrl;
        }
        await (audio as any).remote.prompt();
      } catch (e: any) {
        const isDismissed = e.name === 'NotAllowedError' || (e.message && e.message.toLowerCase().includes('dismissed'));
        if (!isDismissed) {
          console.error("Remote playback prompt failed", e);
        }
        throw e;
      }
    } else {
      throw new Error("Remote playback not supported");
    }
  }, [streamUrl]);

  const isCastSupported = useCallback(() => {
    const audio = audioRef.current;
    // Проверяем наличие API и то, что оно не отключено
    return !!(audio && (audio as any).remote && audio.disableRemotePlayback === false);
  }, []);

  return {
    status,
    volume,
    setVolume,
    togglePlay,
    play: playAudio,
    stop,
    promptCast,
    isCastSupported
  };
};
