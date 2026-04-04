import { useAccountStore } from '../../stores/accountStore.tsx';
import styles from './ChatShell.module.css';

interface Props {
  onReconnect: () => void;
}

export function ChatShell({ onReconnect }: Props) {
  const accounts = useAccountStore((s) => s.accounts);
  const activeId = useAccountStore((s) => s.activeAccountId);
  const status = useAccountStore((s) => s.connectionStatus);
  const disconnect = useAccountStore((s) => s.disconnect);
  const connect = useAccountStore((s) => s.connect);

  const account = accounts.find((a) => a.id === activeId);

  const handleDisconnect = () => {
    disconnect();
  };

  const handleReconnect = () => {
    disconnect();
    setTimeout(() => {
      connect(account?.password);
      onReconnect();
    }, 100);
  };

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logo}>🦜</span>
          <span className={styles.brand}>Squawk</span>
        </div>

        <div className={styles.accountCard}>
          <div className={styles.accountInfo}>
            <span className={styles.accountName}>{account?.username}</span>
            <span className={styles.accountDomain}>@{account?.domain}</span>
          </div>
          <span className={`${styles.statusDot} ${styles[status]}`} title={status} />
        </div>

        <div className={styles.contactsPlaceholder}>
          <span className={styles.placeholderEmoji}>🎉</span>
          <p className={styles.placeholderText}>Connected!</p>
          <p className={styles.placeholderHint}>
            Contacts and chats will appear here in Phase 2
          </p>
        </div>

        <div className={styles.sidebarFooter}>
          <button className={styles.footerBtn} onClick={handleReconnect}>
            🔄 Reconnect
          </button>
          <button className={`${styles.footerBtn} ${styles.disconnectBtn}`} onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <div className={styles.emptyState}>
          <span className={styles.emptyEmoji}>🦜</span>
          <h2 className={styles.emptyTitle}>You're in!</h2>
          <p className={styles.emptyText}>
            Connected as <strong>{account?.username}@{account?.domain}</strong>
          </p>
          <p className={styles.emptyHint}>
            Chat features coming in Phase 2. For now, your XMPP connection is live.
          </p>
        </div>
      </main>
    </div>
  );
}
