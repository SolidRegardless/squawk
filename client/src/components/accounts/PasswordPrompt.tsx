import { useState, type FormEvent } from 'react';
import { useAccountStore } from '../../stores/accountStore.tsx';
import { Input } from '../shared/Input.tsx';
import { Button } from '../shared/Button.tsx';
import styles from './PasswordPrompt.module.css';

interface Props {
  onSubmit: () => void;
}

export function PasswordPrompt({ onSubmit }: Props) {
  const accounts = useAccountStore((s) => s.accounts);
  const activeId = useAccountStore((s) => s.activeAccountId);
  const connect = useAccountStore((s) => s.connect);

  const account = accounts.find((a) => a.id === activeId);

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }
    connect(password);
    onSubmit();
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <span className={styles.emoji}>🔐</span>
        <h2 className={styles.title}>Welcome back</h2>
        <p className={styles.subtitle}>
          Enter your password for{' '}
          <strong>{account?.username}@{account?.domain}</strong>
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            autoFocus
            autoComplete="current-password"
            required
          />
          <Button type="submit" size="lg">
            Connect
          </Button>
        </form>
      </div>
    </div>
  );
}
