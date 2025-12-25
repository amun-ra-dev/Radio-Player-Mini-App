
import { useState, useRef, useEffect, useCallback } from 'react';
import { PlayerStatus } from '../types.ts';

export const useAudio = (streamUrl: string | null) => {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [volume, setVolume] = useState(0.5);
  const [castAvailable, setCastAvailable] = useState(false);
  const [castState, setCastState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const shouldBePlayingRef = useRef(false);
  
  const requestVersionRef = useRef(0);
  const currentLoadedUrlRef = useRef<string | null>(null);
  const availabilityCallbackIdRef = useRef<number | null>(null);

  const playAudioRef = useRef<((overrideUrl?: string) => void) | null>(null);

  // Cast refs
  const castContextRef = useRef<any>(null);

  const handleAudioError = useCallback((_e?: any) => {
    if (!shouldBePlayingRef.current) return;

    if (retryCountRef.current < 3) {
      retryCountRef.current++;
      const delay = retryCountRef.current === 1 ? 2000 : retryCountRef.current === 2 ? 5000 : 10000;
      console.warn(`Playback error, retrying in ${delay}ms... (Attempt ${retryCountRef.current})`);
      setTimeout(() => {
        if (shouldBePlayingRef.current && playAudioRef.current) {
          playAudioRef.current();
        }
      }, delay);
    } else {
      setStatus('error');
      shouldBePlayingRef.current = false;
      currentLoadedUrlRef.current = null;
    }
  }, []);

  const sendMediaToCast = useCallback(async (url: string) => {
    const session = castContextRef.current?.getCurrentSession();
    if (!session) return;

    const chrome = (window as any).chrome;
    if (!chrome || !chrome.cast) return;

    try {
      // Использование более совместимых MIME-типов для Chromecast
      let contentType = 'audio/mpeg';
      if (url.toLowerCase().includes('.m3u8')) {
        // Большинство современных Chromecast предпочитают vnd.apple.mpegurl для HLS
        contentType = 'application/vnd.apple.mpegurl';
      } else if (url.toLowerCase().includes('.aac')) {
        contentType = 'audio/aac';
      }

      const mediaInfo = new chrome.cast.media.MediaInfo(url, contentType);
      mediaInfo.metadata = new chrome.cast.media.MusicTrackMediaMetadata();
      mediaInfo.metadata.title = 'Radio Player Stream';
      mediaInfo.streamType = chrome.cast.media.StreamType.LIVE;
      
      const loadRequest = new chrome.cast.media.LoadRequest(mediaInfo);
      loadRequest.autoplay = true;
      
      console.log('Casting media:', url, 'as', contentType);
      await session.loadMedia(loadRequest);
    } catch (e) {
      console.error('Failed to load media on Cast', e);
    }
  }, []);

  const playAudio = useCallback(async (overrideUrl?: string) => {
    const urlToPlay = overrideUrl || streamUrl;
    if (!urlToPlay) {
        setStatus('idle');
        return;
    }

    shouldBePlayingRef.current = true;

    // Если подключен Cast, отправляем медиа туда
    if (castState === 'connected') {
      sendMediaToCast(urlToPlay);
      setStatus('playing');
      return;
    }

    if (!audioRef.current) return;

    // Если URL тот же и мы уже в процессе, не перезагружаем
    if (urlToPlay === currentLoadedUrlRef.current && (status === 'playing' || status === 'loading')) {
      return;
    }

    const currentVersion = ++requestVersionRef.current;
    currentLoadedUrlRef.current = urlToPlay;
    
    // Очистка предыдущего HLS инстанса
    if (hlsRef.current) {
      try { 
        hlsRef.current.detachMedia();
        hlsRef.current.destroy(); 
      } catch (e) { console.warn("Error destroying HLS instance:", e); }
      hlsRef.current = null;
    }

    setStatus('loading');
    
    const audio = audioRef.current;
    audio.volume = volume;

    const isM3u8 = urlToPlay.toLowerCase().includes('.m3u8');
    const GlobalHls = (window as any).Hls;

    try {
      if (isM3u8 && typeof GlobalHls !== 'undefined' && GlobalHls.isSupported()) {
        const hls = new GlobalHls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60,
          manifestLoadingMaxRetry: 4,
          levelLoadingMaxRetry: 4
        });
        hlsRef.current = hls;
        hls.loadSource(urlToPlay);
        hls.attachMedia(audio);
        
        hls.on(GlobalHls.Events.MANIFEST_PARSED, async () => {
          if (currentVersion !== requestVersionRef.current) return;
          try { 
            await audio.play(); 
          } catch (e: any) {
            if (e.name !== 'AbortError' && currentVersion === requestVersionRef.current) {
              handleAudioError();
            }
          }
        });

        hls.on(GlobalHls.Events.ERROR, (_: any, data: any) => {
          if (currentVersion !== requestVersionRef.current) return;
          if (data.fatal) {
            switch (data.type) {
              case GlobalHls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
              case GlobalHls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
              default: handleAudioError(); break;
            }
          }
        });
      } else {
        // Нативное воспроизведение (iOS/Safari или обычный MP3)
        if (audio.src !== urlToPlay) {
          audio.src = urlToPlay;
          audio.load();
        }
        
        if (currentVersion !== requestVersionRef.current) return;
        try {
          await audio.play();
        } catch (e: any) {
          if (e.name !== 'AbortError' && currentVersion === requestVersionRef.current) {
            console.error("Native Playback failed:", e);
            handleAudioError();
          }
        }
      }
    } catch (err) {
      if (currentVersion === requestVersionRef.current) {
        handleAudioError();
      }
    }
  }, [streamUrl, volume, handleAudioError, status, castState, sendMediaToCast]);

  playAudioRef.current = playAudio;

  // КРИТИЧЕСКИЙ ФИКС: Автоматическое переключение потока при смене streamUrl, если плеер активен
  useEffect(() => {
    if (shouldBePlayingRef.current && streamUrl && streamUrl !== currentLoadedUrlRef.current) {
      playAudio(streamUrl);
    }
  }, [streamUrl, playAudio]);

  const stopAndCleanup = useCallback(() => {
    requestVersionRef.current++;
    currentLoadedUrlRef.current = null;
    if (hlsRef.current) {
      try { 
        hlsRef.current.detachMedia();
        hlsRef.current.destroy(); 
      } catch (e) { console.warn("Error destroying HLS instance:", e); }
      hlsRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }

    const session = castContextRef.current?.getCurrentSession();
    if (session) {
      try {
        const remotePlayer = new (window as any).cast.framework.RemotePlayer();
        const controller = new (window as any).cast.framework.RemotePlayerController(remotePlayer);
        if (remotePlayer.isConnected) {
            controller.playOrPause();
        }
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    const checkCast = () => {
      const cast = (window as any).cast;
      const chrome = (window as any).chrome;
      
      if (cast && cast.framework && chrome && chrome.cast) {
        const context = cast.framework.CastContext.getInstance();
        castContextRef.current = context;

        try {
          context.setOptions({
            receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
            autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
          });
        } catch (e) {}

        const updateCastState = (e: any) => {
          const state = e.castState || context.getCastState();
          setCastAvailable(state !== 'NO_DEVICES_AVAILABLE');
          
          if (state === 'CONNECTED') setCastState('connected');
          else if (state === 'CONNECTING') setCastState('connecting');
          else setCastState('disconnected');
        };

        context.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, updateCastState);
        
        const initialState = context.getCastState();
        setCastAvailable(initialState !== 'NO_DEVICES_AVAILABLE');
        if (initialState === 'CONNECTED') setCastState('connected');

        return () => {
          context.removeEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, updateCastState);
        };
      }
    };

    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) checkCast();
    };

    checkCast();
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "none";
      audio.crossOrigin = "anonymous";
      audio.disableRemotePlayback = false;
      
      audio.onplaying = () => { setStatus('playing'); retryCountRef.current = 0; };
      audio.onpause = () => { setStatus(prev => (prev === 'loading' || shouldBePlayingRef.current) ? 'loading' : 'paused'); };
      audio.onwaiting = () => { if (shouldBePlayingRef.current) setStatus('loading'); };
      audio.onerror = handleAudioError;
      
      const remote = (audio as any).remote;
      if (remote) {
        if (remote.state) setCastState(remote.state);
        remote.onstatechange = () => {
          if (remote.state) setCastState(remote.state);
        };
        if (remote.watchAvailability) {
          remote.watchAvailability((available: boolean) => {
            setCastAvailable(available);
          }).then((id: number) => {
            availabilityCallbackIdRef.current = id;
          }).catch(() => {
            setCastAvailable(true);
          });
        } else {
          setCastAvailable(true);
        }
      }

      audioRef.current = audio;
    }

    return () => {
      const audio = audioRef.current;
      if (audio && (audio as any).remote && availabilityCallbackIdRef.current !== null) {
          try { (audio as any).remote.cancelWatchAvailability(availabilityCallbackIdRef.current); } catch(e){}
      }
      stopAndCleanup();
    };
  }, [handleAudioError, stopAndCleanup]);

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
    if (castContextRef.current) {
      try {
        await castContextRef.current.requestSession();
        if (shouldBePlayingRef.current && streamUrl) {
           sendMediaToCast(streamUrl);
        }
        return;
      } catch (e) {
        console.warn('Cast CAF request failed, falling back to native', e);
      }
    }

    const audio = audioRef.current;
    if (audio && (audio as any).remote) {
      try {
        if (!audio.src && streamUrl) {
          audio.src = streamUrl;
        }
        return (audio as any).remote.prompt();
      } catch (e: any) {
        const isDismissed = e.name === 'NotAllowedError' || 
                           e.name === 'AbortError' ||
                           (e.message && e.message.toLowerCase().includes('dismissed'));
        if (!isDismissed) {
          console.error("Remote playback prompt failed", e);
          throw e;
        }
      }
    } else {
      throw new Error("Remote playback not supported");
    }
  }, [streamUrl, sendMediaToCast]);

  const isCastSupported = useCallback(() => {
    const audio = audioRef.current;
    const hasGoogleCast = !!((window as any).chrome && (window as any).chrome.cast);
    const hasNativeRemote = !!(audio && (audio as any).remote);
    return hasGoogleCast || hasNativeRemote;
  }, []);

  return {
    status,
    volume,
    setVolume,
    togglePlay,
    play: playAudio,
    stop,
    promptCast,
    isCastSupported,
    castAvailable,
    castState
  };
};
