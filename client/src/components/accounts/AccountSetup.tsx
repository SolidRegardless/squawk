import { useState, type FormEvent } from 'react';
import { useAccountStore } from '../../stores/accountStore.tsx';
import { Input } from '../shared/Input.tsx';
import { Button } from '../shared/Button.tsx';
import { Toggle } from '../shared/Toggle.tsx';
import styles from './AccountSetup.module.css';

interface Props {
  onCreated: () => void;
}

export function AccountSetup({ onCreated }: Props) {
  const createAccount = useAccountStore((s) => s.createAccount);
  const connect = useAccountStore((s) => s.connect);

  const [username, setUsername] = useState('');
  const [domain, setDomain] = useState('');
  const [resource, setResource] = useState('');
  const [password, setPassword] = useState('');
  const [savePassword, setSavePassword] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = 'Username is required';
    if (!domain.trim()) errs.domain = 'Domain is required';
    else if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain.trim())) {
      errs.domain = 'Enter a valid domain (e.g. goonfleet.com)';
    }
    if (!password) errs.password = 'Password is required to connect';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await createAccount({
        protocol: 'xmpp',
        username: username.trim(),
        domain: domain.trim(),
        resource: resource.trim() || undefined,
        savePassword,
        password,
      });
      connect(password);
      onCreated();
    } catch (err) {
      setErrors({ form: 'Failed to save account. Try again.' });
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.emoji}>🦜</span>
          <h1 className={styles.title}>Welcome to Squawk</h1>
          <p className={styles.subtitle}>Set up your XMPP account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.protocol}>
            <span className={styles.protocolBadge}>XMPP</span>
            <span className={styles.protocolHint}>Jabber / XMPP Protocol</span>
          </div>

          <Input
            label="Username"
            placeholder="your_name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={errors.username}
            autoFocus
            autoComplete="username"
            required
          />

          <Input
            label="Domain"
            placeholder="goonfleet.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            error={errors.domain}
            hint="The XMPP server domain"
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
            required
          />

          <Toggle
            label="Save password"
            checked={savePassword}
            onChange={setSavePassword}
          />

          <button
            type="button"
            className={styles.advancedToggle}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▾' : '▸'} Advanced
          </button>

          {showAdvanced && (
            <div className={`${styles.advanced} sq-animate-in`}>
              <Input
                label="Resource"
                placeholder="squawk-web (auto-generated if empty)"
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                hint="Identifies this device/client. Leave blank for auto."
              />
            </div>
          )}

          {errors.form && (
            <p className={styles.formError}>{errors.form}</p>
          )}

          <Button type="submit" size="lg" loading={saving}>
            Connect
          </Button>
        </form>
      </div>
    </div>
  );
}
