import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import { sound } from '../sound';
import { getNotificationPermission, notify, requestNotificationPermission } from '../notifications';

// Pop up di landing page yang mewajibkan pemain mengizinkan notifikasi browser sebelum bermain.
// Backdrop, tombol Escape, dan tombol tutup dinonaktifkan sampai izin notifikasi diberikan ('granted').
export default function NotificationPrompt({ enabled }) {
  const [permission, setPermission] = useState(getNotificationPermission);
  const [ready, setReady] = useState(false);

  // Beri jeda sebentar agar pop up muncul mulus setelah halaman tampil
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(timer);
  }, []);

  // Pantau perubahan izin notifikasi secara langsung jika pemain mengubah dari pengaturan browser
  useEffect(() => {
    const syncPermission = () => {
      setPermission(getNotificationPermission());
    };
    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);

    let permStatus = null;
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'notifications' })
        .then(status => {
          permStatus = status;
          permStatus.onchange = () => {
            const next = getNotificationPermission();
            setPermission(next);
          };
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  const allow = async () => {
    sound.playClick();
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      notify('Notifikasi JakLudo aktif', {
        body: 'Kamu akan diberi tahu saat giliran mengocok dadu, undangan match, dan pesan grup.',
        tag: 'jakludo-welcome',
        force: true
      });
    }
  };

  const isOpen = enabled && ready && (permission === 'default' || permission === 'denied');

  return (
    <Modal
      isOpen={isOpen}
      size="sm"
      icon="bell"
      title="Aktifkan notifikasi"
      footer={
        <button type="button" className="btn btn--primary btn--block" onClick={allow}>
          <Icon name="bell" size={18} />
          <span>{permission === 'denied' ? 'Sudah diizinkan, cek ulang' : 'Izinkan notifikasi'}</span>
        </button>
      }
    >
      <p>
        Untuk bermain di JakLudo, silakan izinkan notifikasi browser agar kamu tidak melewatkan giliran dadu, undangan match, dan pesan grup.
      </p>
      {permission === 'denied' ? (
        <p className="alert alert--error" role="alert">
          Notifikasi saat ini diblokir di browser kamu. Klik ikon gembok / pengaturan situs di samping bilah alamat web, ubah izin <strong>Notifikasi</strong> menjadi <strong>"Izinkan" (Allow)</strong>, lalu klik tombol di bawah.
        </p>
      ) : (
        <p className="muted">
          Klik tombol <strong>Izinkan notifikasi</strong> di bawah lalu pilih <strong>Allow / Izinkan</strong> pada pop up browser.
        </p>
      )}
    </Modal>
  );
}
