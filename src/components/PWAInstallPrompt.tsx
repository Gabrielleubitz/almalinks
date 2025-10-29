import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallPrompt: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Store the install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      
      // Check if we should show the prompt
      const hasPromptBeenShown = localStorage.getItem('pwaInstallPromptShown');
      if (!hasPromptBeenShown) {
        setIsVisible(true);
      }
    };

    // Add event listener for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    
    // Show the install prompt
    await installPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const choiceResult = await installPrompt.userChoice;
    
    // User accepted the install
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // Clear the saved prompt
    setInstallPrompt(null);
    setIsVisible(false);
    
    // Mark as shown
    localStorage.setItem('pwaInstallPromptShown', 'true');
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwaInstallPromptShown', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-black/80 text-white px-4 py-3 rounded-xl shadow-lg max-w-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Download className="h-5 w-5 text-white" />
          <p className="text-sm">Install AlmaLinks for quick access</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleInstall}
            className="text-xs bg-white text-black px-3 py-1 rounded-full font-medium"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="text-white p-1 hover:bg-white/20 rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;