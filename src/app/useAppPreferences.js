import { useEffect, useState } from 'react';
import { defaultTheme, themes, THEME_STORAGE_KEY } from '../shared/theme/themes';
import { isIosInstallCandidate, isStandaloneDisplayMode } from '../shared/pwa/pwaSupport';

const PWA_INSTALL_HELP_DISMISSED_KEY = 'frettrack_pwa_install_help_dismissed';
const NEW_JOB_SIDEBAR_COLLAPSED_KEY = 'frettrack:new-job-sidebar-collapsed';

export default function useAppPreferences({ onNotice }) {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return themes.some((themeOption) => themeOption.value === savedTheme) ? savedTheme : defaultTheme;
  });
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [isStandalonePwa, setIsStandalonePwa] = useState(() => isStandaloneDisplayMode());
  const [showInstallHelp, setShowInstallHelp] = useState(
    () => localStorage.getItem(PWA_INSTALL_HELP_DISMISSED_KEY) !== 'true'
  );
  const [isNewJobSidebarCollapsed, setIsNewJobSidebarCollapsed] = useState(
    () => localStorage.getItem(NEW_JOB_SIDEBAR_COLLAPSED_KEY) === 'true'
  );

  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      document.documentElement.dataset.theme = theme === 'system'
        ? (colorScheme.matches ? 'bench-dark' : 'shop-light')
        : theme;
      document.documentElement.dataset.themePreference = theme;
    };

    applyTheme();
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (theme === 'system') {
      colorScheme.addEventListener?.('change', applyTheme);
    }

    return () => colorScheme.removeEventListener?.('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredInstallPrompt(event);
    }

    function handleInstalled() {
      setDeferredInstallPrompt(null);
      setIsStandalonePwa(true);
      onNotice({ type: 'success', message: 'FretTrack was installed on this device.' });
    }

    function syncStandaloneState() {
      setIsStandalonePwa(isStandaloneDisplayMode());
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    mediaQuery.addEventListener?.('change', syncStandaloneState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      mediaQuery.removeEventListener?.('change', syncStandaloneState);
    };
  }, [onNotice]);

  async function installApp() {
    if (!deferredInstallPrompt) {
      return;
    }

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') {
      onNotice({
        type: 'success',
        message: 'Install prompt accepted. FretTrack will finish installing if the browser allows it.'
      });
    }
    setDeferredInstallPrompt(null);
  }

  function dismissInstallHelp() {
    localStorage.setItem(PWA_INSTALL_HELP_DISMISSED_KEY, 'true');
    setShowInstallHelp(false);
  }

  function toggleNewJobSidebar() {
    setIsNewJobSidebarCollapsed((isCollapsed) => {
      const nextValue = !isCollapsed;
      localStorage.setItem(NEW_JOB_SIDEBAR_COLLAPSED_KEY, String(nextValue));
      return nextValue;
    });
  }

  return {
    dismissInstallHelp,
    installApp,
    isNewJobSidebarCollapsed,
    setTheme,
    shouldShowIosInstallHelp: !isStandalonePwa && showInstallHelp && isIosInstallCandidate(),
    shouldShowPwaInstallButton: Boolean(deferredInstallPrompt) && !isStandalonePwa,
    theme,
    themes,
    toggleNewJobSidebar
  };
}
