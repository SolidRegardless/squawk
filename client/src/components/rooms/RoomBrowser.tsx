import { useState, useEffect } from 'react';
import { useMucStore } from '../../stores/mucStore.js';
import { useAccountStore } from '../../stores/accountStore.tsx';
import { Button } from '../shared/Button.tsx';
import styles from './RoomBrowser.module.css';

interface Props {
  onClose: () => void;
}

export function RoomBrowser({ onClose }: Props) {
  const conferenceServer = useMucStore((s) => s.conferenceServer);
  const setConferenceServer = useMucStore((s) => s.setConferenceServer);
  const availableRooms = useMucStore((s) => s.availableRooms);
  const joinedRooms = useMucStore((s) => s.joinedRooms);
  const listRooms = useMucStore((s) => s.listRooms);
  const joinRoom = useMucStore((s) => s.joinRoom);
  const loading = useMucStore((s) => s.loading);
  const error = useMucStore((s) => s.error);
  const clearError = useMucStore((s) => s.clearError);
  const accounts = useAccountStore((s) => s.accounts);
  const activeId = useAccountStore((s) => s.activeAccountId);

  const account = accounts.find((a) => a.id === activeId);
  const nick = account?.username || 'squawk';

  const [search, setSearch] = useState('');
  const [server, setServer] = useState(conferenceServer);

  useEffect(() => {
    if (server) {
      listRooms(server);
    }
  }, []);

  const handleSearch = () => {
    if (server) {
      setConferenceServer(server);
      listRooms(server);
    }
  };

  const handleJoin = (roomJid: string) => {
    joinRoom(roomJid, nick);
  };

  const filtered = availableRooms.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.jid.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>🔍 Browse Rooms</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.serverRow}>
          <div className={styles.serverInput}>
            <label className={styles.serverLabel} htmlFor="conference-server">
              Conference Server
            </label>
            <input
              id="conference-server"
              className={styles.serverInputField}
              placeholder={`conference.${account?.domain || 'your_domain.com'}`}
              value={server}
              onChange={(e) => setServer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className={styles.fetchBtnWrap}>
            <Button onClick={handleSearch} loading={loading} size="sm">
              Fetch
            </Button>
          </div>
        </div>

        {error && (
          <div className={styles.errorToast}>
            <span>❌ {error}</span>
            <button className={styles.errorClose} onClick={clearError}>✕</button>
          </div>
        )}

        {availableRooms.length > 0 && (
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              placeholder="Filter rooms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        <div className={styles.roomList}>
          {loading && (
            <div className={styles.loading}>
              <span>🦜</span> Loading rooms...
            </div>
          )}

          {!loading && filtered.length === 0 && availableRooms.length === 0 && (
            <div className={styles.empty}>
              <span>🏠</span>
              <p>No rooms found. Check the conference server address.</p>
            </div>
          )}

          {!loading && filtered.length === 0 && availableRooms.length > 0 && (
            <div className={styles.empty}>
              <p>No rooms match "{search}"</p>
            </div>
          )}

          {filtered.map((room) => {
            const isJoined = !!joinedRooms[room.jid];
            return (
              <div key={room.jid} className={`${styles.roomItem} ${isJoined ? styles.joined : ''}`}>
                <div className={styles.roomInfo}>
                  <span className={styles.roomName}>{room.name}</span>
                  <span className={styles.roomJid}>{room.jid}</span>
                </div>
                <Button
                  size="sm"
                  variant={isJoined ? 'secondary' : 'primary'}
                  onClick={() => !isJoined && handleJoin(room.jid)}
                  disabled={isJoined}
                >
                  {isJoined ? 'Joined' : 'Join'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
