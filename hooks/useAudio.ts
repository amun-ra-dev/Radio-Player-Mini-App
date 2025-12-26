
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

  const handleAudioError = useCallback((e?: any) => {
    if (!shouldBePlayingRef.current) return;

    const error = audioRef.current?.error;
    console.warn(`Audio playback error [${audioRef.current?.src}]:`, error?.message || 'Unknown error', e);

    if (retryCountRef.current < 3) {
      retryCountRef.current++;
      const delay = retryCountRef.current === 1 ? 1500 : retryCountRef.current === 2 ? 4000 : 8000;
      console.log(`Retrying playback in ${delay}ms (attempt ${retryCountRef.current})...`);
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

    // We only skip if the URL is the SAME and it is already PLAYING.
    if (urlToPlay === currentLoadedUrlRef.current && status === 'playing') {
      return;
    }

    const currentVersion = ++requestVersionRef.current;
    
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch (e) { console.warn("Error destroying HLS instance:", e); }
      hlsRef.current = null;
    }

    setStatus('loading');
    
    const audio = audioRef.current;
    audio.volume = volume;

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
          manifestLoadingMaxRetry: 2,
          xhrSetup: (xhr: any) => {
            xhr.withCredentials = false;
          }
        });
        hlsRef.current = hls;
        hls.loadSource(urlToPlay);
        hls.attachMedia(audio);
        
        hls.on(Hls.Events.MANIFEST_PARSED, async () => {
          if (currentVersion !== requestVersionRef.current) return;
          try { 
            await audio.play(); 
          } catch (e: any) {
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
        // Native path (MP3/AAC streams or iOS native HLS)
        if (urlToPlay !== currentLoadedUrlRef.current) {
            audio.pause();
            audio.src = urlToPlay;
            currentLoadedUrlRef.current = urlToPlay;
            // Removed load() here to prevent interrupting the connection phase
        }
        
        if (currentVersion !== requestVersionRef.current) return;
        
        try {
          await audio.play();
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
      audio.preload = "auto";
      
      const onStartPlaying = () => { 
        setStatus('playing'); 
        retryCountRef.current = 0; 
      };

      audio.onplaying = onStartPlaying;
      audio.oncanplay = () => {
        if (shouldBePlayingRef.current && status === 'loading') {
          onStartPlaying();
        }
      };

      audio.onpause = () => { 
        if (!shouldBePlayingRef.current) setStatus('paused');
      };
      
      audio.onwaiting = () => { 
        if (shouldBePlayingRef.current) setStatus('loading'); 
      };
      
      audio.onerror = (e) => handleAudioError(e);
      
      audio.onstalled = () => {
        if (shouldBePlayingRef.current && status === 'playing') {
           console.log("Stream stalled, trying to buffer...");
           setStatus('loading');
        }
      };
      
      audioRef.current = audio;
    }

    return () => { stopAndCleanup(); };
  }, [handleAudioError, stopAndCleanup, status]);

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

  return {
    status,
    volume,
    setVolume,
    togglePlay,
    play: playAudio,
    stop
  };
};
