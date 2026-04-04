import { useEffect, useState } from 'react';
import { useAccountStore } from './stores/accountStore.tsx';
import { SplashScreen } from './components/splash/SplashScreen.tsx';
import { AccountSetup } from './components/accounts/AccountSetup.tsx';
import { ConnectingScreen } from './components/accounts/ConnectingScreen.tsx';
import { ChatShell } from './components/layout/ChatShell.tsx';
import { PasswordPrompt } from './components/accounts/PasswordPrompt.tsx';

type AppPhase = 'splash' | 'setup' | 'password-prompt' | 'connecting' | 'connected';

export function App() {
  const [phase, setPhase] = useState<AppPhase>('splash');
  const accounts = useAccountStore((s) => s.accounts);
  const activeId = useAccountStore((s) => s.activeAccountId);
  const status = useAccountStore((s) => s.connectionStatus);
  const loadAccounts = useAccountStore((s) => s.loadAccounts);

  // Load persisted accounts on mount
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // After splash, decide where to go
  const handleSplashDone = () => {
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
  };

  // After account created
  const handleAccountCreated = () => {
    setPhase('connecting');
  };

  // After password entered
  const handlePasswordEntered = () => {
    setPhase('connecting');
  };

  // Watch connection status
  useEffect(() => {
    if (phase === 'connecting' && status === 'connected') {
      setPhase('connected');
    }
  }, [phase, status]);

  switch (phase) {
    case 'splash':
      return <SplashScreen onDone={handleSplashDone} />;
    case 'setup':
      return <AccountSetup onCreated={handleAccountCreated} />;
    case 'password-prompt':
      return <PasswordPrompt onSubmit={handlePasswordEntered} />;
    case 'connecting':
      return <ConnectingScreen onBack={() => setPhase('setup')} />;
    case 'connected':
      return <ChatShell />;
  }
}
