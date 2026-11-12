import React, { useEffect, useId, useRef } from 'react';
import Icon from './Icon';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Dialog yang bisa dipakai semua modal: Escape menutup, fokus dikunci di dalam dialog,
// lalu dikembalikan ke elemen pemicu saat ditutup. variant="sheet" tampil dari bawah di HP.
// Jika asPage={true}, dirender sebagai halaman penuh (bukan popup modal) untuk navigasi mobile.
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  variant = 'dialog',
  size = 'md',
  className = '',
  asPage = false,
  children,
  footer
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || asPage) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    // Fokus ke elemen pertama di dalam dialog (lewati tombol tutup jika ada elemen lain)
    const focusables = panel ? [...panel.querySelectorAll(FOCUSABLE)] : [];
    (focusables[1] || focusables[0] || panel)?.focus();

    const onKeyDown = e => {
      if (e.key === 'Escape') {
        if (onCloseRef.current) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen, asPage]);

  useEffect(() => {
    if (isOpen && asPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isOpen, asPage]);

  if (!isOpen) return null;

  if (asPage) {
    return (
      <main
        ref={panelRef}
        id="main"
        className={`feature-page ${className}`.trim()}
        aria-labelledby={title ? titleId : undefined}
      >
        {title && (
          <header className="feature-page__header card">
            <div className="feature-page__title-row">
              {icon && (
                <span className="feature-page__icon" aria-hidden="true">
                  {typeof icon === 'string' ? <Icon name={icon} size={24} /> || icon : icon}
                </span>
              )}
              <div className="feature-page__titles">
                <h1 id={titleId} className="feature-page__title">{title}</h1>
                {subtitle && <p className="feature-page__subtitle">{subtitle}</p>}
              </div>
            </div>
          </header>
        )}
        <div className="feature-page__body card">{children}</div>
        {footer && <footer className="feature-page__footer">{footer}</footer>}
      </main>
    );
  }

  return (
    <div className={`modal-backdrop modal-backdrop--${variant}`} onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={panelRef}
        className={`modal modal--${variant} modal--${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        {title && (
          <header className="modal__header">
            {icon && (
              <span className="modal__icon" aria-hidden="true">
                {typeof icon === 'string' ? <Icon name={icon} size={24} /> || icon : icon}
              </span>
            )}
            <div className="modal__titles">
              <h2 id={titleId} className="modal__title">{title}</h2>
              {subtitle && <p className="modal__subtitle">{subtitle}</p>}
            </div>
            {onClose && (
              <button type="button" className="icon-btn modal__close" onClick={onClose} aria-label="Tutup">
                <Icon name="close" size={18} />
              </button>
            )}
          </header>
        )}
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}
