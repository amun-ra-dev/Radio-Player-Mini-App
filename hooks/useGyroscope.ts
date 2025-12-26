
import { useState, useEffect } from 'react';

export interface OrientationData {
  x: number; // Gamma (left-to-right tilt)
  y: number; // Beta (front-to-back tilt)
}

export const useGyroscope = (enabled: boolean = true) => {
  const [orientation, setOrientation] = useState<OrientationData>({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // Нормализуем значения для небольшого смещения (параллакса)
      // gamma (-90 to 90), beta (-180 to 180)
      const x = (e.gamma || 0) / 45; // В диапазоне примерно от -2 до 2
      const y = (e.beta || 0) / 45;
      
      setOrientation({ x, y });
    };

    // Запрашиваем разрешение для iOS, если необходимо
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        })
        .catch(console.error);
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [enabled]);

  return orientation;
};
