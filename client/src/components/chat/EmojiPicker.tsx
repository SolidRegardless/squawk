import { useState, useEffect, useRef } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import styles from './ChatView.module.css';

interface Props {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={wrapperRef} className={styles.emojiWrapper}>
      <button
        type="button"
        className={styles.emojiBtn}
        onClick={() => setOpen((v) => !v)}
        title="Emoji"
        aria-label="Open emoji picker"
      >
        😊
      </button>
      {open && (
        <div className={styles.emojiPopup}>
          <Picker
            data={data}
            theme="light"
            onEmojiSelect={(emoji: { native: string }) => {
              onSelect(emoji.native);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
