import { useEffect, useState } from 'react';

// Prompt instalasi PWA. Jika browser tidak menyediakan prompt otomatis (iOS Safari, Firefox, dll),
// tampilkan panduan instal manual di dalam aplikasi (installGuide: 'ios' | 'other').
export function usePwaInstall({ onBeforePrompt } = {}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installGuide, setInstallGuide] = useState(null);

  useEffect(() => {
    const handleBeforeInstall = e => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    onBeforePrompt?.();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult && choiceResult.outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    } else {
      setInstallGuide(/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) ? 'ios' : 'other');
    }
  };

  return { isInstalled, install, installGuide, closeInstallGuide: () => setInstallGuide(null) };
}
