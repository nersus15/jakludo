import React from 'react';
import Icon from '../components/Icon';
import jakludoLogo from '../assets/jakludo-logo.webp';

const COLORS = ['red', 'green', 'yellow', 'blue'];

function ActiveRoomCard({ room, onJoin }) {
  const humans = room.players.filter(p => !p.isBot);
  const bots = room.players.length - humans.length;
  const online = humans.filter(p => p.connected).length;
  return (
    <article className="active-room card">
      <div className="active-room__info">
        <span className={`dot color-${room.myColor}`} style={{ background: 'var(--pc)' }} aria-hidden="true" />
        <div>
          <strong>{room.started ? 'Permainan masih berjalan' : 'Ruang tunggu masih terbuka'}</strong>
          <p className="muted">
            Room <span className="code-text">{room.code}</span>
            {room.isCreator ? ' · buatanmu' : ''} · {humans.length} pemain{bots ? ` + ${bots} bot` : ''} · {online} online
          </p>
        </div>
      </div>
      <button type="button" className="btn btn--primary" onClick={() => onJoin(room.code)}>
        {room.started ? 'Lanjutkan main' : 'Masuk lagi'}
      </button>
    </article>
  );
}

export default function HomeScreen({
  user,
  checkingAuth,
  code,
  error,
  activeRooms,
  isInstalled,
  actions,
  friendBadgeCount = 0,
  groupBadgeCount = 0,
  onOpenFriends,
  onOpenGroups,
  onOpenAuth,
  onOpenLeaderboard,
  onInstall
}) {
  return (
    <main className="home" id="main">
      <section className="home__hero">
        <div className="home__intro">
          <h1 className="home__title">
            Main Ludo bareng teman, <span className="home__title-accent">langsung dari HP.</span>
          </h1>
          <p className="home__lead">
            Buat room, bagikan kodenya, dan main sampai empat orang secara realtime. Ada zona aman, mode Black Hole, item toko, dan perebutan gelar Ludo King.
          </p>
          <ul className="color-strip" aria-hidden="true">
            {COLORS.map(c => <li key={c} className={`color-${c}`} />)}
          </ul>
        </div>
        <figure className="home__art">
          <img src={jakludoLogo} alt="Logo JakLudo: dadu, bidak Ludo, dan Monas" width="720" height="480" fetchpriority="high" />
        </figure>
      </section>

      <section className="home__play" aria-label="Mulai bermain">
        {activeRooms.length > 0 && (
          <div className="active-rooms">
            {activeRooms.map(r => <ActiveRoomCard key={r.code} room={r} onJoin={actions.joinRoom} />)}
          </div>
        )}

        <div className="play-card card card--focus">
          {checkingAuth ? (
            <p className="play-card__loading" role="status">
              <span className="spinner" aria-hidden="true" /> Memeriksa sesi login...
            </p>
          ) : user ? (
            <>
              <h2 className="play-card__title">Mulai permainan</h2>
              <button type="button" className="btn btn--primary btn--lg btn--block" onClick={actions.createRoom}>
                Buat room baru
              </button>
              <div className="divider"><span>atau gabung pakai kode</span></div>
              <form
                className="join-form"
                onSubmit={e => {
                  e.preventDefault();
                  actions.joinRoom();
                }}
              >
                <label htmlFor="room-code" className="sr-only">Kode room</label>
                <input
                  id="room-code"
                  className="input code-input"
                  value={code}
                  onChange={e => actions.setCode(e.target.value.toUpperCase())}
                  placeholder="Kode room, mis. AB12C"
                  maxLength={5}
                  autoComplete="off"
                  autoCapitalize="characters"
                />
                <button type="submit" className="btn btn--secondary">Gabung</button>
              </form>
            </>
          ) : (
            <>
              <h2 className="play-card__title">Masuk untuk bermain</h2>
              <p className="muted">Akun dipakai untuk menyimpan poin, item toko, dan posisimu di peringkat.</p>
              <button type="button" className="btn btn--primary btn--lg btn--block" onClick={onOpenAuth}>
                Masuk atau daftar
              </button>
            </>
          )}
          {error && <p className="alert alert--error" role="alert">{error}</p>}
        </div>

        <div className="home__links">
          {onOpenFriends && (
            <button type="button" className="link-card card" onClick={onOpenFriends}>
              <span className="link-card__icon" aria-hidden="true">
                <Icon name="friends" size={24} />
              </span>
              <span>
                <strong className="link-card__head">
                  Teman
                  {friendBadgeCount > 0 && (
                    <span className="badge badge--brand">{friendBadgeCount} baru</span>
                  )}
                </strong>
                <span className="muted">Tambah teman dan lihat siapa yang online</span>
              </span>
            </button>
          )}
          {onOpenGroups && (
            <button type="button" className="link-card card" onClick={onOpenGroups}>
              <span className="link-card__icon" aria-hidden="true">
                <Icon name="chat" size={24} />
              </span>
              <span>
                <strong className="link-card__head">
                  Grup & Chat
                  {groupBadgeCount > 0 && (
                    <span className="badge badge--brand">{groupBadgeCount} undangan</span>
                  )}
                </strong>
                <span className="muted">Obrolan grup, foto, voice note, dan Match Grup</span>
              </span>
            </button>
          )}
          <button type="button" className="link-card card" onClick={onOpenLeaderboard}>
            <span className="link-card__icon" aria-hidden="true">
              <Icon name="trophy" size={24} />
            </span>
            <span>
              <strong>Peringkat pemain</strong>
              <span className="muted">Lihat siapa Ludo King saat ini</span>
            </span>
          </button>
          {!isInstalled && (
            <button type="button" className="link-card card" onClick={onInstall}>
              <span className="link-card__icon" aria-hidden="true">
                <Icon name="install" size={24} />
              </span>
              <span>
                <strong>Pasang di layar utama</strong>
                <span className="muted">Buka JakLudo layar penuh tanpa bilah browser</span>
              </span>
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
