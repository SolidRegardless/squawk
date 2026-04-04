import { useState, useRef, type TouchEvent } from 'react';
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
  const setActive = useAccountStore((s) => s.setActive);
  const deleteAccount = useAccountStore((s) => s.deleteAccount);
  const connect = useAccountStore((s) => s.connect);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; id: string } | null>(null);

  const handleSelect = (id: string) => {
    if (swipedId) {
      setSwipedId(null);
      return;
    }
    setActive(id);
    const account = accounts.find((a) => a.id === id);
    if (account?.savePassword && account.password) {
      connect(account.password);
    }
    onConnect();
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onEditAccount(id);
  };

  const handleDeletePrompt = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteTarget(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteAccount(deleteTarget);
    setDeleteTarget(null);
    if (accounts.length <= 1) {
      onAddAccount();
    }
  };

  // Swipe gestures
  const handleTouchStart = (e: TouchEvent, id: string) => {
    touchStart.current = { x: e.touches[0].clientX, id };
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    if (dx < -80) {
      // Swipe left — reveal actions
      setSwipedId(touchStart.current.id);
    } else if (dx > 40) {
      // Swipe right — close actions
      setSwipedId(null);
    }
    touchStart.current = null;
  };

  const deleteAccountObj = deleteTarget ? accounts.find((a) => a.id === deleteTarget) : null;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.emoji}>🦜</span>
          <h1 className={styles.title}>Your Accounts</h1>
          <p className={styles.subtitle}>Tap an account to connect</p>
        </div>

        <div className={styles.accountList}>
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`${styles.accountRow} ${swipedId === account.id ? styles.swiped : ''}`}
              onTouchStart={(e) => handleTouchStart(e, account.id)}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className={styles.accountItem}
                onClick={() => handleSelect(account.id)}
              >
                <div className={styles.avatar}>
                  {account.username[0]?.toUpperCase() ?? '?'}
                </div>
                <div className={styles.accountDetails}>
                  <span className={styles.accountJid}>
                    {account.username}
                    <span className={styles.accountDomainInline}>@{account.domain}</span>
                  </span>
                  <span className={styles.accountMeta}>
                    {account.savePassword ? 'Auto-connect' : 'Password required'}
                    {account.resource ? ` · ${account.resource}` : ''}
                  </span>
                </div>
                <span className={styles.connectArrow}>›</span>
              </div>

              {/* Swipe-revealed actions (mobile) */}
              <div className={styles.swipeActions}>
                <button
                  className={styles.swipeEdit}
                  onClick={(e) => handleEdit(e, account.id)}
                >
                  Edit
                </button>
                <button
                  className={styles.swipeDelete}
                  onClick={(e) => handleDeletePrompt(e, account.id)}
                >
                  Delete
                </button>
              </div>

              {/* Context menu dots (desktop) */}
              <div className={styles.contextMenu}>
                <button
                  className={styles.menuDot}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSwipedId(swipedId === account.id ? null : account.id);
                  }}
                  title="More options"
                >
                  •••
                </button>
                {swipedId === account.id && (
                  <div className={styles.dropdown}>
                    <button
                      className={styles.dropdownItem}
                      onClick={(e) => handleEdit(e, account.id)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className={`${styles.dropdownItem} ${styles.dropdownDanger}`}
                      onClick={(e) => handleDeletePrompt(e, account.id)}
                    >
                      🗑 Delete
                    </button>
                  </div>
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

      {/* Delete confirmation dialog */}
      {deleteTarget && deleteAccountObj && (
        <div className={styles.overlay} onClick={() => setDeleteTarget(null)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <span className={styles.dialogEmoji}>🗑</span>
            <h2 className={styles.dialogTitle}>Delete Account?</h2>
            <p className={styles.dialogText}>
              Remove <strong>{deleteAccountObj.username}@{deleteAccountObj.domain}</strong>?
              This can't be undone.
            </p>
            <div className={styles.dialogActions}>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
