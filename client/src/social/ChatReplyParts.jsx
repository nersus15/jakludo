import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon';

/** Format ringkasan pesan untuk target balasan di banner preview. */
export function buildSocialReplyTarget(msg, fallbackSender = 'Anggota') {
  if (!msg?.id) return null;
  let preview = String(msg.text || '').trim().slice(0, 120);
  if (!preview) {
    if (msg.type === 'image') preview = '📷 Foto';
    else if (msg.type === 'audio') preview = '🎤 Voice note';
    else if (msg.type === 'match') preview = '🎲 Match Grup';
  }
  return {
    id: msg.id,
    senderId: msg.sender?.userId || msg.senderId || null,
    senderName: msg.sender?.name || fallbackSender,
    text: preview
  };
}

/** State helper untuk fitur reply bubble & scroll highlight di chat grup maupun private. */
export function useSocialChatReply(inputRef) {
  const [replyTarget, setReplyTarget] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const itemRefs = useRef(new Map());
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const registerItemRef = useCallback((id, el) => {
    if (!id) return;
    const key = String(id);
    if (el) itemRefs.current.set(key, el);
    else itemRefs.current.delete(key);
  }, []);

  const startReply = useCallback(
    (msg, fallbackSender) => {
      const target = buildSocialReplyTarget(msg, fallbackSender);
      if (!target) return;
      setReplyTarget(target);
      inputRef?.current?.focus();
    },
    [inputRef]
  );

  const clearReply = useCallback(() => {
    setReplyTarget(null);
    inputRef?.current?.focus();
  }, [inputRef]);

  const jumpToMessage = useCallback(targetId => {
    if (!targetId) return;
    const node = itemRefs.current.get(String(targetId));
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setHighlightedId(targetId);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHighlightedId(null), 1400);
  }, []);

  return {
    replyTarget,
    setReplyTarget,
    highlightedId,
    registerItemRef,
    startReply,
    clearReply,
    jumpToMessage
  };
}

export function ChatReplyButton({ senderName, onClick }) {
  return (
    <button
      type="button"
      className="gmsg__reply-btn"
      onClick={onClick}
      aria-label={`Balas pesan dari ${senderName}`}
      title="Balas pesan ini"
    >
      <Icon name="reply" size={14} />
    </button>
  );
}

export function ChatReplyQuote({ replyTo, currentUserId, onJump }) {
  if (!replyTo) return null;
  const senderId = replyTo.sender?.userId || null;
  const senderName =
    currentUserId && senderId === currentUserId ? 'Kamu' : replyTo.sender?.name || 'Anggota';
  return (
    <button
      type="button"
      className="gmsg__quote"
      onClick={() => onJump?.(replyTo.id)}
      title="Lihat pesan yang dibalas"
    >
      <strong className="gmsg__quote-sender">{senderName}</strong>
      <span className="gmsg__quote-text">{replyTo.text || '...'}</span>
    </button>
  );
}

export function ChatReplyBanner({ replyTarget, currentUserId, onCancel }) {
  if (!replyTarget) return null;
  const senderName =
    currentUserId && replyTarget.senderId === currentUserId ? 'Kamu' : replyTarget.senderName;
  return (
    <div className="gmsg__reply-bar" role="status">
      <div className="gmsg__reply-info">
        <span className="gmsg__reply-label">
          Membalas <strong>{senderName}</strong>
        </span>
        <span className="gmsg__reply-snippet">{replyTarget.text}</span>
      </div>
      <button
        type="button"
        className="gmsg__reply-cancel"
        onClick={onCancel}
        aria-label="Batalkan balasan"
        title="Batalkan balasan"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

