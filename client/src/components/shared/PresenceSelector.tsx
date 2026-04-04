import { useState, useRef, useEffect } from 'react';
import { relay } from '../../services/relay.js';
import styles from './PresenceSelector.module.css';

const PRESENCE_OPTIONS = [
  { show: 'chat', label: 'Online', color: 'var(--sq-accent-green)', emoji: '🟢' },
  { show: 'away', label: 'Away', color: 'var(--sq-accent-orange)', emoji: '🟡' },
  { show: 'dnd', label: 'Do Not Disturb', color: 'var(--sq-accent-coral)', emoji: '🔴' },
  { show: 'xa', label: 'Invisible', color: 'var(--sq-text-disabled)', emoji: '⚪' },
] as const;

export function PresenceSelector() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>('chat');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (show: string) => {
    setCurrent(show);
    setOpen(false);
    relay.send({ type: 'presence:set', show: show as any });
  };

  const active = PRESENCE_OPTIONS.find((o) => o.show === current) || PRESENCE_OPTIONS[0];

  return (
    <div className={styles.container} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(!open)} title={active.label}>
        <span className={styles.dot} style={{ background: active.color }} />
        <span className={styles.label}>{active.label}</span>
        <span className={styles.caret}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          {PRESENCE_OPTIONS.map((opt) => (
            <button
              key={opt.show}
              className={`${styles.option} ${current === opt.show ? styles.selected : ''}`}
              onClick={() => handleSelect(opt.show)}
            >
              <span className={styles.dot} style={{ background: opt.color }} />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
