import React, { useEffect, useState } from 'react';
import Icon from './Icon';
import { isAvatarUrl } from '../social/media';

// Render avatar pemain secara konsisten (foto S3 jika tersedia, fallback ke inisial / ikon jika gagal muat)
export default function PlayerAvatar({
  avatar,
  name = '',
  player = null,
  size = 36,
  className = 'avatar',
  imgClassName = 'avatar--img',
  fallback = null
}) {
  const actualAvatar = avatar ?? player?.avatar;
  const actualName = name || player?.name || '';
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [actualAvatar]);

  if (isAvatarUrl(actualAvatar) && !failed) {
    return (
      <img
        src={actualAvatar}
        alt=""
        width={size}
        height={size}
        className={`${className} ${imgClassName}`.trim()}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={className} aria-hidden="true">
      {fallback ?? (actualName ? actualName.slice(0, 1).toUpperCase() : <Icon name="pawn" size={Math.round(size * 0.45)} />)}
    </span>
  );
}

