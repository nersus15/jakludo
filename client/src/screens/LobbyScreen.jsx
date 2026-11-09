import React, { useState } from 'react';
import { sound } from '../sound';

function shareInvite(room) {
  const url = `${location.origin}${location.pathname}?room=${room.code}`;
  return { url, text: `Ayo main JakLudo! Kode room: ${room.code}` };
}

// Di HP pakai menu bagikan bawaan; selain itu salin ke clipboard (dengan cadangan untuk http/in-app browser)
async function copyOrShare(room) {
  const { url, text } = shareInvite(room);
  if (navigator.share && /android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ title: 'JakLudo', text, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }
  const input = document.createElement('textarea');
  input.value = url;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand('copy');
  input.remove();
  if (!ok) throw new Error('copy failed');
  return 'copied';
}

function PlayerSlot({ player, index, playerId }) {
  if (!player) {
    return (
      <li className="slot slot--empty">
        <span className="avatar" aria-hidden="true">+</span>
        <span>
          <strong>Kursi kosong</strong>
          <span className="muted">Menunggu pemain {index + 1}</span>
        </span>
      </li>
    );
  }
  const role = player.isBot ? 'Bot komputer' : player.username ? `@${player.username}` : 'Tamu';
  return (
    <li className={`slot color-${player.color} ${player.connected === false && !player.isBot ? 'slot--offline' : ''}`}>
      <span className="avatar" aria-hidden="true">{player.name.slice(0, 1).toUpperCase()}</span>
      <span className="slot__text">
        <strong className="slot__name">
          {player.name}
          {player.id === playerId && <span className="badge">Kamu</span>}
          {player.isHost && <span className="badge badge--brand">Host</span>}
          {player.isLudoKing && <span className="badge badge--warning">👑 King</span>}
        </strong>
        <span className="muted">{role}</span>
      </span>
      <span className={`slot__status ${player.connected === false && !player.isBot ? 'is-offline' : ''}`}>
        {player.connected === false && !player.isBot ? 'Terputus' : 'Siap'}
      </span>
    </li>
  );
}

export default function LobbyScreen({ room, me, playerId, error, actions }) {
  const [copyState, setCopyState] = useState('');
  const safeZones = room.settings?.safeZones !== false;
  const blackHole = !!room.settings?.blackHole;
  const blackHoleMode = room.settings?.blackHoleMode === 'random' ? 'random' : 'static';
  const count = room.players.length;
  const isHost = !!me?.isHost;

  const onShare = async () => {
    sound.playClick();
    try {
      const result = await copyOrShare(room);
      if (result === 'copied') {
        setCopyState('Link undangan tersalin');
        setTimeout(() => setCopyState(''), 2000);
      }
    } catch {
      setCopyState('Gagal menyalin. Salin link dari bilah alamat browser.');
    }
  };

  return (
    <main className="lobby" id="main">
      <section className="lobby__code card card--focus">
        <p className="muted">Kode room</p>
        <p className="lobby__code-value code-text" aria-label={`Kode room ${room.code.split('').join(' ')}`}>{room.code}</p>
        <p className="muted lobby__code-hint">Bagikan kode atau link ini ke teman. Maksimal 4 pemain.</p>
        <button type="button" className="btn btn--primary btn--block" onClick={onShare}>
          Bagikan link undangan
        </button>
        <p className="lobby__copy-state" role="status">{copyState}</p>
      </section>

      <section className="lobby__players card" aria-labelledby="players-title">
        <div className="section-head">
          <h2 id="players-title">Pemain</h2>
          <span className="badge">{count} / 4</span>
        </div>
        <ul className="slots">
          {[0, 1, 2, 3].map(i => <PlayerSlot key={i} index={i} player={room.players[i]} playerId={playerId} />)}
        </ul>
        {isHost && (
          <div className="lobby__bots">
            {count < 4 && (
              <button type="button" className="btn btn--secondary" onClick={actions.addBot}>Tambah bot</button>
            )}
            {room.players.some(p => p.isBot) && (
              <button type="button" className="btn btn--ghost" onClick={actions.removeBot}>Hapus bot</button>
            )}
          </div>
        )}
      </section>

      <section className="lobby__settings card" aria-labelledby="settings-title">
        <h2 id="settings-title">Aturan room</h2>
        <div className="setting">
          <div>
            <strong>Zona aman</strong>
            <p className="muted">{safeZones ? 'Bidak di petak bintang tidak bisa dimakan.' : 'Semua petak bisa dimakan (hardcore).'}</p>
          </div>
          {isHost ? (
            <button type="button" className="switch" role="switch" aria-checked={safeZones} aria-label="Zona aman" onClick={actions.toggleSafeZones}>
              <span className="switch__thumb" />
            </button>
          ) : (
            <span className={`badge ${safeZones ? 'badge--success' : ''}`}>{safeZones ? 'Aktif' : 'Nonaktif'}</span>
          )}
        </div>
        <div className="setting">
          <div>
            <strong>Black Hole 🕳️</strong>
            <p className="muted">{blackHole ? 'Bidak yang mendarat di lubang hitam kembali ke markas.' : 'Lubang hitam tidak dipakai.'}</p>
          </div>
          {isHost ? (
            <button type="button" className="switch" role="switch" aria-checked={blackHole} aria-label="Black Hole" onClick={actions.toggleBlackHole}>
              <span className="switch__thumb" />
            </button>
          ) : (
            <span className={`badge ${blackHole ? 'badge--warning' : ''}`}>{blackHole ? 'Aktif' : 'Nonaktif'}</span>
          )}
        </div>
        {blackHole && (
          <fieldset className="setting setting--sub" disabled={!isHost}>
            <legend className="setting__legend">Lokasi Black Hole</legend>
            <div className="segmented" role="radiogroup" aria-label="Lokasi Black Hole">
              {[
                { value: 'static', label: 'Tetap' },
                { value: 'random', label: 'Acak' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={blackHoleMode === opt.value}
                  className="segmented__option"
                  onClick={() => isHost && blackHoleMode !== opt.value && actions.setBlackHoleMode(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="muted setting__hint">
              {blackHoleMode === 'random'
                ? 'Acak: setiap satu putaran, tiap lubang pindah ke petak kosong lain di garisnya.'
                : 'Tetap: empat lubang di petak yang sama sepanjang permainan.'}
            </p>
          </fieldset>
        )}
        <p className="setting__note muted">Kotak start hanya aman bagi warnanya sendiri. Bidak warna lain yang singgah di sana bisa dimakan.</p>
      </section>

      <section className="lobby__start">
        {error && <p className="alert alert--error" role="alert">{error}</p>}
        {isHost ? (
          <>
            <button type="button" className="btn btn--primary btn--lg btn--block" disabled={count < 2} onClick={actions.startGame}>
              Mulai permainan
            </button>
            {count < 2 && <p className="muted lobby__hint">Butuh minimal 2 pemain. Tambahkan bot atau tunggu teman.</p>}
          </>
        ) : (
          <p className="lobby__waiting" role="status">Menunggu host memulai permainan...</p>
        )}
        <button type="button" className="btn btn--ghost btn--block" onClick={actions.leaveRoom}>Keluar dari room</button>
      </section>
    </main>
  );
}
