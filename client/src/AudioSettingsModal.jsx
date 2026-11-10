import React, { useEffect, useId, useState } from 'react';
import Modal from './components/Modal';
import { sound } from './sound';
import { getNotificationPermission, notify, requestNotificationPermission } from './notifications';

const PERMISSION_LABEL = { granted: 'Diizinkan', denied: 'Diblokir', default: 'Belum dipilih', unsupported: 'Tidak didukung' };
const NOTIF_MESSAGES = {
  denied: 'Notifikasi diblokir browser. Klik ikon gembok/pengaturan situs di samping alamat web, ubah Notifikasi menjadi "Izinkan", lalu muat ulang halaman.',
  default: 'Izin notifikasi belum diberikan.',
  unsupported: 'Browser ini tidak mendukung notifikasi. Di iPhone/iPad, pasang JakLudo ke layar utama terlebih dahulu (iOS 16.4+).'
};

function VolumeControl({ id, title, description, percent, muted, onVolume, onToggleMute, extra }) {
  return (
    <section className="audio-control" aria-labelledby={`${id}-title`}>
      <div className="audio-control__head">
        <div>
          <h3 id={`${id}-title`}>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        <button type="button" className="btn btn--secondary" aria-pressed={muted} onClick={onToggleMute}>
          {muted ? 'Nyalakan' : 'Bisukan'}
        </button>
      </div>
      <div className="audio-control__slider">
        <label htmlFor={id} className="sr-only">Volume {title}</label>
        <input
          id={id}
          type="range"
          min="0"
          max="100"
          step="5"
          value={muted ? 0 : percent}
          onChange={e => onVolume(Number(e.target.value) / 100)}
          aria-valuetext={muted ? 'Dibisukan' : `${percent} persen`}
        />
        <output htmlFor={id} className="audio-control__value">{muted ? 'Mati' : `${percent}%`}</output>
      </div>
      {extra}
    </section>
  );
}

export default function AudioSettingsModal({ isOpen, onClose }) {
  const [audio, setAudio] = useState(sound.getState());
  const [notifStatus, setNotifStatus] = useState(null);
  const bgmId = useId();
  const sfxId = useId();

  useEffect(() => sound.subscribe(state => setAudio({ ...state })), []);

  const testNotification = async () => {
    sound.playClick();
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      setNotifStatus({ ok: false, text: NOTIF_MESSAGES[permission] || NOTIF_MESSAGES.denied });
      return;
    }
    const res = await notify('🔔 Tes notifikasi JakLudo', {
      body: 'Notifikasi berhasil! Kamu akan diberi tahu saat giliranmu dan saat bidak diinjak.',
      tag: 'jakludo-test',
      force: true
    });
    setNotifStatus(res.ok
      ? { ok: true, text: 'Notifikasi terkirim. Jika tidak terlihat, berarti diblokir oleh pengaturan sistem operasi (lihat petunjuk di bawah).' }
      : { ok: false, text: `Notifikasi gagal ditampilkan browser${res.error ? `: ${res.error.message}` : '.'}` });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      icon="🔊"
      title="Pengaturan suara"
      subtitle="Musik latar hanya berbunyi di dalam room."
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              sound.resetDefaults();
              sound.playJoinNotification();
            }}
          >
            Kembalikan default
          </button>
          <button type="button" className="btn btn--primary" onClick={onClose}>Selesai</button>
        </>
      }
    >
      <div className="audio-controls">
        <VolumeControl
          id={bgmId}
          title="Musik latar"
          description="Default 25%, cukup pelan agar suara permainan tetap terdengar."
          percent={Math.round(audio.bgmVolume * 100)}
          muted={audio.bgmMuted}
          onVolume={v => sound.setBgmVolume(v)}
          onToggleMute={() => sound.toggleBgmMute()}
        />
        <VolumeControl
          id={sfxId}
          title="Efek suara"
          description="Dadu, langkah bidak, makan bidak, dan perayaan finish."
          percent={Math.round(audio.sfxVolume * 100)}
          muted={audio.sfxMuted}
          onVolume={v => sound.setSfxVolume(v)}
          onToggleMute={() => sound.toggleSfxMute()}
          extra={
            <button type="button" className="btn btn--ghost audio-control__test" onClick={() => sound.playDiceLand(true)}>
              Coba suara dadu
            </button>
          }
        />
      </div>

      <section className="audio-control" aria-labelledby="notif-test-title">
        <div className="audio-control__head">
          <div>
            <h3 id="notif-test-title">Notifikasi browser</h3>
            <p className="muted">Status izin: <strong>{PERMISSION_LABEL[getNotificationPermission()]}</strong></p>
          </div>
          <button type="button" className="btn btn--secondary" onClick={testNotification}>Tes notifikasi</button>
        </div>
        {notifStatus && (
          <p className={`alert alert--${notifStatus.ok ? 'success' : 'error'}`} role="status">{notifStatus.text}</p>
        )}
        <p className="muted">
          Tidak muncul? Pastikan browser diizinkan mengirim notifikasi oleh sistem: macOS → System Settings → Notifications → (Chrome/Safari/Edge) → Allow Notifications, dan matikan mode Focus / Jangan Ganggu. Windows → Pengaturan → Sistem → Notifikasi.
        </p>
      </section>
    </Modal>
  );
}
