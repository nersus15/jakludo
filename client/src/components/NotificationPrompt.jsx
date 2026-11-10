import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { sound } from '../sound';
import { getNotificationPermission, notify, requestNotificationPermission } from '../notifications';

const DISMISS_KEY = 'jakludo_notif_prompt_dismissed';

// Pop up di landing page yang mengajak pemain mengizinkan notifikasi browser.
// Muncul selama izin belum diputuskan; "Nanti saja" hanya menyembunyikan untuk sesi tab ini.
export default function NotificationPrompt({ enabled }) {
  const [permission, setPermission] = useState(getNotificationPermission);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [ready, setReady] = useState(false);

  // Beri jeda sebentar agar pop up tidak menimpa halaman yang baru tampil
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(timer);
  }, []);

  const close = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // sessionStorage diblokir: cukup sembunyikan di state
    }
  };

  const allow = async () => {
    sound.playClick();
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      notify('🔔 Notifikasi JakLudo aktif', {
        body: 'Kamu akan diberi tahu saat giliran mengocok dadu dan saat ada bidak yang diinjak.',
        tag: 'jakludo-welcome',
        force: true
      });
      close();
    }
  };

  const isOpen = enabled && ready && !dismissed && (permission === 'default' || permission === 'denied');

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="sm"
      icon="🔔"
      title="Aktifkan notifikasi"
      footer={
        permission === 'denied' ? (
          <button type="button" className="btn btn--primary" onClick={close}>Mengerti</button>
        ) : (
          <>
            <button type="button" className="btn btn--secondary" onClick={close}>Nanti saja</button>
            <button type="button" className="btn btn--primary" onClick={allow}>Izinkan notifikasi</button>
          </>
        )
      }
    >
      <p>Silahkan allow notifikasi web browser anda untuk pengalaman bermain yang interaktif.</p>
      {permission === 'denied' ? (
        <p className="alert alert--error" role="alert">
          Notifikasi sedang diblokir. Buka pengaturan situs (ikon gembok di samping alamat web), lalu ubah izin Notifikasi menjadi "Izinkan".
        </p>
      ) : (
        <p className="muted">Kamu akan diberi tahu saat giliran mengocok dadu dan saat ada bidak yang diinjak, walaupun sedang membuka tab lain.</p>
      )}
    </Modal>
  );
}
