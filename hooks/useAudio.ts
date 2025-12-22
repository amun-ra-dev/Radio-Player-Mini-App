
import { useState, useRef, useEffect, useCallback } from 'react';
import { PlayerStatus } from '../types.ts';

declare const Hls: any;

export const useAudio = (streamUrl: string | null) => {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [volume, setVolume] = useState(0.45);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const shouldBePlayingRef = useRef(false);
  
  const requestVersionRef = useRef(0);

  const playAudioRef = useRef<(() => void) | null>(null);

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
    }
  }, []);

  const playAudio = useCallback(async (overrideUrl?: string) => {
    const urlToPlay = overrideUrl || streamUrl;
    if (!urlToPlay || !audioRef.current) return;

    const currentVersion = ++requestVersionRef.current;
    
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch (e) { console.warn("Error destroying HLS instance:", e); }
      hlsRef.current = null;
    }

    setStatus('loading');
    shouldBePlayingRef.current = true;
    
    const audio = audioRef.current;
    audio.volume = volume;

    const useHls = (url: string) => {
        const lowerUrl = url.toLowerCase();
        // HLS should be used specifically for .m3u8 playlists.
        if (lowerUrl.includes('.m3u8')) return true;

        // Standard direct audio files (MP3, AAC, OGG, etc.) or raw streams identified by extension
        // are best handled by the browser's native audio engine.
        // Hls.js expects fragmented streams (TS or fMP4).
        const isStandardAudioFile = /\.(mp3|aac|ogg|wav|m4a|flac)$/.test(lowerUrl);
        if (isStandardAudioFile) return false;

        // If no common extension, assume it's a raw radio stream (Icecast/Shoutcast)
        // and try native playback first unless specified otherwise.
        return false;
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
              console.error("HLS Playback failed:", e);
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
        // For native playback (MP3/AAC streams)
        audio.src = urlToPlay;
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
        console.error("PlayAudio global catch:", err);
        handleAudioError();
      }
    }
  }, [streamUrl, volume, handleAudioError]);

  playAudioRef.current = playAudio;

  const stopAndCleanup = useCallback(() => {
    requestVersionRef.current++;
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
      audio.crossOrigin = "anonymous";
      
      audio.onplaying = () => { setStatus('playing'); retryCountRef.current = 0; };
      audio.onpause = () => { setStatus(prev => prev === 'loading' ? 'loading' : 'paused'); };
      audio.onwaiting = () => { if (shouldBePlayingRef.current) setStatus('loading'); };
      audio.onerror = handleAudioError;
      
      audioRef.current = audio;
    }

    return () => { stopAndCleanup(); };
  }, [handleAudioError, stopAndCleanup]);

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;

    if (status === 'playing' || status === 'loading') {
      shouldBePlayingRef.current = false;
      requestVersionRef.current++;
      audioRef.current.pause();
      setStatus('paused');
    } else {
      shouldBePlayingRef.current = true;
      if (audioRef.current.src && status !== 'error' && status !== 'idle') {
        try {
          await audioRef.current.play();
        } catch (e: any) {
          if (e.name !== 'AbortError') {
            playAudioRef.current?.();
          }
        }
      } else {
        playAudioRef.current?.();
      }
    }
  }, [status]);

  useEffect(() => {
    if (streamUrl) {
      if (shouldBePlayingRef.current) {
        playAudioRef.current?.();
      } else {
        setStatus('idle');
      }
    }
  }, [streamUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return {
    status,
    volume,
    setVolume,
    togglePlay,
    play: playAudio,
    stop: () => {
      shouldBePlayingRef.current = false;
      stopAndCleanup();
      setStatus('idle');
    }
  };
};
