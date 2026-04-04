import { useAccountStore, type ConnectionStep, type StepStatus } from '../../stores/accountStore.tsx';
import { Button } from '../shared/Button.tsx';
import styles from './ConnectingScreen.module.css';

interface Props {
  onBack: () => void;
  onReconnect: () => void;
}

const STEP_LABELS: Record<ConnectionStep, string> = {
  relay: 'Connect to relay server',
  resolve: 'Resolve XMPP server',
  handshake: 'XMPP handshake',
  auth: 'Authentication',
  roster: 'Loading roster',
};

const STEP_ORDER: ConnectionStep[] = ['relay', 'resolve', 'handshake', 'auth', 'roster'];

export function ConnectingScreen({ onBack, onReconnect }: Props) {
  const status = useAccountStore((s) => s.connectionStatus);
  const error = useAccountStore((s) => s.connectionError);
  const steps = useAccountStore((s) => s.connectionSteps);
  const activeId = useAccountStore((s) => s.activeAccountId);
  const accounts = useAccountStore((s) => s.accounts);
  const connect = useAccountStore((s) => s.connect);

  const activeAccount = accounts.find((a) => a.id === activeId);

  const handleRetry = () => {
    if (activeAccount) {
      connect(activeAccount.password);
      onReconnect();
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
          </>
        )}

        {isError && (
          <>
            <span className={styles.errorEmoji}>😵</span>
            <h2 className={styles.errorTitle}>Connection Failed</h2>
            <div className={styles.errorBox}>
              <p className={styles.errorMessage}>{error}</p>
            </div>
          </>
        )}

        {/* Steps — always shown */}
        <div className={styles.steps}>
          {STEP_ORDER.map((key) => (
            <StepRow key={key} label={STEP_LABELS[key]} status={steps[key]} />
          ))}
        </div>

        {isError && (
          <>
            <div className={styles.diagnostics}>
              <h3>Things to check:</h3>
              <ul>
                {steps.relay === 'error' && (
                  <>
                    <li>Is the relay server running? (<code>cd relay && npm run dev</code>)</li>
                    <li>Check that port 3001 is not blocked</li>
                  </>
                )}
                {steps.resolve === 'error' && (
                  <>
                    <li>Is the domain <strong>{activeAccount?.domain}</strong> correct?</li>
                    <li>Is the XMPP server running and accessible?</li>
                    <li>Check your firewall / VPN settings</li>
                  </>
                )}
                {steps.auth === 'error' && (
                  <>
                    <li>Are your username and password correct?</li>
                    <li>Does the account exist on <strong>{activeAccount?.domain}</strong>?</li>
                    <li>Check if your account is locked or disabled</li>
                  </>
                )}
                {steps.handshake === 'error' && (
                  <li>Does the server support WebSocket or BOSH connections?</li>
                )}
                <li>Check the browser console and relay logs for details</li>
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

function StepRow({ label, status }: { label: string; status: StepStatus }) {
  const icons: Record<StepStatus, string> = {
    active: '⏳',
    done: '✅',
    pending: '○',
    error: '❌',
  };

  return (
    <div className={`${styles.step} ${styles[status]}`}>
      <span className={styles.stepIcon}>{icons[status]}</span>
      <span className={styles.stepLabel}>{label}</span>
    </div>
  );
}
