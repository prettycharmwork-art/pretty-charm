import React, { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) {
            install();
          } else {
            setShowModal(true);
          }
        }}
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#e4b7c0] bg-[#fff8fa] text-xs font-medium text-[#7a3b47] hover:bg-[#fce9ee] transition-colors whitespace-nowrap shrink-0"
        aria-label="Install Pretty Charm App"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#fffdfb] border border-[#e4b7c0] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 id="pwa-install-title" className="text-xl font-semibold text-[#2d1e22]">
                Install Pretty Charm App
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-[#7a3b47] hover:bg-[#fce9ee]"
                aria-label="Close install guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {isIOS ? (
              <p className="text-sm text-[#5c4349] leading-relaxed">
                1. Tap the <strong>Share</strong> icon in your Safari toolbar.<br />
                2. Scroll down and select <strong>Add to Home Screen</strong> for instant 1-tap access to Pretty Charm.
              </p>
            ) : (
              <p className="text-sm text-[#5c4349] leading-relaxed">
                Use your browser menu (<strong>⋮</strong> or address bar icon) and select <strong>Install Pretty Charm</strong> or <strong>Add to Home Screen</strong> to install the standalone web app.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#9e5461] text-white text-sm font-medium hover:bg-[#83424e] transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#7a3b47] px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Viewing cached store catalogue.</span>
    </div>
  );
};
