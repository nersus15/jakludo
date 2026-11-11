import React, { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import { sound } from '../sound';
import {
  dismissNotificationPrompt,
  getNotificationPermission,
  isNotificationPromptDismissed,
  NOTIF_PROMPT_RESOLVED_EVENT,
  notify,
  requestNotificationPermission
} from '../notifications';

// Pop up opsional di landing page untuk menawarkan izin notifikasi browser.
// Pemain bebas mengizinkan, menolak lewat tombol Tolak, menutup via Escape/backdrop/tombol tutup.
export default function NotificationPrompt({ enabled }) {
  const [permission, setPermission] = useState(getNotificationPermission);
  const [dismissed, setDismissed] = useState(isNotificationPromptDismissed);
  const [ready, setReady] = useState(false);

  // Beri jeda sebentar agar pop up muncul mulus setelah halaman tampil
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(timer);
  }, []);

  // Pantau perubahan izin notifikasi secara langsung jika pemain mengubah dari pengaturan browser
  useEffect(() => {
    const syncPermission = () => {
      const next = getNotificationPermission();
      setPermission(next);
      if (next !== 'default' && typeof window !== 'undefined') {
        window.dispatchEvent(new Event(NOTIF_PROMPT_RESOLVED_EVENT));
      }
    };
    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);

    let permStatus = null;
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'notifications' })
        .then(status => {
          permStatus = status;
          permStatus.onchange = syncPermission;
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  const dismiss = useCallback(() => {
    sound.playClick();
    setDismissed(true);
    dismissNotificationPrompt();
  }, []);

  const allow = async () => {
    sound.playClick();
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(NOTIF_PROMPT_RESOLVED_EVENT));
      }
      notify('Notifikasi JakLudo aktif', {
        body: 'Kamu akan diberi tahu saat giliran mengocok dadu, undangan match, dan pesan grup.',
        tag: 'jakludo-welcome',
        force: true
      });
    } else if (result === 'denied') {
      // Hormati pilihan user bila menolak izin lewat dialog bawaan browser
      setDismissed(true);
      dismissNotificationPrompt();
    }
  };

  const isOpen = enabled && ready && !dismissed && permission === 'default';

  return (
    <Modal
      isOpen={isOpen}
      onClose={dismiss}
      size="sm"
      icon="bell"
      title="Aktifkan notifikasi"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={dismiss}>
            Tolak
          </button>
          <button type="button" className="btn btn--primary" onClick={allow}>
            <Icon name="bell" size={18} />
            <span>Izinkan notifikasi</span>
          </button>
        </>
      }
    >
      <p>
        Ingin menyalakan notifikasi browser agar tidak melewatkan giliran dadu, undangan match, dan pesan dari teman atau grup?
      </p>
      <p className="muted">
        Bersifat opsional — kamu boleh menolak atau mengaturnya kapan saja lewat menu pengaturan audio &amp; notifikasi.
      </p>
    </Modal>
  );
}
