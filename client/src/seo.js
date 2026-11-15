// Utilitas SEO dinamis untuk memperbarui judul halaman, meta description, Open Graph,
// tag hreflang global, serta sinkronisasi URL parameter (?game=...) di PlayGo.

const SEO_CONFIGS = {
  hub: {
    title: 'PlayGo · Free Online Multiplayer Browser Games (JakLudo, Chess Master, Snakes & Ladders, Monster Quiz)',
    description:
      'Play free real-time multiplayer browser games with friends worldwide on PlayGo! Enjoy JakLudo (2–4 players), Chess Master (Elo rated online chess), Snakes and Ladders, and Monster Quiz Battle RPG instantly with no download.',
    image: '/playgo-logo.jpg',
    query: ''
  },
  ludo: {
    title: 'Play JakLudo Online (2–4 Player Multiplayer Ludo) · PlayGo',
    description:
      'Play real-time 2–4 player Ludo online free in your browser on PlayGo! Black Hole traps, strategic items (Force Return & Shield), custom skins, friend rooms, and global leaderboard.',
    image: '/playgo-logo.jpg',
    query: '?game=jakludo'
  },
  quiz: {
    title: 'Monster Quiz Battle (2–3 Player Online RPG Trivia) · PlayGo',
    description:
      'Challenge friends worldwide in Monster Quiz Battle RPG on PlayGo! Answer general knowledge & math questions in 15s, use 50:50 Answer Hints, battle monsters, and earn PlayGo Coins.',
    image: '/playgo-logo.jpg',
    query: '?game=monster-quiz'
  },
  chess: {
    title: 'Chess Master (Play Online Multiplayer Chess & Elo Rating) · PlayGo',
    description:
      'Master the board and play free online multiplayer chess worldwide on PlayGo! Official Elo ratings, Bullet, Blitz & Rapid clocks, Private Rooms, AI Bot practice, and PGN move analysis.',
    image: '/playgo-logo.jpg',
    query: '?game=chess-master'
  },
  snakes: {
    title: 'Snakes and Ladders Online Multiplayer (Ular Tangga 100 Tiles) · PlayGo',
    description:
      'Play classic Snakes and Ladders (Ular Tangga) online multiplayer free on PlayGo! Roll the dice across 100 tiles with Smart Matchmaking, Private Rooms, AI opponents, and global rankings.',
    image: '/playgo-logo.jpg',
    query: '?game=snakes-and-ladders'
  },
  shop: {
    title: 'PlayGo Marketplace · Ludo Skins, Strategy Items & Top-Up Shop',
    description:
      'Explore the PlayGo Marketplace! Unlock exclusive JakLudo pawn skins, buy 50:50 Answer Hints, Shield, and Force Return items, or convert Coins into Diamonds.',
    image: '/playgo-logo.jpg'
  },
  leaderboard: {
    title: 'Global Leaderboard · JakLudo, Chess Elo, Snakes & Quiz | PlayGo',
    description:
      'View PlayGo worldwide global rankings across JakLudo, Chess Master Elo, Snakes and Ladders, and Monster Quiz Battle.',
    image: '/playgo-logo.jpg'
  },
  friends: {
    title: 'Friends & Private Chat · PlayGo Global Multiplayer',
    description:
      'Add friends worldwide, send real-time private messages, and invite players directly to JakLudo, Chess Master, Snakes and Ladders, or Monster Quiz rooms.',
    image: '/playgo-logo.jpg'
  },
  groups: {
    title: 'Gaming Groups & Voice/Media Chat · PlayGo Multiplayer',
    description:
      'Create multiplayer gaming groups on PlayGo, share voice notes and photos, and launch group matches instantly in the browser.',
    image: '/playgo-logo.jpg'
  }
};

function setMetaTag(selector, attr, value) {
  if (typeof document === 'undefined' || !value) return;
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

export function getInitialGameModeFromUrl() {
  if (typeof window === 'undefined') return 'hub';
  const params = new URLSearchParams(window.location.search);
  const game = String(params.get('game') || '').toLowerCase();
  if (game === 'jakludo' || game === 'ludo') return 'ludo';
  if (game === 'monster-quiz' || game === 'quiz') return 'quiz';
  if (game === 'chess-master' || game === 'chess') return 'chess';
  if (game === 'snakes-and-ladders' || game === 'snakes' || game === 'ular-tangga') return 'snakes';
  return 'hub';
}

// URL halaman untuk mode game tertentu (dipakai riwayat navigasi agar tombol Back browser bekerja)
export function gameModeUrl(gameMode = 'hub') {
  const cfg = SEO_CONFIGS[gameMode] || SEO_CONFIGS.hub;
  return `${window.location.pathname}${cfg.query || ''}${window.location.hash || ''}`;
}

export function applySeo({ gameMode = 'hub', modal = null, roomCode = null }) {
  if (typeof document === 'undefined') return;

  const key = modal && SEO_CONFIGS[modal] ? modal : SEO_CONFIGS[gameMode] ? gameMode : 'hub';
  const cfg = SEO_CONFIGS[key] || SEO_CONFIGS.hub;

  let title = cfg.title;
  if (roomCode && (gameMode === 'ludo' || gameMode === 'quiz' || gameMode === 'chess' || gameMode === 'snakes')) {
    const gameLabel =
      gameMode === 'quiz'
        ? 'Monster Quiz Battle'
        : gameMode === 'chess'
        ? 'Chess Master'
        : gameMode === 'snakes'
        ? 'Ular Tangga'
        : 'JakLudo';
    title = `Room ${roomCode} · ${gameLabel} — PlayGo`;
  }

  document.title = title;
  setMetaTag('meta[name="description"]', 'content', cfg.description);
  setMetaTag('meta[property="og:title"]', 'content', title);
  setMetaTag('meta[property="og:description"]', 'content', cfg.description);
  setMetaTag('meta[name="twitter:title"]', 'content', title);
  setMetaTag('meta[name="twitter:description"]', 'content', cfg.description);

  if (typeof window !== 'undefined' && window.history?.replaceState) {
    const modeCfg = SEO_CONFIGS[gameMode] || SEO_CONFIGS.hub;
    const baseSearch = modeCfg.query || '';
    const currentParams = new URLSearchParams(window.location.search || '');
    const hlParam = (currentParams.get('hl') || currentParams.get('lang') || '').toLowerCase();
    const validHl = hlParam === 'en' || hlParam === 'id' ? hlParam : '';
    const sep = baseSearch ? '&' : '?';
    const targetSearch = validHl ? `${baseSearch}${sep}hl=${validHl}` : baseSearch;
    const currentSearch = window.location.search || '';
    if (
      (currentSearch === '' || currentSearch.startsWith('?game=') || currentSearch.startsWith('?hl=')) &&
      currentSearch !== targetSearch
    ) {
      const nextUrl = `${window.location.pathname}${targetSearch}${window.location.hash || ''}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    }
    const basePageUrl = `${window.location.origin}${window.location.pathname}${baseSearch}`;
    const canonicalUrl = `${window.location.origin}${window.location.pathname}${targetSearch}`;
    setMetaTag('link[rel="canonical"]', 'href', canonicalUrl);
    setMetaTag('link[rel="alternate"][hreflang="x-default"]', 'href', basePageUrl);
    setMetaTag('link[rel="alternate"][hreflang="en"]', 'href', `${basePageUrl}${sep}hl=en`);
    setMetaTag('link[rel="alternate"][hreflang="id"]', 'href', `${basePageUrl}${sep}hl=id`);
    setMetaTag('meta[property="og:url"]', 'content', canonicalUrl);
  }
}

