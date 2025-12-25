
import { useEffect, useState, useCallback } from 'react';

export const useTelegram = () => {
  const tg = (window as any).Telegram?.WebApp;

  const [colorScheme, setColorScheme] = useState(tg?.colorScheme || 'light');

  const setCssVar = useCallback((name: string, value: string) => {
    document.documentElement.style.setProperty(name, value);
  }, []);

  useEffect(() => {
    if (!tg) return;

    tg.ready();
    
    // API 8.0+: Fullscreen & Orientation
    if (tg.isVersionAtLeast('8.0')) {
      try {
        if (tg.requestFullscreen) tg.requestFullscreen();
        if (tg.lockOrientation) tg.lockOrientation();
      } catch (e) {
        console.warn("Telegram Layout API error:", e);
      }
    }

    const handleThemeChange = () => {
      setColorScheme(tg.colorScheme);
      if (tg.colorScheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      try {
        if (tg.setHeaderColor) tg.setHeaderColor(tg.themeParams.bg_color);
        if (tg.setBackgroundColor) tg.setBackgroundColor(tg.themeParams.bg_color);
        // API 7.10+: Bottom Bar Color
        if (tg.isVersionAtLeast('7.10') && tg.setBottomBarColor) {
          tg.setBottomBarColor(tg.themeParams.secondary_bg_color);
        }
      } catch (e) {
        console.warn("Theme sync error:", e);
      }
    };

    const handleViewportChange = () => {
      // Safe Area API (7.7+)
      const safe = (tg.isVersionAtLeast('7.7') && tg.safeAreaInset) || { top: 0, bottom: 0 };
      setCssVar('--tg-safe-top', `${safe.top}px`);
      setCssVar('--tg-safe-bottom', `${safe.bottom}px`);
      setCssVar('--tg-viewport-height', `${tg.viewportHeight}px`);
    };

    tg.onEvent('themeChanged', handleThemeChange);
    tg.onEvent('viewportChanged', handleViewportChange);

    handleThemeChange();
    handleViewportChange();

    return () => {
      tg.offEvent('themeChanged', handleThemeChange);
      tg.offEvent('viewportChanged', handleViewportChange);
    };
  }, [tg, setCssVar]);

  const hapticImpact = (style: 'light' | 'medium' | 'heavy' = 'light') => {
    tg?.HapticFeedback?.impactOccurred(style);
  };

  const showSecondaryButton = (text: string, onClick: () => void) => {
    if (!tg || !tg.isVersionAtLeast('7.10') || !tg.SecondaryButton) return;
    
    tg.SecondaryButton.setText(text);
    tg.SecondaryButton.show();
    tg.SecondaryButton.onClick(onClick);
    return () => {
      tg.SecondaryButton.offClick(onClick); // FIXED: was offOnClick
      tg.SecondaryButton.hide();
    };
  };

  const setBackButton = (isVisible: boolean, onClick: () => void) => {
    if (!tg) return;
    if (isVisible) {
      tg.BackButton.show();
      tg.BackButton.onClick(onClick);
    } else {
      tg.BackButton.offClick(onClick); // FIXED: was offOnClick
      tg.BackButton.hide();
    }
  };

  return {
    tg,
    hapticImpact,
    setBackButton,
    showSecondaryButton,
    isDark: colorScheme === 'dark',
    platform: tg?.platform || 'unknown'
  };
};
