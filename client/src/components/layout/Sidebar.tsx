import { useState, useRef, useCallback, type TouchEvent as ReactTouchEvent } from 'react';
import { useAccountStore } from '../../stores/accountStore.tsx';
import { useRosterStore } from '../../stores/rosterStore.js';
import { useChatStore } from '../../stores/chatStore.js';
import { useMucStore } from '../../stores/mucStore.js';
import { notificationService } from '../../services/notifications.js';
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
  const leaveRoom = useMucStore((s) => s.leaveRoom);
  const mucMessages = useMucStore((s) => s.messages);

  // Notification permission state
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const handleNotifClick = useCallback(async () => {
    if (notifPermission === 'unsupported' || notifPermission === 'denied') return;
    if (notifPermission === 'granted') return;
    const granted = await notificationService.requestPermission();
    setNotifPermission(granted ? 'granted' : Notification.permission);
  }, [notifPermission]);

  // Swipe state for rooms
  const [swipedRoom, setSwipedRoom] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; id: string } | null>(null);

  const account = accounts.find((a) => a.id === activeId);

  const handleDisconnect = () => {
    disconnect();
    onDisconnect();
  };

  const handleChatSelect = (jid: string) => {
    setActiveChat(jid);
    setActiveRoom(null);
    setSwipedRoom(null);
  };

  const handleRoomSelect = (jid: string) => {
    if (swipedRoom) {
      setSwipedRoom(null);
      return;
    }
    setActiveRoom(jid);
    setActiveChat(null);
  };

  const handleLeaveRoom = (jid: string) => {
    leaveRoom(jid);
    setSwipedRoom(null);
  };

  // Touch gestures for room items
  const handleTouchStart = (e: ReactTouchEvent, id: string) => {
    touchStart.current = { x: e.touches[0].clientX, id };
  };

  const handleTouchEnd = (e: ReactTouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    if (dx < -80) {
      setSwipedRoom(touchStart.current.id);
    } else if (dx > 40) {
      setSwipedRoom(null);
    }
    touchStart.current = null;
  };

  // Sort contacts: online first
  const onlineContacts = contacts.filter((c) => c.presence.show !== 'offline');
  const offlineContacts = contacts.filter((c) => c.presence.show === 'offline');

  // Build unified "Chats" list: recent 1:1 conversations + rooms with messages, sorted by last activity
  const chatItems: { type: 'dm' | 'room'; jid: string; name: string; lastMsg: string; lastTime: string; unread: number }[] = [];

  // 1:1 conversations
  for (const [jid, msgs] of Object.entries(conversations)) {
    if (msgs.length > 0) {
      const last = msgs[msgs.length - 1];
      const contact = contacts.find((c) => c.jid === jid);
      chatItems.push({
        type: 'dm',
        jid,
        name: contact?.name || jid.split('@')[0],
        lastMsg: last.body,
        lastTime: last.timestamp,
        unread: unreadCounts[jid] || 0,
      });
    }
  }

  // Rooms with messages
  for (const [roomJid, room] of Object.entries(joinedRooms)) {
    const msgs = mucMessages[roomJid] || [];
    const last = msgs[msgs.length - 1];
    chatItems.push({
      type: 'room',
      jid: roomJid,
      name: room.name,
      lastMsg: last ? `${last.nick}: ${last.body}` : room.subject || 'No messages yet',
      lastTime: last?.timestamp || '',
      unread: room.unread || 0,
    });
  }

  // Sort by most recent
  chatItems.sort((a, b) => {
    if (!a.lastTime) return 1;
    if (!b.lastTime) return -1;
    return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
  });

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

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <aside className={styles.sidebar}>
      {/* Account header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <img src="/logo.png" alt="Squawk" className={styles.logo} />
          <span className={styles.brand}>Squawk</span>
          {notifPermission !== 'unsupported' && (
            <button
              className={`${styles.notifBtn} ${notifPermission === 'granted' ? styles.notifGranted : notifPermission === 'denied' ? styles.notifDenied : ''}`}
              onClick={handleNotifClick}
              title={
                notifPermission === 'granted'
                  ? 'Notifications enabled'
                  : notifPermission === 'denied'
                  ? 'Notifications blocked — allow in browser settings'
                  : 'Enable notifications'
              }
            >
              {notifPermission === 'granted' ? '🔔' : '🔕'}
            </button>
          )}
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
        {/* ── Chats tab ──────────────────────────────── */}
        {tab === 'chats' && (
          <div className={styles.list}>
            {chatItems.length === 0 && (
              <div className={styles.empty}>
                <span>💬</span>
                <p>No conversations yet</p>
                <p className={styles.emptyHint}>Start chatting from Contacts or join a Room</p>
              </div>
            )}
            {chatItems.map((item) => {
              const isActive = item.type === 'dm' ? activeChat === item.jid : activeRoom === item.jid;
              return (
                <button
                  key={item.jid}
                  className={`${styles.listItem} ${isActive ? styles.active : ''}`}
                  onClick={() => item.type === 'dm' ? handleChatSelect(item.jid) : handleRoomSelect(item.jid)}
                >
                  <div
                    className={styles.itemAvatar}
                    style={item.type === 'room' ? { background: 'linear-gradient(135deg, var(--sq-accent-green), var(--sq-accent-teal))' } : undefined}
                  >
                    {item.type === 'room' ? '#' : item.name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className={styles.itemContent}>
                    <div className={styles.itemTopRow}>
                      <span className={styles.itemName}>{item.name}</span>
                      <span className={styles.itemTime}>{formatTime(item.lastTime)}</span>
                    </div>
                    <div className={styles.itemBottomRow}>
                      <span className={styles.itemPreview}>{item.lastMsg}</span>
                      {item.unread > 0 && <span className={styles.badge}>{item.unread}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Rooms tab ──────────────────────────────── */}
        {tab === 'rooms' && (
          <div className={styles.list}>
            {Object.values(joinedRooms).length === 0 && (
              <div className={styles.empty}>
                <span>🏠</span>
                <p>No rooms joined</p>
              </div>
            )}
            {Object.values(joinedRooms).map((room) => (
              <div
                key={room.jid}
                className={`${styles.roomRow} ${swipedRoom === room.jid ? styles.roomSwiped : ''}`}
                onTouchStart={(e) => handleTouchStart(e, room.jid)}
                onTouchEnd={handleTouchEnd}
              >
                <div
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
                  <span
                    className={styles.roomArrow}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSwipedRoom(swipedRoom === room.jid ? null : room.jid);
                    }}
                    title="More options"
                  >
                    ›
                  </span>
                </div>

                {/* Swipe / arrow revealed action */}
                <div className={styles.roomActions}>
                  <button
                    className={styles.leaveBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLeaveRoom(room.jid);
                    }}
                  >
                    Leave
                  </button>
                </div>
              </div>
            ))}
            <button className={styles.browseBtn} onClick={onBrowseRooms}>
              🔍 Browse Rooms
            </button>
          </div>
        )}

        {/* ── Contacts tab ───────────────────────────── */}
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
