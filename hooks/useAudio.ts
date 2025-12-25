
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

  const stopLocalPlayback = useCallback(() => {
    if (hlsRef.current) {
      try { 
        hlsRef.current.detachMedia();
        hlsRef.current.destroy(); 
      } catch (e) { console.warn("Error destroying HLS instance:", e); }
      hlsRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.muted = true; // Гарантированная тишина
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    currentLoadedUrlRef.current = null;
  }, []);

  const sendMediaToCast = useCallback(async (url: string) => {
    const session = castContextRef.current?.getCurrentSession();
    if (!session) return;

    const chrome = (window as any).chrome;
    if (!chrome || !chrome.cast) return;

    try {
      let contentType = 'audio/mpeg';
      const lowUrl = url.toLowerCase();
      
      if (lowUrl.includes('.m3u8')) {
        // vnd.apple.mpegurl — наиболее кросс-девайсный тип для HLS на Cast
        contentType = 'application/vnd.apple.mpegurl';
      } else if (lowUrl.includes('.aac')) {
        contentType = 'audio/aac';
      }

      const mediaInfo = new chrome.cast.media.MediaInfo(url, contentType);
      mediaInfo.metadata = new chrome.cast.media.MusicTrackMediaMetadata();
      mediaInfo.metadata.title = 'Radio Player Stream';
      mediaInfo.streamType = chrome.cast.media.StreamType.LIVE;
      
      const loadRequest = new chrome.cast.media.LoadRequest(mediaInfo);
      loadRequest.autoplay = true;
      
      // Синхронизируем громкость сразу при загрузке
      await session.setReceiverVolumeLevel(volume, () => {}, () => {});
      
      console.log('Casting HLS/MP3:', url, 'Mime:', contentType);
      await session.loadMedia(loadRequest);
    } catch (e) {
      console.error('Failed to load media on Cast', e);
    }
  }, [volume]);

  // Обновление громкости (локально или на ТВ)
  const updateVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    
    // 1. Локальная громкость
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }

    // 2. Громкость на ТВ (если подключен)
    const session = castContextRef.current?.getCurrentSession();
    if (session && castState === 'connected') {
      try {
        session.setReceiverVolumeLevel(newVolume, () => {}, (e: any) => console.error('Cast volume error', e));
      } catch (e) {}
    }
  }, [castState]);

  const playAudio = useCallback(async (overrideUrl?: string) => {
    const urlToPlay = overrideUrl || streamUrl;
    if (!urlToPlay) {
        setStatus('idle');
        return;
    }

    shouldBePlayingRef.current = true;

    // Если подключен Cast, играем ТОЛЬКО там, локально выключаем звук
    if (castState === 'connected') {
      stopLocalPlayback();
      sendMediaToCast(urlToPlay);
      setStatus('playing');
      return;
    }

    if (!audioRef.current) return;
    audioRef.current.muted = false; // Возвращаем звук локально

    if (urlToPlay === currentLoadedUrlRef.current && (status === 'playing' || status === 'loading')) {
      return;
    }

    const currentVersion = ++requestVersionRef.current;
    currentLoadedUrlRef.current = urlToPlay;
    
    if (hlsRef.current) {
      try { hlsRef.current.detachMedia(); hlsRef.current.destroy(); } catch (e) {}
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
          manifestLoadingMaxRetry: 10,
          levelLoadingMaxRetry: 10,
        });
        hlsRef.current = hls;
        hls.loadSource(urlToPlay);
        hls.attachMedia(audio);
        
        hls.on(GlobalHls.Events.MANIFEST_PARSED, async () => {
          if (currentVersion !== requestVersionRef.current) return;
          try { await audio.play(); } catch (e: any) {
            if (e.name !== 'AbortError' && currentVersion === requestVersionRef.current) {
               setStatus('error');
            }
          }
        });

        hls.on(GlobalHls.Events.ERROR, (_: any, data: any) => {
          if (currentVersion !== requestVersionRef.current) return;
          if (data.fatal) {
            switch (data.type) {
              case GlobalHls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
              case GlobalHls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
              default: setStatus('error'); break;
            }
          }
        });
      } else {
        if (audio.src !== urlToPlay) {
          audio.src = urlToPlay;
          audio.load();
        }
        if (currentVersion !== requestVersionRef.current) return;
        try { await audio.play(); } catch (e: any) {
          if (e.name !== 'AbortError' && currentVersion === requestVersionRef.current) {
            setStatus('error');
          }
        }
      }
    } catch (err) {
      if (currentVersion === requestVersionRef.current) setStatus('error');
    }
  }, [streamUrl, volume, status, castState, sendMediaToCast, stopLocalPlayback]);

  playAudioRef.current = playAudio;

  useEffect(() => {
    if (shouldBePlayingRef.current && streamUrl && streamUrl !== currentLoadedUrlRef.current) {
      playAudio(streamUrl);
    }
  }, [streamUrl, playAudio]);

  useEffect(() => {
    if (castState === 'connected' && shouldBePlayingRef.current) {
      stopLocalPlayback();
      if (streamUrl) sendMediaToCast(streamUrl);
    }
  }, [castState, streamUrl, sendMediaToCast, stopLocalPlayback]);

  const stop = useCallback(() => {
    shouldBePlayingRef.current = false;
    stopLocalPlayback();
    
    const session = castContextRef.current?.getCurrentSession();
    if (session) {
      try {
        const remotePlayer = new (window as any).cast.framework.RemotePlayer();
        const controller = new (window as any).cast.framework.RemotePlayerController(remotePlayer);
        if (remotePlayer.isConnected) controller.playOrPause();
      } catch(e) {}
    }
    setStatus('paused');
  }, [stopLocalPlayback]);

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
        return () => context.removeEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, updateCastState);
      }
    };
    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => isAvailable && checkCast();
    checkCast();
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "none";
      audio.crossOrigin = "anonymous";
      audio.onplaying = () => { setStatus('playing'); retryCountRef.current = 0; };
      audio.onpause = () => { if (castState !== 'connected' && shouldBePlayingRef.current) setStatus('loading'); };
      audio.onerror = () => { if (shouldBePlayingRef.current && castState !== 'connected') setStatus('error'); };
      audioRef.current = audio;
    }
  }, [castState]);

  const togglePlay = useCallback(() => {
    if (status === 'playing' || status === 'loading') stop();
    else playAudio();
  }, [status, stop, playAudio]);

  const promptCast = useCallback(async () => {
    if (castContextRef.current) {
      try {
        await castContextRef.current.requestSession();
        if (shouldBePlayingRef.current && streamUrl) sendMediaToCast(streamUrl);
        return;
      } catch (e) { console.warn('Cast CAF failed', e); }
    }
    const audio = audioRef.current;
    if (audio && (audio as any).remote) {
      try {
        if (!audio.src && streamUrl) audio.src = streamUrl;
        return (audio as any).remote.prompt();
      } catch (e: any) { console.error("Remote prompt failed", e); }
    }
  }, [streamUrl, sendMediaToCast]);

  return {
    status,
    volume,
    setVolume: updateVolume,
    togglePlay,
    play: playAudio,
    stop,
    promptCast,
    isCastSupported: () => !!((window as any).chrome?.cast || audioRef.current?.remote),
    castAvailable,
    castState
  };
};
