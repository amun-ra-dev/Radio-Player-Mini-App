
import { useEffect, useMemo, useState } from 'react';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotifyType = 'error' | 'success' | 'warning';

export const useTelegram = () => {
  const tg = (window as any).Telegram?.WebApp;

  const [isExpanded, setIsExpanded] = useState<boolean>(tg?.isExpanded || false);

  const platform = useMemo(() => (tg?.platform?.toLowerCase?.() || ''), [tg]);
  const isMobile = platform === 'ios' || platform === 'android';

  useEffect(() => {
    if (!tg) return;

    tg.ready();

    // Блокировка ориентации на мобильных устройствах (Portrait)
    try {
      if (typeof tg.lockOrientation === 'function') {
        tg.lockOrientation();
      }
    } catch (e) {
      console.warn("Native orientation lock failed:", e);
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
        setCssVar('--tg-safe-left', `env(safe-area-inset-left, 0px)`);
        setCssVar('--tg-safe-right', `env(safe-area-inset-right, 0px)`);
      }
    };

    const applyViewport = () => {
      if (tg.viewportHeight) {
        setCssVar('--tg-viewport-height', `${tg.viewportHeight}px`);
      }
      if (tg.viewportStableHeight) {
        setCssVar('--tg-viewport-stable-height', `${tg.viewportStableHeight}px`);
      }
    };

    const applyTheme = () => {
      if (!tg.themeParams) return;

      document.body.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
      document.body.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#222222');

      // Синхронизация Tailwind dark mode с темой Telegram
      if (tg.colorScheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      try {
        if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor(tg.themeParams.bg_color || 'bg_color');
      } catch {}
      try {
        if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor(tg.themeParams.bg_color || 'bg_color');
      } catch {}
    };

    const requestFullscreenSafe = () => {
      try {
        if (typeof tg.requestFullscreen === 'function') tg.requestFullscreen();
      } catch {}
    };

    const updateUIState = () => {
      setIsExpanded(Boolean(tg.isExpanded));
      applyInsets();
      applyViewport();
      applyTheme(); // Обновляем тему при изменении параметров
    };

    if (isMobile) {
      try {
        tg.expand();
      } catch {}

      requestFullscreenSafe();

      const once = () => requestFullscreenSafe();
      window.addEventListener('pointerdown', once, { once: true, passive: true });
      window.addEventListener('touchstart', once, { once: true, passive: true });
    }

    updateUIState();
    
    tg.onEvent('viewportChanged', updateUIState);
    tg.onEvent('themeChanged', applyTheme);

    return () => {
      try {
        tg.offEvent('viewportChanged', updateUIState);
        tg.offEvent('themeChanged', applyTheme);
      } catch {}
    };
  }, [tg, isMobile]);

  const hapticImpact = (style: ImpactStyle = 'light') => {
    tg?.HapticFeedback?.impactOccurred?.(style);
  };

  const hapticNotification = (type: NotifyType) => {
    tg?.HapticFeedback?.notificationOccurred?.(type);
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
    hapticImpact,
    hapticNotification,
    setBackButton,
    isDark: tg?.colorScheme === 'dark',
    themeParams: tg?.themeParams,
    platform: tg?.platform,
    isMobile
  };
};
