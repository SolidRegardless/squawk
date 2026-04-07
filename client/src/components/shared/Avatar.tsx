import type { CSSProperties } from 'react';
import { useRosterStore } from '../../stores/rosterStore.js';

interface Props {
  jid: string;
  name: string;
  size?: number;
}

export function Avatar({ jid, name, size = 38 }: Props) {
  const dataUrl = useRosterStore((s) => s.avatars[jid]);

  if (dataUrl) {
    return (
      <img
        src={dataUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }

  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--sq-blue-deep), var(--sq-accent-primary))',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.floor(size * 0.4),
    fontWeight: 800,
    flexShrink: 0,
  };

  return <div style={style}>{name[0]?.toUpperCase() ?? '?'}</div>;
}
