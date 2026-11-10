const MAX_IMAGE_SIDE = 1600;
const MAX_AVATAR_SIDE = 512;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_DURATION_MS = 120 * 1000;

export function isAvatarUrl(val) {
  return typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/api/'));
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close?.()
      };
    } catch {
      // Lanjut ke fallback Image()
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(url)
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('File gambar tidak dapat dibaca.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), type, quality);
  });
}

// Kompres gambar di sisi klien: sisi terpanjang <= 1600px, WebP kualitas 0.75 (fallback JPEG 0.75)
export async function compressImage(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Pilih file gambar yang valid.');
  }

  const decoded = await decodeImage(file);
  try {
    const { source, width: origW, height: origH } = decoded;
    if (!origW || !origH) throw new Error('Ukuran gambar tidak valid.');

    const longest = Math.max(origW, origH);
    const scale = longest > MAX_IMAGE_SIDE ? MAX_IMAGE_SIDE / longest : 1;
    const width = Math.max(1, Math.round(origW * scale));
    const height = Math.max(1, Math.round(origH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar.');

    ctx.drawImage(source, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 'image/webp', 0.75);
    let ext = 'webp';
    if (!blob || blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.75);
      ext = 'jpg';
    }
    if (!blob) throw new Error('Gagal mengompres gambar.');
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error('Ukuran foto terlalu besar (maksimal 8 MB setelah dikompres).');
    }

    const fileName = `foto-${Date.now()}.${ext}`;
    const outFile = new File([blob], fileName, { type: blob.type || `image/${ext}` });
    return {
      file: outFile,
      width,
      height,
      size: outFile.size,
      mime: outFile.type
    };
  } finally {
    decoded.cleanup();
  }
}

// Kompres & crop persegi di sisi klien untuk foto profil (avatar <= 512x512 WebP)
export async function compressAvatar(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Pilih file gambar yang valid untuk foto profil.');
  }

  const decoded = await decodeImage(file);
  try {
    const { source, width: origW, height: origH } = decoded;
    if (!origW || !origH) throw new Error('Ukuran gambar tidak valid.');

    const cropSide = Math.min(origW, origH);
    const sx = Math.floor((origW - cropSide) / 2);
    const sy = Math.floor((origH - cropSide) / 2);
    const targetSide = Math.min(MAX_AVATAR_SIDE, cropSide);

    const canvas = document.createElement('canvas');
    canvas.width = targetSide;
    canvas.height = targetSide;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar.');

    ctx.drawImage(source, sx, sy, cropSide, cropSide, 0, 0, targetSide, targetSide);

    let blob = await canvasToBlob(canvas, 'image/webp', 0.8);
    let ext = 'webp';
    if (!blob || blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.8);
      ext = 'jpg';
    }
    if (!blob) throw new Error('Gagal mengompres foto profil.');
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error('Ukuran foto profil terlalu besar.');
    }

    const outFile = new File([blob], `avatar-${Date.now()}.${ext}`, {
      type: blob.type || `image/${ext}`
    });
    return {
      file: outFile,
      width: targetSide,
      height: targetSide,
      size: outFile.size,
      mime: outFile.type
    };
  } finally {
    decoded.cleanup();
  }
}

function pickAudioMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

