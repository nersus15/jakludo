import React, { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon';

export function formatDuration(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Pemutar Voice Note kustom untuk chat grup dan chat private
export default function VoiceNotePlayer({ groupId, msg, token, onExpiredUrl }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(
    msg.media?.durationMs ? Math.max(1, Math.round(msg.media.durationMs / 1000)) : 0
  );
  const [useFallbackUrl, setUseFallbackUrl] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const baseStreamPath = msg.media?.streamUrl
    ? msg.media.streamUrl
    : groupId
    ? `/api/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(msg.id)}/audio`
    : `/api/dm/${encodeURIComponent(msg.id)}/audio`;

  const streamSrc = `${baseStreamPath}${
    token ? `${baseStreamPath.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : ''
  }`;
  const activeSrc = useFallbackUrl && msg.media?.url ? msg.media.url : streamSrc;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;

    const onLoaded = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setTotalSec(Math.round(el.duration));
      }
      setLoadFailed(false);
    };
    const onTime = () => {
      setCurrentSec(Math.floor(el.currentTime || 0));
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setTotalSec(Math.round(el.duration));
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentSec(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);

    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    el.addEventListener('pause', onPause);
    el.addEventListener('play', onPlay);
    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('play', onPlay);
    };
  }, [activeSrc]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    setLoadFailed(false);
    try {
      await el.play();
    } catch {
      if (!useFallbackUrl && msg.media?.url) {
        setUseFallbackUrl(true);
      } else {
        setLoadFailed(true);
        onExpiredUrl?.();
      }
    }
  };

  const onSeek = e => {
    const el = audioRef.current;
    if (!el || !totalSec) return;
    const next = Number(e.target.value);
    el.currentTime = next;
    setCurrentSec(next);
  };

  const progressPct = totalSec > 0 ? Math.min(100, Math.round((currentSec / totalSec) * 100)) : 0;

  return (
    <div className="vn-player">
      <audio
        ref={audioRef}
        src={activeSrc}
        preload="metadata"
        onError={() => {
          if (!useFallbackUrl && msg.media?.url) {
            setUseFallbackUrl(true);
          } else {
            setLoadFailed(true);
            onExpiredUrl?.();
          }
        }}
      />
      <button
        type="button"
        className="vn-player__btn"
        onClick={togglePlay}
        aria-label={playing ? 'Jeda pesan suara' : 'Putar pesan suara'}
      >
        <Icon name={playing ? 'pause' : 'play'} size={16} />
      </button>
      <div className="vn-player__track">
        <input
          type="range"
          min="0"
          max={Math.max(1, totalSec)}
          step="1"
          value={Math.min(currentSec, Math.max(1, totalSec))}
          onChange={onSeek}
          className="vn-player__slider"
          aria-label="Posisi putar pesan suara"
          style={{ '--vn-pct': `${progressPct}%` }}
        />
        <div className="vn-player__meta">
          <span className="vn-player__time">
            <Icon name="mic" size={13} />
            <span>
              {formatDuration(currentSec * 1000)} /{' '}
              {formatDuration(totalSec * 1000 || msg.media?.durationMs || 0)}
            </span>
          </span>
          {loadFailed && <span className="vn-player__err">Ketuk ulang untuk memutar</span>}
        </div>
      </div>
    </div>
  );
}

