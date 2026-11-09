import React, { useEffect, useId, useRef, useState } from 'react';

const QUICK_CHATS = ['Semangat! 🔥', 'GG! 👏', 'Ampun bang! 😂', 'Jangan makan bidakku! 😭', 'Maju terus! 🚀'];

// Obrolan room: dipakai di panel samping (desktop) dan bottom sheet (HP)
export default function ChatPanel({ chats, playerId, onSend, autoFocus = false }) {
  const [text, setText] = useState('');
  const inputId = useId();
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Gulir daftar pesan saja (bukan seluruh halaman) ke pesan terbaru
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [chats]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const submit = e => {
    e.preventDefault();
    if (onSend(text)) setText('');
  };

  return (
    <div className="chat">
      <ol className="chat__list" ref={listRef} aria-label="Pesan obrolan">
        {chats.length === 0 ? (
          <li className="chat__empty muted">Belum ada obrolan. Sapa teman bermainmu!</li>
        ) : (
          chats.map(msg => {
            const mine = msg.senderId === playerId;
            return (
              <li key={msg.id} className={`chat__msg color-${msg.senderColor} ${mine ? 'is-mine' : ''}`}>
                <span className="chat__meta">
                  <strong className="chat__sender">{mine ? 'Kamu' : msg.senderName}</strong>
                  <span className="muted">{msg.time}</span>
                </span>
                <span className="chat__bubble">{msg.text}</span>
              </li>
            );
          })
        )}
      </ol>

      <div className="chat__quick" role="group" aria-label="Pesan cepat">
        {QUICK_CHATS.map(q => (
          <button key={q} type="button" className="chip" onClick={() => onSend(q)}>{q}</button>
        ))}
      </div>

      <form className="chat__form" onSubmit={submit}>
        <label htmlFor={inputId} className="sr-only">Tulis pesan</label>
        <input
          id={inputId}
          ref={inputRef}
          className="input"
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={140}
          placeholder="Tulis pesan..."
          autoComplete="off"
        />
        <button type="submit" className="btn btn--primary" disabled={!text.trim()}>Kirim</button>
      </form>
    </div>
  );
}
