import { useState } from 'react';
import { useAccountStore } from '../../stores/accountStore.tsx';
import { useRosterStore } from '../../stores/rosterStore.js';
import { useChatStore } from '../../stores/chatStore.js';
import { useMucStore } from '../../stores/mucStore.js';
import { PresenceSelector } from '../shared/PresenceSelector.tsx';
import styles from './Sidebar.module.css';

type Tab = 'chats' | 'rooms' | 'contacts';

interface Props {
  onDisconnect: () => void;
  onBrowseRooms: () => void;
}

export function Sidebar({ onDisconnect, onBrowseRooms }: Props) {
  const [tab, setTab] = useState<Tab>('chats');
  const accounts = useAccountStore((s) => s.accounts);
  const activeId = useAccountStore((s) => s.activeAccountId);
  const disconnect = useAccountStore((s) => s.disconnect);
  const contacts = useRosterStore((s) => s.contacts);
  const conversations = useChatStore((s) => s.conversations);
  const activeChat = useChatStore((s) => s.activeChat);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const joinedRooms = useMucStore((s) => s.joinedRooms);
  const activeRoom = useMucStore((s) => s.activeRoom);
  const setActiveRoom = useMucStore((s) => s.setActiveRoom);

  const account = accounts.find((a) => a.id === activeId);

  const handleDisconnect = () => {
    disconnect();
    onDisconnect();
  };

  const handleChatSelect = (jid: string) => {
    setActiveChat(jid);
    setActiveRoom(null);
  };

  const handleRoomSelect = (jid: string) => {
    setActiveRoom(jid);
    setActiveChat(null);
  };

  // Sort contacts: online first
  const onlineContacts = contacts.filter((c) => c.presence.show !== 'offline');
  const offlineContacts = contacts.filter((c) => c.presence.show === 'offline');

  // Recent chats: conversations with last message
  const recentChats = Object.entries(conversations)
    .filter(([_, msgs]) => msgs.length > 0)
    .map(([jid, msgs]) => ({ jid, lastMsg: msgs[msgs.length - 1], unread: unreadCounts[jid] || 0 }))
    .sort((a, b) => new Date(b.lastMsg.timestamp).getTime() - new Date(a.lastMsg.timestamp).getTime());

  const presenceDot = (show: string) => {
    const colors: Record<string, string> = {
      chat: 'var(--sq-accent-green)',
      away: 'var(--sq-accent-orange)',
      xa: 'var(--sq-accent-orange)',
      dnd: 'var(--sq-accent-coral)',
      offline: 'var(--sq-text-disabled)',
    };
    return colors[show] || colors.offline;
  };

  return (
    <aside className={styles.sidebar}>
      {/* Account header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.logo}>🦜</span>
          <span className={styles.brand}>Squawk</span>
        </div>
        <div className={styles.accountRow}>
          <div className={styles.accountInfo}>
            <span className={styles.accountName}>{account?.username}</span>
            <span className={styles.accountDomain}>@{account?.domain}</span>
          </div>
          <PresenceSelector />
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['chats', 'rooms', 'contacts'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.activeTab : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'chats' && '💬'}
            {t === 'rooms' && '🏠'}
            {t === 'contacts' && '👤'}
            <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.content}>
        {tab === 'chats' && (
          <div className={styles.list}>
            {recentChats.length === 0 && (
              <div className={styles.empty}>
                <span>💬</span>
                <p>No conversations yet</p>
              </div>
            )}
            {recentChats.map(({ jid, lastMsg, unread }) => (
              <button
                key={jid}
                className={`${styles.listItem} ${activeChat === jid ? styles.active : ''}`}
                onClick={() => handleChatSelect(jid)}
              >
                <div className={styles.itemAvatar}>
                  {(lastMsg.nick || jid.split('@')[0])[0]?.toUpperCase()}
                </div>
                <div className={styles.itemContent}>
                  <span className={styles.itemName}>{jid.split('@')[0]}</span>
                  <span className={styles.itemPreview}>{lastMsg.body}</span>
                </div>
                {unread > 0 && <span className={styles.badge}>{unread}</span>}
              </button>
            ))}
          </div>
        )}

        {tab === 'rooms' && (
          <div className={styles.list}>
            {Object.values(joinedRooms).map((room) => (
              <button
                key={room.jid}
                className={`${styles.listItem} ${activeRoom === room.jid ? styles.active : ''}`}
                onClick={() => handleRoomSelect(room.jid)}
              >
                <div className={styles.itemAvatar} style={{ background: 'linear-gradient(135deg, var(--sq-accent-green), var(--sq-accent-teal))' }}>
                  #
                </div>
                <div className={styles.itemContent}>
                  <span className={styles.itemName}>{room.name}</span>
                  <span className={styles.itemPreview}>
                    {room.participants.length} participant{room.participants.length !== 1 ? 's' : ''}
                    {room.subject ? ` · ${room.subject}` : ''}
                  </span>
                </div>
                {room.unread > 0 && <span className={styles.badge}>{room.unread}</span>}
              </button>
            ))}
            <button className={styles.browseBtn} onClick={onBrowseRooms}>
              🔍 Browse Rooms
            </button>
          </div>
        )}

        {tab === 'contacts' && (
          <div className={styles.list}>
            {onlineContacts.length > 0 && (
              <>
                <div className={styles.groupHeader}>Online — {onlineContacts.length}</div>
                {onlineContacts.map((c) => (
                  <button
                    key={c.jid}
                    className={`${styles.listItem} ${activeChat === c.jid ? styles.active : ''}`}
                    onClick={() => handleChatSelect(c.jid)}
                  >
                    <div className={styles.contactAvatar}>
                      {(c.name || c.jid)[0]?.toUpperCase()}
                      <span className={styles.presenceDot} style={{ background: presenceDot(c.presence.show) }} />
                    </div>
                    <div className={styles.itemContent}>
                      <span className={styles.itemName}>{c.name || c.jid.split('@')[0]}</span>
                      <span className={styles.itemPreview}>{c.presence.status || c.presence.show}</span>
                    </div>
                  </button>
                ))}
              </>
            )}
            {offlineContacts.length > 0 && (
              <>
                <div className={styles.groupHeader}>Offline — {offlineContacts.length}</div>
                {offlineContacts.map((c) => (
                  <button
                    key={c.jid}
                    className={`${styles.listItem} ${styles.offline} ${activeChat === c.jid ? styles.active : ''}`}
                    onClick={() => handleChatSelect(c.jid)}
                  >
                    <div className={styles.contactAvatar}>
                      {(c.name || c.jid)[0]?.toUpperCase()}
                      <span className={styles.presenceDot} style={{ background: presenceDot('offline') }} />
                    </div>
                    <div className={styles.itemContent}>
                      <span className={styles.itemName}>{c.name || c.jid.split('@')[0]}</span>
                    </div>
                  </button>
                ))}
              </>
            )}
            {contacts.length === 0 && (
              <div className={styles.empty}>
                <span>👤</span>
                <p>No contacts in roster</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button className={styles.footerBtn} onClick={handleDisconnect}>
          Disconnect
        </button>
      </div>
    </aside>
  );
}
