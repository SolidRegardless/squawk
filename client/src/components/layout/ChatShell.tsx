import { useEffect, useState } from 'react';
import { useAccountStore } from '../../stores/accountStore.tsx';
import { useRosterStore } from '../../stores/rosterStore.js';
import { useChatStore } from '../../stores/chatStore.js';
import { useMucStore } from '../../stores/mucStore.js';
import { Sidebar } from './Sidebar.tsx';
import { ChatView, EmptyChat } from '../chat/ChatView.tsx';
import { RoomBrowser } from '../rooms/RoomBrowser.tsx';
import styles from './ChatShell.module.css';

interface Props {
  onDisconnect: () => void;
}

export function ChatShell({ onDisconnect }: Props) {
  const accounts = useAccountStore((s) => s.accounts);
  const activeId = useAccountStore((s) => s.activeAccountId);
  const account = accounts.find((a) => a.id === activeId);

  const contacts = useRosterStore((s) => s.contacts);
  const rosterInit = useRosterStore((s) => s.init);

  const activeChat = useChatStore((s) => s.activeChat);
  const conversations = useChatStore((s) => s.conversations);
  const sendChatMessage = useChatStore((s) => s.sendMessage);
  const chatInit = useChatStore((s) => s.init);

  const activeRoom = useMucStore((s) => s.activeRoom);
  const joinedRooms = useMucStore((s) => s.joinedRooms);
  const mucMessages = useMucStore((s) => s.messages);
  const sendMucMessage = useMucStore((s) => s.sendMessage);
  const mucInit = useMucStore((s) => s.init);

  const [showRoomBrowser, setShowRoomBrowser] = useState(false);

  // Init stores
  useEffect(() => {
    const unsubs = [
      rosterInit(),
      chatInit(),
      mucInit(account?.domain || ''),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Determine active view
  const hasActiveChat = !!activeChat;
  const hasActiveRoom = !!activeRoom;

  let chatContent;

  if (hasActiveRoom && joinedRooms[activeRoom!]) {
    const room = joinedRooms[activeRoom!];
    chatContent = (
      <ChatView
        target={activeRoom!}
        targetName={room.name}
        messages={mucMessages[activeRoom!] || []}
        onSend={(body) => sendMucMessage(activeRoom!, body)}
        isRoom
        participants={room.participants}
        subject={room.subject}
      />
    );
  } else if (hasActiveChat) {
    const contact = contacts.find((c) => c.jid === activeChat);
    chatContent = (
      <ChatView
        target={activeChat!}
        targetName={contact?.name || activeChat!.split('@')[0]}
        messages={conversations[activeChat!] || []}
        onSend={(body) => sendChatMessage(activeChat!, body)}
      />
    );
  } else {
    chatContent = <EmptyChat />;
  }

  return (
    <div className={styles.shell}>
      <Sidebar
        onDisconnect={onDisconnect}
        onBrowseRooms={() => setShowRoomBrowser(true)}
      />
      <main className={styles.main}>
        {chatContent}
      </main>
      {showRoomBrowser && (
        <RoomBrowser onClose={() => setShowRoomBrowser(false)} />
      )}
    </div>
  );
}
