// Helper untuk membagikan link room permainan (JakLudo, Monster Quiz, Chess Master, Ular Tangga)
export function buildRoomShareData({ game, roomCode }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const cleanCode = String(roomCode || '').trim().toUpperCase();

  let gameParam = 'ludo';
  let gameTitle = 'JakLudo';
  let inviteText = `Ayo main JakLudo bareng aku di PlayGo! Masuk room: ${cleanCode}`;

  const g = String(game || '').toLowerCase();
  if (g === 'quiz' || g === 'monster-quiz') {
    gameParam = 'quiz';
    gameTitle = 'Monster Quiz Battle';
    inviteText = `Ayo tanding Monster Quiz Battle bareng aku di PlayGo! Masuk room: ${cleanCode}`;
  } else if (g === 'chess' || g === 'chess-master') {
    gameParam = 'chess';
    gameTitle = 'Chess Master';
    inviteText = `Ayo duel Catur (Chess Master) bareng aku di PlayGo! Masuk room: ${cleanCode}`;
  } else if (g === 'snakes' || g === 'snakes-and-ladders' || g === 'ular-tangga') {
    gameParam = 'snakes';
    gameTitle = 'Ular Tangga';
    inviteText = `Ayo main Ular Tangga bareng aku di PlayGo! Masuk room: ${cleanCode}`;
  }

  const url = `${origin}${pathname}?game=${gameParam}&room=${cleanCode}`;
  return {
    url,
    title: `PlayGo · ${gameTitle}`,
    text: `${inviteText}\n${url}`
  };
}

export async function copyOrShareRoom({ game, roomCode }) {
  const { url, title, text } = buildRoomShareData({ game, roomCode });

  // Di perangkat seluler (Android / iOS), prioritaskan menu Bagikan (Web Share API)
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    /android|iphone|ipad|ipod/i.test(navigator.userAgent)
  ) {
    try {
      await navigator.share({ title, text, url });
      return { status: 'shared', url };
    } catch (err) {
      if (err?.name === 'AbortError') return { status: 'cancelled', url };
    }
  }

  // Fallback ke Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return { status: 'copied', url };
    } catch {}
  }

  // Fallback textarea jika clipboard API diblokir
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      if (ok) return { status: 'copied', url };
    } catch {}
  }

  return { status: 'failed', url };
}
