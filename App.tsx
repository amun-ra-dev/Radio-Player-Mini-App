import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const App: React.FC = () => {
  const [tg, setTg] = useState<any>(null);

  useEffect(() => {
    const webapp = (window as any).Telegram?.WebApp;
    if (webapp) {
      webapp.ready();
      webapp.expand();
      setTg(webapp);
      
      // Sync dark mode with Telegram theme
      if (webapp.colorScheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const handleAlert = () => {
    if (tg) {
      tg.HapticFeedback?.impactOccurred('medium');
      
      // Safe check for version. showAlert/showPopup was added in 6.2
      // If version is < 6.2, we fall back to standard browser alert
      if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) {
        tg.showAlert('Starter App is Ready!');
      } else {
        alert('Starter App is Ready!');
      }
    } else {
      alert('Starter App is Ready!');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full px-6 text-center select-none bg-[var(--tg-theme-bg-color)]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="space-y-4"
      >
        <div className="w-24 h-24 bg-blue-500 rounded-[2rem] mx-auto flex items-center justify-center shadow-xl shadow-blue-500/20">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-[var(--tg-theme-text-color)]">
            Blank Starter
          </h1>
          <p className="text-[var(--tg-theme-hint-color, #999)] font-medium max-w-[240px] mx-auto leading-relaxed">
            Start building your amazing Telegram Mini App here.
          </p>
        </div>
      </motion.div>

      <div className="fixed bottom-10 left-0 right-0 px-8">
        <button
          onClick={handleAlert}
          className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-black/5"
          style={{
            backgroundColor: 'var(--tg-theme-button-color, #0088cc)',
            color: 'var(--tg-theme-button-text-color, #ffffff)'
          }}
        >
          Get Started
        </button>
      </div>
    </div>
  );
};