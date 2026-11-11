import React, { useEffect, useState } from 'react';
import Icon from './Icon';
import { isAvatarUrl } from '../social/media';

// Render avatar pemain secara konsisten (foto S3 jika tersedia, fallback ke inisial / ikon jika gagal muat)
export default function PlayerAvatar({
  avatar,
  name = '',
  size = 36,
  className = 'avatar',
  imgClassName = 'avatar--img',
  fallback = null
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [avatar]);

  if (isAvatarUrl(avatar) && !failed) {
    return (
      <img
        src={avatar}
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
      {fallback ?? (name ? name.slice(0, 1).toUpperCase() : <Icon name="pawn" size={Math.round(size * 0.45)} />)}
    </span>
  );
}

