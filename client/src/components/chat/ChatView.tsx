import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { ChatMessage } from '../../../../shared/src/messages.js';
import { useChatStore } from '../../stores/chatStore.js';
import { Avatar } from '../shared/Avatar.tsx';
import { relay } from '../../services/relay.js';
import styles from './ChatView.module.css';
import { EmojiPicker } from './EmojiPicker';

interface Props {
  /** JID or room JID */
  target: string;
  targetName: string;
  messages: ChatMessage[];
  onSend: (body: string) => void;
  isRoom?: boolean;
  participants?: string[];
  subject?: string;
  omemoEnabled?: boolean;
  onToggleOmemo?: () => void;
  onBack?: () => void;
}

export function ChatView({ target, targetName, messages, onSend, isRoom, participants, subject, omemoEnabled, onToggleOmemo, onBack }: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const { typingUsers, sendTypingState } = useChatStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // No auto-focus — let the user tap the input when ready

  const handleSend = () => {
    const body = input.trim();
    if (!body) return;
    onSend(body);
    setInput('');
    // Clear typing state on send
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    isTypingRef.current = false;
    sendTypingState(target, 'active', isRoom);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingState(target, 'composing', isRoom);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTypingState(target, 'paused', isRoom);
    }, 3000);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLoadMore = () => {
    relay.send({ type: 'history:fetch', jid: target, isRoom: !!isRoom, limit: 50 });
  };

  // Group messages by date
  const grouped = groupByDate(messages);

  return (
    <div className={styles.chatView}>
      {/* Header */}
      <div className={styles.header}>
        {onBack && (
          <button className={styles.backBtn} onClick={onBack} aria-label="Back">
            ‹
          </button>
        )}
        {isRoom ? (
          <div className={styles.headerAvatar}>#</div>
        ) : (
          <Avatar jid={target} name={targetName} size={40} />
        )}
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>{targetName}</span>
          <span className={styles.headerMeta}>
            {isRoom
              ? `${participants?.length || 0} participants${subject ? ` · ${subject}` : ''}`
              : target}
          </span>
        </div>
        {!isRoom && onToggleOmemo && (
          <button
            className={styles.omemoBtn}
            onClick={onToggleOmemo}
            title={omemoEnabled ? 'OMEMO encrypted — click to disable' : 'Click to enable OMEMO encryption'}
          >
            {omemoEnabled ? '🔒' : '🔓'}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length >= 10 && (
          <button className={styles.loadMore} onClick={handleLoadMore}>
            Load more history
          </button>
        )}
        {grouped.map(({ label, msgs }) => (
          <div key={label}>
            <div className={styles.dateLabel}><span>{label}</span></div>
            {msgs.map((msg) => (
              <div key={msg.id} className={`${styles.bubble} ${msg.mine ? styles.mine : styles.theirs}`}>
                {isRoom && !msg.mine && (
                  <span className={styles.nick}>{msg.nick}</span>
                )}
                <p className={styles.body}>{msg.body}</p>
                <span className={styles.time}>
                  {formatTime(msg.timestamp)}
                  {msg.mine && !isRoom && (
                    <span
                      className={`${styles.tick} ${msg.status === 'delivered' ? styles.tickDelivered : ''}`}
                      title={msg.status === 'delivered' ? 'Delivered' : 'Sent'}
                    >
                      {msg.status === 'delivered' ? ' ✓✓' : ' ✓'}
                    </span>
                  )}
                  {msg.encrypted && <span className={styles.encryptedBadge}>🔒</span>}
                </span>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers[target] === 'composing' && (
        <div className={styles.typingIndicator}>
          ✍️ {targetName} is typing...
        </div>
      )}

      {/* Input */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${targetName}...`}
          rows={1}
        />
        <EmojiPicker
          onSelect={(emoji) => {
            setInput((prev) => prev + emoji);
            inputRef.current?.focus();
          }}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim()}
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

// Empty state for when nothing is selected
export function EmptyChat() {
  return (
    <div className={styles.empty}>
      <img src="/logo.png" alt="Squawk" className={styles.emptyLogo} />
      <h2 className={styles.emptyTitle}>Pick a conversation</h2>
      <p className={styles.emptyText}>Select a chat, room, or contact from the sidebar</p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function groupByDate(msgs: ChatMessage[]): { label: string; msgs: ChatMessage[] }[] {
  const groups: { label: string; msgs: ChatMessage[] }[] = [];
  let currentLabel = '';

  for (const msg of msgs) {
    const label = dateLabel(msg.timestamp);
    if (label !== currentLabel) {
      groups.push({ label, msgs: [msg] });
      currentLabel = label;
    } else {
      groups[groups.length - 1].msgs.push(msg);
    }
  }
  return groups;
}

function dateLabel(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}
