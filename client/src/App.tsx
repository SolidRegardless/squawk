import { useEffect, useState, useCallback } from 'react';
import { useAccountStore } from './stores/accountStore.tsx';
import { SplashScreen } from './components/splash/SplashScreen.tsx';
import { AccountSetup } from './components/accounts/AccountSetup.tsx';
import { AccountManager } from './components/accounts/AccountManager.tsx';
import { ConnectingScreen } from './components/accounts/ConnectingScreen.tsx';
import { ChatShell } from './components/layout/ChatShell.tsx';
import { PasswordPrompt } from './components/accounts/PasswordPrompt.tsx';

type AppPhase = 'splash' | 'setup' | 'accounts' | 'password-prompt' | 'connecting' | 'connected';

export function App() {
  const [phase, setPhase] = useState<AppPhase>('splash');
  const [loaded, setLoaded] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
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
    if (!loaded) return;

    if (accounts.length === 0) {
      setEditAccountId(null);
      setPhase('setup');
    } else {
      const active = accounts.find((a) => a.id === activeId) ?? accounts[0];
      if (active.savePassword && active.password) {
        connect(active.password);
        setPhase('connecting');
      } else {
        setPhase('password-prompt');
      }
    }
  }, [accounts, activeId, loaded, connect]);

  // Account created or saved — connect
  const handleAccountSaved = useCallback(() => {
    setEditAccountId(null);
    setPhase('connecting');
  }, []);

  // Add new account from manager
  const handleAddAccount = useCallback(() => {
    setEditAccountId(null);
    setPhase('setup');
  }, []);

  // Edit existing account from manager
  const handleEditAccount = useCallback((id: string) => {
    setEditAccountId(id);
    setPhase('setup');
  }, []);

  // Cancel from setup — go back to accounts if we have any
  const handleSetupCancel = useCallback(() => {
    setEditAccountId(null);
    if (accounts.length > 0) {
      setPhase('accounts');
    }
  }, [accounts]);

  // Connect from manager
  const handleManagerConnect = useCallback(() => {
    const active = accounts.find((a) => a.id === activeId) ?? accounts[0];
    if (active?.savePassword && active.password) {
      setPhase('connecting');
    } else {
      setPhase('password-prompt');
    }
  }, [accounts, activeId]);

  // Password entered
  const handlePasswordEntered = useCallback(() => {
    setPhase('connecting');
  }, []);

  // Back to setup from connecting error
  const handleGoToSetup = useCallback(() => {
    setEditAccountId(activeId);
    setPhase('setup');
  }, [activeId]);

  // Reconnect
  const handleReconnect = useCallback(() => {
    setPhase('connecting');
  }, []);

  // Disconnect — show account manager
  const handleDisconnect = useCallback(() => {
    setPhase('accounts');
  }, []);

  // Watch connection status changes
  useEffect(() => {
    if (phase === 'connecting' && status === 'connected') {
      setPhase('connected');
    }
  }, [phase, status]);

  switch (phase) {
    case 'splash':
      return <SplashScreen onDone={handleSplashDone} />;
    case 'setup':
      return (
        <AccountSetup
          onCreated={handleAccountSaved}
          onCancel={accounts.length > 0 ? handleSetupCancel : undefined}
          editAccountId={editAccountId}
        />
      );
    case 'accounts':
      return (
        <AccountManager
          onConnect={handleManagerConnect}
          onAddAccount={handleAddAccount}
          onEditAccount={handleEditAccount}
        />
      );
    case 'password-prompt':
      return <PasswordPrompt onSubmit={handlePasswordEntered} />;
    case 'connecting':
      return <ConnectingScreen onBack={handleGoToSetup} onReconnect={handleReconnect} />;
    case 'connected':
      return <ChatShell onReconnect={handleReconnect} onDisconnect={handleDisconnect} />;
  }
}
