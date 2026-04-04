import { useEffect, useState, useCallback } from 'react';
import { useAccountStore } from './stores/accountStore.tsx';
import { SplashScreen } from './components/splash/SplashScreen.tsx';
import { AccountSetup } from './components/accounts/AccountSetup.tsx';
import { ConnectingScreen } from './components/accounts/ConnectingScreen.tsx';
import { ChatShell } from './components/layout/ChatShell.tsx';
import { PasswordPrompt } from './components/accounts/PasswordPrompt.tsx';

type AppPhase = 'splash' | 'setup' | 'password-prompt' | 'connecting' | 'connected';

export function App() {
  const [phase, setPhase] = useState<AppPhase>('splash');
  const [loaded, setLoaded] = useState(false);
  const accounts = useAccountStore((s) => s.accounts);
  const activeId = useAccountStore((s) => s.activeAccountId);
  const status = useAccountStore((s) => s.connectionStatus);
  const loadAccounts = useAccountStore((s) => s.loadAccounts);
  const connect = useAccountStore((s) => s.connect);

  // Load persisted accounts on mount
  useEffect(() => {
    loadAccounts().then(() => setLoaded(true));
  }, [loadAccounts]);

  // After splash, decide where to go
  const handleSplashDone = useCallback(() => {
    if (!loaded) {
      // Accounts not loaded yet, wait a tick
      const check = setInterval(() => {
        setPhase('splash'); // keep on splash
      }, 100);
      setTimeout(() => clearInterval(check), 2000);
      return;
    }

    if (accounts.length === 0) {
      setPhase('setup');
    } else {
      const active = accounts.find((a) => a.id === activeId) ?? accounts[0];
      if (active.savePassword && active.password) {
        // Auto-connect!
        connect(active.password);
        setPhase('connecting');
      } else {
        setPhase('password-prompt');
      }
    }
  }, [accounts, activeId, loaded, connect]);

  // After account created (AccountSetup already calls connect)
  const handleAccountCreated = useCallback(() => {
    setPhase('connecting');
  }, []);

  // After password entered
  const handlePasswordEntered = useCallback(() => {
    setPhase('connecting');
  }, []);

  // Navigate to setup (edit account)
  const handleGoToSetup = useCallback(() => {
    setPhase('setup');
  }, []);

  // Reconnect — go back through the connecting flow
  const handleReconnect = useCallback(() => {
    setPhase('connecting');
  }, []);

  // Watch connection status changes
  useEffect(() => {
    if (phase === 'connecting' && status === 'connected') {
      setPhase('connected');
    }
    if (phase === 'connected' && status === 'disconnected') {
      if (accounts.length === 0) {
        setPhase('setup');
      } else {
        const active = accounts.find((a) => a.id === activeId) ?? accounts[0];
        if (active.savePassword && active.password) {
          setPhase('connecting');
        } else {
          setPhase('password-prompt');
        }
      }
    }
  }, [phase, status, accounts, activeId]);

  switch (phase) {
    case 'splash':
      return <SplashScreen onDone={handleSplashDone} />;
    case 'setup':
      return <AccountSetup onCreated={handleAccountCreated} />;
    case 'password-prompt':
      return <PasswordPrompt onSubmit={handlePasswordEntered} />;
    case 'connecting':
      return <ConnectingScreen onBack={handleGoToSetup} onReconnect={handleReconnect} />;
    case 'connected':
      return <ChatShell onReconnect={handleReconnect} />;
  }
}
