import React, { useEffect, useId, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Dialog yang bisa dipakai semua modal: Escape menutup, fokus dikunci di dalam dialog,
// lalu dikembalikan ke elemen pemicu saat ditutup. variant="sheet" tampil dari bawah di HP.
export default function Modal({ isOpen, onClose, title, subtitle, icon, variant = 'dialog', size = 'md', className = '', children, footer }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    // Fokus ke elemen pertama di dalam dialog (lewati tombol tutup jika ada elemen lain)
    const focusables = panel ? [...panel.querySelectorAll(FOCUSABLE)] : [];
    (focusables[1] || focusables[0] || panel)?.focus();

    const onKeyDown = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
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
  }, [isOpen]);

  if (!isOpen) return null;

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
            {icon && <span className="modal__icon" aria-hidden="true">{icon}</span>}
            <div className="modal__titles">
              <h2 id={titleId} className="modal__title">{title}</h2>
              {subtitle && <p className="modal__subtitle">{subtitle}</p>}
            </div>
            {onClose && (
              <button type="button" className="icon-btn modal__close" onClick={onClose} aria-label="Tutup">
                <span aria-hidden="true">✕</span>
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
