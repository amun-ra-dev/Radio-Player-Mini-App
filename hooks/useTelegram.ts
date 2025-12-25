
import { useEffect, useMemo, useState, useCallback } from 'react';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotifyType = 'error' | 'success' | 'warning';

export const useTelegram = () => {
  const tg = (window as any).Telegram?.WebApp;

  const [isExpanded, setIsExpanded] = useState<boolean>(tg?.isExpanded || false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(tg?.isFullscreen || false);

  const platform = useMemo(() => (tg?.platform?.toLowerCase?.() || ''), [tg]);
  const isMobile = platform === 'ios' || platform === 'android';

  useEffect(() => {
    if (!tg) return;

    tg.ready();

    // Orientation lock is available from version 7.0
    try {
      if (tg.isVersionAtLeast('7.0') && typeof tg.lockOrientation === 'function') {
        tg.lockOrientation();
      }
    } catch (e) {
      console.warn("Orientation locking not supported or failed.");
    }

    const setCssVar = (name: string, value: string) => {
      document.documentElement.style.setProperty(name, value);
    };

    const applyInsets = () => {
      const safe = tg.safeAreaInset || tg.contentSafeAreaInset || null;
      if (safe) {
        setCssVar('--tg-safe-top', `${safe.top || 0}px`);
        setCssVar('--tg-safe-bottom', `${safe.bottom || 0}px`);
        setCssVar('--tg-safe-left', `${safe.left || 0}px`);
        setCssVar('--tg-safe-right', `${safe.right || 0}px`);
      } else {
        setCssVar('--tg-safe-top', `env(safe-area-inset-top, 0px)`);
        setCssVar('--tg-safe-bottom', `env(safe-area-inset-bottom, 0px)`);
      }
    };

    const applyViewport = () => {
      if (tg.viewportHeight) setCssVar('--tg-viewport-height', `${tg.viewportHeight}px`);
    };

    const applyTheme = () => {
      if (!tg.themeParams) return;
      document.body.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
      if (tg.colorScheme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      
      try { 
        if (typeof tg.setHeaderColor === 'function') {
          tg.setHeaderColor(tg.themeParams.bg_color || 'bg_color');
        }
      } catch {}
    };

    const updateUIState = () => {
      setIsExpanded(Boolean(tg.isExpanded));
      setIsFullscreen(Boolean(tg.isFullscreen));
      applyInsets();
      applyViewport();
      applyTheme();
    };

    if (isMobile) {
      try { tg.expand(); } catch {}
    }

    updateUIState();
    
    tg.onEvent('viewportChanged', updateUIState);
    tg.onEvent('themeChanged', applyTheme);
    tg.onEvent('fullscreenChanged', () => setIsFullscreen(tg.isFullscreen));

    return () => {
      try {
        tg.offEvent('viewportChanged', updateUIState);
        tg.offEvent('themeChanged', applyTheme);
        tg.offEvent('fullscreenChanged', () => setIsFullscreen(tg.isFullscreen));
      } catch {}
    };
  }, [tg, isMobile]);

  const hapticImpact = (style: ImpactStyle = 'light') => {
    tg?.HapticFeedback?.impactOccurred?.(style);
  };

  const hapticNotification = (type: NotifyType) => {
    tg?.HapticFeedback?.notificationOccurred?.(type);
  };

  const showScanQr = (text: string, callback: (data: string) => boolean | void) => {
    // QR Scanner requires version 6.4
    if (!tg || !tg.isVersionAtLeast('6.4') || !tg.showScanQrPopup) return false;
    try {
      tg.showScanQrPopup({ text }, (data: string) => {
        const result = callback(data);
        if (result !== false) tg.closeScanQrPopup();
      });
      return true;
    } catch (e) {
      console.error("QR Scan failed", e);
      return false;
    }
  };

  const requestWriteAccess = (callback: (granted: boolean) => void) => {
    // Write access requires version 6.9
    if (!tg || !tg.isVersionAtLeast('6.9') || !tg.requestWriteAccess) return callback(false);
    try {
      tg.requestWriteAccess((granted: boolean) => callback(granted));
    } catch (e) {
      callback(false);
    }
  };

  const toggleFullscreen = () => {
    if (!tg || !tg.isVersionAtLeast('8.0')) return false;
    try {
      if (tg.isFullscreen) tg.exitFullscreen();
      else tg.requestFullscreen();
      return true;
    } catch (e) {
      console.warn("Fullscreen API failed");
      return false;
    }
  };

  const openInvoice = (url: string, callback: (status: string) => void) => {
    if (!tg?.openInvoice) return;
    tg.openInvoice(url, callback);
  };

  const setBackButton = (isVisible: boolean, onClick: () => void) => {
    if (!tg) return;
    if (isVisible) {
      tg.BackButton.show();
      tg.BackButton.onClick(onClick);
    } else {
      tg.BackButton.hide();
    }
  };

  return {
    tg,
    isExpanded,
    isFullscreen,
    hapticImpact,
    hapticNotification,
    setBackButton,
    showScanQr,
    requestWriteAccess,
    toggleFullscreen,
    openInvoice,
    isDark: tg?.colorScheme === 'dark',
    isMobile,
    version: tg?.version || '0.0'
  };
};
