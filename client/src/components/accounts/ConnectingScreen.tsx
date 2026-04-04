import { useEffect } from 'react';
import { useAccountStore } from '../../stores/accountStore.tsx';
import { Button } from '../shared/Button.tsx';
import styles from './ConnectingScreen.module.css';

interface Props {
  onBack: () => void;
}

export function ConnectingScreen({ onBack }: Props) {
  const status = useAccountStore((s) => s.connectionStatus);
  const error = useAccountStore((s) => s.connectionError);
  const activeId = useAccountStore((s) => s.activeAccountId);
  const accounts = useAccountStore((s) => s.accounts);
  const connect = useAccountStore((s) => s.connect);

  const activeAccount = accounts.find((a) => a.id === activeId);

  // Auto-retry on error after 5s (max 3 times)
  useEffect(() => {
    if (status !== 'error') return;
    // Don't auto-retry — user needs to see the error
  }, [status]);

  const handleRetry = () => {
    if (activeAccount) {
      connect(activeAccount.password);
    }
  };

  const isConnecting = status === 'connecting';
  const isError = status === 'error';

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {isConnecting && (
          <>
            <div className={styles.spinner}>
              <span className={styles.parrot}>🦜</span>
            </div>
            <h2 className={styles.title}>Connecting...</h2>
            <p className={styles.info}>
              Reaching <strong>{activeAccount?.domain}</strong> as{' '}
              <strong>{activeAccount?.username}</strong>
            </p>
            <div className={styles.steps}>
              <Step label="Resolving server" status="active" />
              <Step label="XMPP handshake" status="pending" />
              <Step label="Authentication" status="pending" />
              <Step label="Loading roster" status="pending" />
            </div>
          </>
        )}

        {isError && (
          <>
            <span className={styles.errorEmoji}>😵</span>
            <h2 className={styles.errorTitle}>Connection Failed</h2>
            <div className={styles.errorBox}>
              <p className={styles.errorMessage}>{error}</p>
            </div>
            <div className={styles.diagnostics}>
              <h3>Things to check:</h3>
              <ul>
                <li>Is the domain <strong>{activeAccount?.domain}</strong> correct?</li>
                <li>Is the XMPP server running and accessible?</li>
                <li>Are your credentials correct?</li>
                <li>Does the server support WebSocket or BOSH connections?</li>
                <li>Check your firewall / VPN settings</li>
              </ul>
            </div>
            <div className={styles.actions}>
              <Button onClick={handleRetry}>Retry</Button>
              <Button variant="secondary" onClick={onBack}>Edit Account</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Step({ label, status }: { label: string; status: 'active' | 'done' | 'pending' | 'error' }) {
  const icons = { active: '⏳', done: '✅', pending: '○', error: '❌' };
  return (
    <div className={`${styles.step} ${styles[status]}`}>
      <span>{icons[status]}</span>
      <span>{label}</span>
    </div>
  );
}
