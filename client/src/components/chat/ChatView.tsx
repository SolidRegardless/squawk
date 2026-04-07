import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { ChatMessage } from '../../../../shared/src/messages.js';
import { Avatar } from '../shared/Avatar.tsx';
import styles from './ChatView.module.css';

interface Props {
  /** JID or room JID */
  target: string;
  targetName: string;
  messages: ChatMessage[];
  onSend: (body: string) => void;
  isRoom?: boolean;
  participants?: string[];
  subject?: string;
}

export function ChatView({ target, targetName, messages, onSend, isRoom, participants, subject }: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [target]);

  const handleSend = () => {
    const body = input.trim();
    if (!body) return;
    onSend(body);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const grouped = groupByDate(messages);

  return (
    <div className={styles.chatView}>
      {/* Header */}
      <div className={styles.header}>
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
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {grouped.map(({ label, msgs }) => (
          <div key={label}>
            <div className={styles.dateLabel}><span>{label}</span></div>
            {msgs.map((msg) => (
              <div key={msg.id} className={`${styles.bubble} ${msg.mine ? styles.mine : styles.theirs}`}>
                {isRoom && !msg.mine && (
                  <span className={styles.nick}>{msg.nick}</span>
                )}
                <p className={styles.body}>{msg.body}</p>
                <span className={styles.time}>{formatTime(msg.timestamp)}</span>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${targetName}...`}
          rows={1}
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
