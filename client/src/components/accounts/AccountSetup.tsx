import { useState, useEffect, type FormEvent } from 'react';
import { useAccountStore } from '../../stores/accountStore.tsx';
import { Input } from '../shared/Input.tsx';
import { Button } from '../shared/Button.tsx';
import { Toggle } from '../shared/Toggle.tsx';
import styles from './AccountSetup.module.css';

interface Props {
  onCreated: () => void;
  onCancel?: () => void;
  /** If provided, we're editing this account */
  editAccountId?: string | null;
}

export function AccountSetup({ onCreated, onCancel, editAccountId }: Props) {
  const createAccount = useAccountStore((s) => s.createAccount);
  const updateAccount = useAccountStore((s) => s.updateAccount);
  const connect = useAccountStore((s) => s.connect);
  const accounts = useAccountStore((s) => s.accounts);
  const setActive = useAccountStore((s) => s.setActive);

  const editAccount = editAccountId ? accounts.find((a) => a.id === editAccountId) : null;
  const isEditing = !!editAccount;

  const [username, setUsername] = useState('');
  const [domain, setDomain] = useState('');
  const [resource, setResource] = useState('');
  const [password, setPassword] = useState('');
  const [savePassword, setSavePassword] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [port, setPort] = useState('5222');
  const [transport, setTransport] = useState<'tcp' | 'websocket' | 'bosh'>('tcp');
  const [requireEncryption, setRequireEncryption] = useState(true);
  const [connectServer, setConnectServer] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form when editing
  useEffect(() => {
    if (editAccount) {
      setUsername(editAccount.username);
      setDomain(editAccount.domain);
      setResource(editAccount.resource || '');
      setPassword(editAccount.password || '');
      setSavePassword(editAccount.savePassword);
      setPort(String(editAccount.port || 5222));
      setTransport(editAccount.transport || 'tcp');
      setRequireEncryption(editAccount.security !== 'allow-plaintext' && editAccount.security !== 'none');
      setConnectServer(editAccount.connectServer || '');
      if (editAccount.resource || editAccount.transport !== 'tcp' || editAccount.connectServer) {
        setShowAdvanced(true);
      }
    }
  }, [editAccount]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = 'Username is required';
    if (!domain.trim()) errs.domain = 'Domain is required';
    else if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain.trim())) {
      errs.domain = 'Enter a valid domain (e.g. goonfleet.com)';
    }
    if (!password && !isEditing) errs.password = 'Password is required to connect';
    if (port && isNaN(Number(port))) errs.port = 'Port must be a number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const accountData = {
        protocol: 'xmpp' as const,
        username: username.trim(),
        domain: domain.trim(),
        resource: resource.trim() || undefined,
        savePassword,
        password: password || undefined,
        transport,
        port: port ? Number(port) : undefined,
        security: requireEncryption ? 'require-tls' as const : 'allow-plaintext' as const,
        connectServer: connectServer.trim() || undefined,
      };

      if (isEditing && editAccountId) {
        await updateAccount(editAccountId, {
          ...accountData,
          password: savePassword ? (password || editAccount?.password) : undefined,
        });
        setActive(editAccountId);
      } else {
        await createAccount({
          ...accountData,
          password: password,
        });
      }

      connect(password || editAccount?.password);
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
          <h1 className={styles.title}>
            {isEditing ? 'Edit Account' : 'Welcome to Squawk'}
          </h1>
          <p className={styles.subtitle}>
            {isEditing
              ? `Editing ${editAccount?.username}@${editAccount?.domain}`
              : 'Set up your XMPP account to get started'}
          </p>
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
            placeholder={isEditing ? '(unchanged)' : '••••••••'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
            required={!isEditing}
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

              <div className={styles.selectField}>
                <label className={styles.selectLabel}>Connection Type</label>
                <select
                  className={styles.select}
                  value={transport}
                  onChange={(e) => {
                    const t = e.target.value as 'tcp' | 'websocket' | 'bosh';
                    setTransport(t);
                    if (t === 'tcp' && port === '5281') setPort('5222');
                    if (t !== 'tcp' && port === '5222') setPort('5281');
                  }}
                >
                  <option value="tcp">Standard XMPP (TCP)</option>
                  <option value="websocket">WebSocket</option>
                  <option value="bosh">BOSH (HTTP)</option>
                </select>
                <span className={styles.selectHint}>
                  {transport === 'tcp' && 'Standard — works with most servers (port 5222)'}
                  {transport === 'websocket' && 'Modern — requires server WebSocket support'}
                  {transport === 'bosh' && 'Legacy HTTP binding — broadest browser compat'}
                </span>
              </div>

              <Input
                label="Port"
                placeholder={transport === 'tcp' ? '5222' : '5281'}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                error={errors.port}
                hint={`Default: ${transport === 'tcp' ? '5222' : '5281'}`}
              />

              <Toggle
                label="Require encryption (TLS)"
                checked={requireEncryption}
                onChange={setRequireEncryption}
              />

              <Input
                label="Connect Server"
                placeholder="Same as domain"
                value={connectServer}
                onChange={(e) => setConnectServer(e.target.value)}
                hint="Only set if the server hostname differs from the domain"
              />
            </div>
          )}

          {errors.form && (
            <p className={styles.formError}>{errors.form}</p>
          )}

          <div className={styles.formActions}>
            {onCancel && (
              <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" size="lg" loading={saving}>
              {isEditing ? 'Save & Connect' : 'Connect'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
