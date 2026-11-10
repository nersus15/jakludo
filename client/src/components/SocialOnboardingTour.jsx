import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import Icon from './Icon';
import { getNotificationPermission } from '../notifications';
import { sound } from '../sound';
import { storage } from '../storage';

const TOUR_STORAGE_KEY = 'social_tour_v1_done';

const TOUR_STEPS = [
  {
    key: 'friends',
    selector: '[data-tour="friends"]',
    icon: 'friends',
    title: 'Teman & Chat Private',
    description:
      'Tambah teman lewat @username, pantau siapa yang sedang online, dan kirim pesan private berupa teks, foto WebP, maupun voice note!'
  },
  {
    key: 'groups',
    selector: '[data-tour="groups"]',
    icon: 'chat',
    title: 'Grup, Foto Ava & Match Grup',
    description:
      'Buat grup mabar bareng komunitasmu! Admin bisa mengganti foto profil (ava) grup, mengirim foto & voice note, serta menggelar Match Grup dengan papan peringkat khusus anggota.'
  },
  {
    key: 'leaderboard',
    selector: '[data-tour="leaderboard"]',
    icon: 'trophy',
    title: 'Peringkat & Profil Pemain',
    description:
      'Lihat siapa pemilik gelar Ludo King saat ini. Klik nama atau foto pemain di peringkat, grup, maupun daftar teman untuk melihat statistik lengkap dan profil mereka!'
  },
  {
    key: 'account',
    selector: '[data-tour="account"]',
    icon: 'camera',
    title: 'Foto Profil & Akun Kamu',
    description:
      'Buka menu akun di pojok kanan atas untuk mengunggah foto profil (avatar) terbaikmu dan melihat profil pemainmu sendiri.'
  }
];

function computeCardPosition(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardWidth = Math.min(360, vw - 24);
  const pad = 12;

  if (!rect) {
    return {
      width: `${cardWidth}px`,
      top: `${Math.max(pad, Math.round(vh / 2 - 120))}px`,
      left: `${Math.round((vw - cardWidth) / 2)}px`
    };
  }

  const centerX = rect.left + rect.width / 2;
  const left = Math.max(pad, Math.min(vw - cardWidth - pad, Math.round(centerX - cardWidth / 2)));

  const spaceBelow = vh - rect.bottom;
  const estimatedHeight = 230;
  if (spaceBelow >= estimatedHeight || rect.top < estimatedHeight) {
    const top = Math.min(vh - estimatedHeight - pad, Math.max(pad, Math.round(rect.bottom + 14)));
    return { width: `${cardWidth}px`, top: `${top}px`, left: `${left}px` };
  }
  const top = Math.max(pad, Math.round(rect.top - estimatedHeight - 14));
  return { width: `${cardWidth}px`, top: `${top}px`, left: `${left}px` };
}

export default function SocialOnboardingTour({ enabled }) {
  const [done, setDone] = useState(() => storage.get(TOUR_STORAGE_KEY) === '1');
  const [perm, setPerm] = useState(getNotificationPermission);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotRect, setSpotRect] = useState(null);

  // Pantau status izin notifikasi agar stepper tampil setelah pop up notifikasi selesai
  useEffect(() => {
    if (done) return undefined;
    const check = () => setPerm(getNotificationPermission());
    const id = setInterval(check, 500);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', check);
    };
  }, [done]);

  const canShow =
    !done &&
    enabled &&
    (perm === 'granted' || perm === 'unsupported');

  useEffect(() => {
    if (!canShow) {
      setActive(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      if (storage.get(TOUR_STORAGE_KEY) !== '1') {
        setActive(true);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [canShow]);

  const step = TOUR_STEPS[stepIndex] || TOUR_STEPS[0];

  const updateSpotlight = useCallback(() => {
    if (!active || !step) return;
    const el = document.querySelector(step.selector);
    if (!el) {
      setSpotRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setSpotRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      bottom: r.bottom,
      right: r.right
    });
  }, [active, step]);

  useLayoutEffect(() => {
    if (!active || !step) return undefined;
    const el = document.querySelector(step.selector);
    if (el && typeof el.scrollIntoView === 'function') {
      const r = el.getBoundingClientRect();
      if (r.top < 16 || r.bottom > window.innerHeight - 16) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }
    const raf = requestAnimationFrame(updateSpotlight);
    const timer = setTimeout(updateSpotlight, 280);
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [active, step, updateSpotlight]);

  const finishTour = useCallback(() => {
    sound.playClick();
    storage.set(TOUR_STORAGE_KEY, '1');
    setDone(true);
    setActive(false);
  }, []);

  const nextStep = () => {
    sound.playClick();
    if (stepIndex >= TOUR_STEPS.length - 1) {
      finishTour();
    } else {
      setStepIndex(i => i + 1);
    }
  };

  const prevStep = () => {
    sound.playClick();
    setStepIndex(i => Math.max(0, i - 1));
  };

  if (!active || done) return null;

  const pad = 6;
  const spotlightStyle = spotRect
    ? {
        top: `${Math.max(4, spotRect.top - pad)}px`,
        left: `${Math.max(4, spotRect.left - pad)}px`,
        width: `${spotRect.width + pad * 2}px`,
        height: `${spotRect.height + pad * 2}px`
      }
    : null;

  const cardStyle = computeCardPosition(spotRect);

  return (
    <div
      className="tour-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
      aria-describedby="tour-step-desc"
    >
      {spotlightStyle ? (
        <div className="tour-spotlight" style={spotlightStyle} aria-hidden="true" />
      ) : (
        <div className="tour-backdrop" aria-hidden="true" />
      )}

      <div className="tour-card card card--focus" style={cardStyle}>
        <div className="tour-card__head">
          <span className="badge badge--brand">
            <Icon name={step.icon} size={14} /> Fitur Baru · Langkah {stepIndex + 1} / {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm tour-card__skip"
            onClick={finishTour}
          >
            Lewati
          </button>
        </div>

        <h3 id="tour-step-title" className="tour-card__title">
          {step.title}
        </h3>
        <p id="tour-step-desc" className="tour-card__desc muted">
          {step.description}
        </p>

        <div className="tour-card__footer">
          <div className="tour-dots" aria-hidden="true">
            {TOUR_STEPS.map((s, idx) => (
              <span
                key={s.key}
                className={`tour-dot ${idx === stepIndex ? 'is-active' : ''}`}
              />
            ))}
          </div>
          <div className="tour-card__actions">
            {stepIndex > 0 && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={prevStep}>
                Kembali
              </button>
            )}
            <button type="button" className="btn btn--primary btn--sm" onClick={nextStep}>
              {stepIndex === TOUR_STEPS.length - 1 ? 'Selesai & Main!' : 'Lanjut'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

