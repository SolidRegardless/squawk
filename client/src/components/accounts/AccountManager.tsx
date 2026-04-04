import { useState } from 'react';
import { useAccountStore } from '../../stores/accountStore.tsx';
import { Button } from '../shared/Button.tsx';
import styles from './AccountManager.module.css';

interface Props {
  onConnect: () => void;
  onAddAccount: () => void;
  onEditAccount: (id: string) => void;
}

export function AccountManager({ onConnect, onAddAccount, onEditAccount }: Props) {
  const accounts = useAccountStore((s) => s.accounts);
  const activeId = useAccountStore((s) => s.activeAccountId);
  const setActive = useAccountStore((s) => s.setActive);
  const deleteAccount = useAccountStore((s) => s.deleteAccount);
  const connect = useAccountStore((s) => s.connect);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setActive(id);
  };

  const handleConnect = (id: string) => {
    setActive(id);
    const account = accounts.find((a) => a.id === id);
    if (account?.savePassword && account.password) {
      connect(account.password);
      onConnect();
    } else {
      // Need password — go to password prompt via connect flow
      onConnect();
    }
  };

  const handleDelete = async (id: string) => {
    await deleteAccount(id);
    setConfirmDelete(null);
    if (accounts.length <= 1) {
      onAddAccount();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.emoji}>🦜</span>
          <h1 className={styles.title}>Your Accounts</h1>
          <p className={styles.subtitle}>Select an account to connect, or manage your accounts</p>
        </div>

        <div className={styles.accountList}>
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`${styles.accountItem} ${account.id === activeId ? styles.active : ''}`}
              onClick={() => handleSelect(account.id)}
            >
              <div className={styles.accountLeft}>
                <div className={styles.avatar}>
                  {account.username[0]?.toUpperCase() ?? '?'}
                </div>
                <div className={styles.accountDetails}>
                  <span className={styles.accountJid}>
                    {account.username}@{account.domain}
                  </span>
                  <span className={styles.accountMeta}>
                    {account.transport || 'tcp'} · Port {account.port || 5222}
                    {account.savePassword && ' · Password saved'}
                  </span>
                </div>
              </div>

              <div className={styles.accountActions} onClick={(e) => e.stopPropagation()}>
                <button
                  className={styles.actionBtn}
                  onClick={() => handleConnect(account.id)}
                  title="Connect"
                >
                  ▶️
                </button>
                <button
                  className={styles.actionBtn}
                  onClick={() => onEditAccount(account.id)}
                  title="Edit"
                >
                  ✏️
                </button>
                {confirmDelete === account.id ? (
                  <div className={styles.confirmDelete}>
                    <button
                      className={`${styles.actionBtn} ${styles.confirmYes}`}
                      onClick={() => handleDelete(account.id)}
                      title="Confirm delete"
                    >
                      ✅
                    </button>
                    <button
                      className={styles.actionBtn}
                      onClick={() => setConfirmDelete(null)}
                      title="Cancel"
                    >
                      ❌
                    </button>
                  </div>
                ) : (
                  <button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={() => setConfirmDelete(account.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={onAddAccount} size="lg">
            + Add Account
          </Button>
        </div>
      </div>
    </div>
  );
}