// Rekam voice note dengan MediaRecorder (echoCancellation + noiseSuppression, 24 kbps, maks 2 menit)
export async function startVoiceRecording({ onMaxDuration } = {}) {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Browser kamu belum mendukung perekaman suara.');
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    });
  } catch {
    throw new Error('Izin mikrofon ditolak atau mikrofon tidak ditemukan.');
  }

  const mimeType = pickAudioMimeType();
  const options = { audioBitsPerSecond: 24000 };
  if (mimeType) options.mimeType = mimeType;

  let recorder;
  try {
    recorder = new MediaRecorder(stream, options);
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const chunks = [];
  const startedAt = Date.now();
  let stopped = false;
  let cancelled = false;
  let maxTimer = null;

  const stopTracks = () => {
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
    stream.getTracks().forEach(t => {
      try {
        t.stop();
      } catch {
        // Abaikan
      }
    });
  };

  recorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const resultPromise = new Promise((resolve, reject) => {
    recorder.onerror = () => {
      stopTracks();
      reject(new Error('Perekaman suara terhenti karena kesalahan.'));
    };

    recorder.onstop = () => {
      const durationMs = Math.min(MAX_VOICE_DURATION_MS, Math.max(500, Date.now() - startedAt));
      stopTracks();
      if (cancelled) {
        resolve(null);
        return;
      }
      const actualMime = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: actualMime });
      if (!blob.size) {
        reject(new Error('Suara tidak terekam. Coba lagi.'));
        return;
      }
      if (blob.size > MAX_AUDIO_BYTES) {
        reject(new Error('Ukuran voice note melebihi batas 5 MB.'));
        return;
      }
      const ext = actualMime.includes('mp4') ? 'm4a' : actualMime.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `suara-${Date.now()}.${ext}`, { type: actualMime });
      resolve({
        file,
        durationMs,
        size: file.size,
        mime: actualMime
      });
    };
  });

  recorder.start(250);

  maxTimer = setTimeout(() => {
    if (!stopped && recorder.state !== 'inactive') {
      stopped = true;
      onMaxDuration?.();
      try {
        recorder.stop();
      } catch {
        stopTracks();
      }
    }
  }, MAX_VOICE_DURATION_MS);

  return {
    getElapsedMs: () => Math.min(MAX_VOICE_DURATION_MS, Date.now() - startedAt),
    stop: async () => {
      if (!stopped && recorder.state !== 'inactive') {
        stopped = true;
        recorder.stop();
      }
      return resultPromise;
    },
    cancel: () => {
      cancelled = true;
      if (!stopped && recorder.state !== 'inactive') {
        stopped = true;
        try {
          recorder.stop();
        } catch {
          stopTracks();
        }
      } else {
        stopTracks();
      }
    }
  };
}

// Unggah foto atau voice note ke POST /api/groups/:id/media
export async function uploadGroupMedia({ groupId, token, file, kind, durationMs, text }) {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  if (kind === 'audio' && durationMs != null) {
    form.append('durationMs', String(Math.round(durationMs)));
  }
  const cleanText = String(text || '').trim();
  if (cleanText) {
    form.append('text', cleanText);
  }

  const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/media`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Gagal mengunggah media.');
  }
  return data.message;
}

// Unggah foto atau voice note ke chat private POST /api/friends/:userId/media
export async function uploadDirectMedia({ friendId, token, file, kind, durationMs, text }) {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  if (kind === 'audio' && durationMs != null) {
    form.append('durationMs', String(Math.round(durationMs)));
  }
  const cleanText = String(text || '').trim();
  if (cleanText) {
    form.append('text', cleanText);
  }

  const res = await fetch(`/api/friends/${encodeURIComponent(friendId)}/media`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Gagal mengunggah media.');
  }
  return data.message;
}

// Unggah & kompres foto profil (avatar) ke POST /api/auth/avatar
export async function uploadUserAvatar({ token, file }) {
  const compressed = await compressAvatar(file);
  const form = new FormData();
  form.append('file', compressed.file);

  const res = await fetch('/api/auth/avatar', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Gagal mengunggah foto profil.');
  }
  return data.user;
}

// Unggah & kompres foto profil grup (avatar grup) ke POST /api/groups/:id/avatar (khusus owner/admin)
export async function uploadGroupAvatarMedia({ groupId, token, file }) {
  const compressed = await compressAvatar(file);
  const form = new FormData();
  form.append('file', compressed.file);

  const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Gagal mengunggah foto profil grup.');
  }
  return data.group;
}
