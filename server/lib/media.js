// Kompresi & validasi media di sisi server sebelum diunggah ke MinIO:
// - Foto: di-decode & dikompres ulang menggunakan sharp -> WebP (maks 1600px, kualitas 75, tanpa EXIF)
// - Voice note: dikompres ulang menggunakan ffmpeg -> Opus/WebM mono 24 kbps (maks 120 detik),
//   dengan fallback validasi magic-bytes jika binary ffmpeg tidak tersedia di mesin dev lokal.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const sharp = require('sharp');

const MAX_IMAGE_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_AUDIO_INPUT_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_AUDIO_DURATION_MS = 120_000;         // 2 menit
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_WEBP_QUALITY = 75;

function resolveFfmpegBin() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  for (const candidate of ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'ffmpeg';
}

async function compressImage(inputBuffer) {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new Error('File gambar kosong atau tidak valid.');
  }
  if (inputBuffer.length > MAX_IMAGE_INPUT_BYTES) {
    throw new Error('Ukuran gambar terlalu besar (maksimal 8 MB).');
  }

  let metadata;
  try {
    metadata = await sharp(inputBuffer, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new Error('Format gambar tidak dikenali atau rusak.');
  }

  const allowedFormats = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif']);
  if (!metadata?.format || !allowedFormats.has(metadata.format)) {
    throw new Error('Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.');
  }

  const { data, info } = await sharp(inputBuffer, { limitInputPixels: 40_000_000 })
    .rotate() // otomatis sesuaikan orientasi EXIF lalu buang metadata EXIF
    .resize({
      width: IMAGE_MAX_DIMENSION,
      height: IMAGE_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: IMAGE_WEBP_QUALITY, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    mime: 'image/webp',
    ext: 'webp',
    width: info.width || null,
    height: info.height || null
  };
}

function detectAudioContainer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  // WebM / Matroska: 1A 45 DF A3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { mime: 'audio/webm', ext: 'webm' };
  }
  // Ogg: "OggS"
  if (buf.slice(0, 4).toString('ascii') === 'OggS') {
    return { mime: 'audio/ogg', ext: 'ogg' };
  }
  // MP4 / M4A: "ftyp" pada byte 4..8
  if (buf.slice(4, 8).toString('ascii') === 'ftyp') {
    return { mime: 'audio/mp4', ext: 'm4a' };
  }
  // WAV: "RIFF"...."WAVE"
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WAVE') {
    return { mime: 'audio/wav', ext: 'wav' };
  }
  // MP3: "ID3" atau sync word FF FB / FF F3 / FF F2
  if (buf.slice(0, 3).toString('ascii') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
    return { mime: 'audio/mpeg', ext: 'mp3' };
  }
  return null;
}

function transcodeWithFfmpeg(inputBuffer, inputExt, target = 'mp3') {
  return new Promise((resolve, reject) => {
    const tmpId = crypto.randomBytes(8).toString('hex');
    const outExt = target === 'webm' ? 'webm' : 'mp3';
    const outMime = target === 'webm' ? 'audio/webm' : 'audio/mpeg';
    const inFile = path.join(os.tmpdir(), `jakludo-vn-in-${tmpId}.${inputExt}`);
    const outFile = path.join(os.tmpdir(), `jakludo-vn-out-${tmpId}.${outExt}`);

    const cleanup = () => {
      fs.rmSync(inFile, { force: true });
      fs.rmSync(outFile, { force: true });
    };

    try {
      fs.writeFileSync(inFile, inputBuffer);
    } catch (err) {
      cleanup();
      return reject(err);
    }

    const codecArgs = target === 'webm'
      ? ['-c:a', 'libopus', '-b:a', '24k', '-vbr', 'on', '-application', 'voip']
      : ['-c:a', 'libmp3lame', '-b:a', '32k', '-write_xing', '1'];

    const args = [
      '-y',
      '-i', inFile,
      '-vn',
      '-ac', '1',
      '-ar', '24000',
      '-t', '120',
      ...codecArgs,
      outFile
    ];

    const proc = spawn(resolveFfmpegBin(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += String(d); });

    proc.on('error', err => {
      cleanup();
      reject(err);
    });

    proc.on('close', code => {
      if (code !== 0 || !fs.existsSync(outFile)) {
        cleanup();
        return reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-200)}`));
      }
      try {
        const outBuf = fs.readFileSync(outFile);
        cleanup();
        resolve({ buffer: outBuf, mime: outMime, ext: outExt });
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  });
}

async function compressAudio(inputBuffer, durationMs = null) {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new Error('File voice note kosong atau tidak valid.');
  }
  if (inputBuffer.length > MAX_AUDIO_INPUT_BYTES) {
    throw new Error('Ukuran voice note terlalu besar (maksimal 5 MB).');
  }

  const cleanDuration = durationMs !== null && durationMs !== undefined && Number.isFinite(Number(durationMs))
    ? Math.max(0, Math.round(Number(durationMs)))
    : null;
  if (cleanDuration !== null && cleanDuration > MAX_AUDIO_DURATION_MS + 2000) {
    throw new Error('Durasi voice note maksimal 2 menit.');
  }

  const detected = detectAudioContainer(inputBuffer);
  if (!detected) {
    throw new Error('Format audio tidak dikenali. Gunakan rekaman suara dari aplikasi.');
  }

  // Konversi ke MP3 mono 32kbps agar 100% kompatibel di Safari macOS/iOS, Chrome, dan Firefox
  try {
    const transcoded = await transcodeWithFfmpeg(inputBuffer, detected.ext, 'mp3');
    return {
      ...transcoded,
      durationMs: cleanDuration
    };
  } catch {
    try {
      const transcodedWebm = await transcodeWithFfmpeg(inputBuffer, detected.ext, 'webm');
      return {
        ...transcodedWebm,
        durationMs: cleanDuration
      };
    } catch {
      return {
        buffer: inputBuffer,
        mime: detected.mime,
        ext: detected.ext,
        durationMs: cleanDuration
      };
    }
  }
}

// Konversi buffer audio lama (.webm/.ogg) dari MinIO ke MP3 agar selalu bisa diputar semua browser
async function ensurePlayableAudio(inputBuffer, currentMime = '') {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    return { buffer: inputBuffer, mime: currentMime || 'audio/mpeg' };
  }
  const detected = detectAudioContainer(inputBuffer);
  if (detected?.ext === 'mp3') {
    return { buffer: inputBuffer, mime: 'audio/mpeg' };
  }
  try {
    const transcoded = await transcodeWithFfmpeg(inputBuffer, detected?.ext || 'webm', 'mp3');
    return { buffer: transcoded.buffer, mime: 'audio/mpeg' };
  } catch {
    return { buffer: inputBuffer, mime: detected?.mime || currentMime || 'audio/webm' };
  }
}

module.exports = {
  MAX_IMAGE_INPUT_BYTES,
  MAX_AUDIO_INPUT_BYTES,
  MAX_AUDIO_DURATION_MS,
  compressImage,
  compressAudio,
  ensurePlayableAudio,
  detectAudioContainer
};
