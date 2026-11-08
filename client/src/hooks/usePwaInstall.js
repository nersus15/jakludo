import { useEffect, useState } from 'react';

// Prompt instalasi PWA (Android/desktop) dan panduan manual untuk iOS
export function usePwaInstall({ onBeforePrompt } = {}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosInstallGuide, setShowIosInstallGuide] = useState(false);

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
      if (choiceResult && choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())) {
      setShowIosInstallGuide(true);
    } else {
      alert('Untuk memasang JakLudo di perangkatmu, klik menu browser (titik tiga) lalu pilih "Instal Aplikasi" atau "Tambahkan ke Layar Utama".');
    }
  };

  return { isInstalled, install, showIosInstallGuide, setShowIosInstallGuide };
}
