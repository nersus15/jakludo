import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon';
import {
  clampCropOffset,
  computeCropBounds,
  decodeImageFile,
  drawCroppedAvatar,
  exportCroppedAvatar
} from '../social/media';
import { sound } from '../sound';

const STAGE_SIZE = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AvatarCropModal({
  file,
  title = 'Potong foto profil',
  subtitle = 'Geser, perbesar, atau putar foto agar pas di dalam lingkaran.',
  onCancel,
  onConfirm
}) {
  const titleId = useId();
  const zoomId = useId();
  const panelRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchStartRef = useRef(null);

  const [decoded, setDecoded] = useState(null);
  const [decodeError, setDecodeError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [applying, setApplying] = useState(false);

  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Dekode file gambar saat dipilih
  useEffect(() => {
    if (!file) {
      setDecoded(null);
      setDecodeError('');
      return undefined;
    }
    let cancelled = false;
    let loaded = null;
    setDecodeError('');
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
    setApplying(false);

    decodeImageFile(file)
      .then(res => {
        if (cancelled) {
          res.cleanup();
          return;
        }
        loaded = res;
        setDecoded(res);
      })
      .catch(err => {
        if (!cancelled) {
          setDecodeError(err?.message || 'File gambar tidak dapat dibaca.');
        }
      });

    return () => {
      cancelled = true;
      if (loaded) loaded.cleanup();
      setDecoded(null);
    };
  }, [file]);

  // Kunci fokus & tangkap Escape di capture phase agar modal di belakangnya tidak ikut tertutup
  useEffect(() => {
    if (!file) return undefined;
    const prevFocus = document.activeElement;
    const panel = panelRef.current;
    requestAnimationFrame(() => {
      const items = panel ? [...panel.querySelectorAll(FOCUSABLE)] : [];
      (items.find(el => el.dataset?.cropPrimary) || items[1] || items[0] || panel)?.focus();
    });

    const onKeyDown = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onCancelRef.current?.();
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

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      if (prevFocus instanceof HTMLElement && prevFocus.isConnected) {
        prevFocus.focus();
      }
    };
  }, [file]);

  const applyClampedState = useCallback(
    (nextZoom, nextOffset, nextRotation = rotation) => {
      const safeZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      if (!decoded) {
        setZoom(safeZoom);
        setOffset(nextOffset);
        return;
      }
      const { maxX, maxY } = computeCropBounds({
        origW: decoded.width,
        origH: decoded.height,
        rotation: nextRotation,
        zoom: safeZoom,
        stageSize: STAGE_SIZE
      });
      const clamped = clampCropOffset({
        offsetX: nextOffset.x,
        offsetY: nextOffset.y,
        maxX,
        maxY
      });
      setZoom(safeZoom);
      setOffset({ x: clamped.offsetX, y: clamped.offsetY });
    },
    [decoded, rotation]
  );

  // Gambar pratinjau di kanvas dengan DPR layar agar tajam
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !decoded) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(STAGE_SIZE * dpr);
    if (canvas.width !== px || canvas.height !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCroppedAvatar(ctx, {
      source: decoded.source,
      origW: decoded.width,
      origH: decoded.height,
      rotation,
      zoom,
      offsetX: offset.x,
      offsetY: offset.y,
      stageSize: STAGE_SIZE,
      outputSize: STAGE_SIZE
    });
  }, [decoded, zoom, offset, rotation]);

  // Wheel zoom (non-passive agar halaman tidak ikut menggulir)
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !decoded) return undefined;
    const onWheel = e => {
      e.preventDefault();
      const step = -e.deltaY * 0.002;
      applyClampedState(zoom + step, offset);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [decoded, zoom, offset, applyClampedState]);

  const stageScaleFactor = () => {
    const rect = stageRef.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? STAGE_SIZE / rect.width : 1;
  };

  const handlePointerDown = e => {
    if (!decoded || applying) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      pinchStartRef.current = {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        zoom
      };
    } else {
      pinchStartRef.current = null;
    }
    setDragging(true);
  };

  const handlePointerMove = e => {
    if (!pointersRef.current.has(e.pointerId) || !decoded) return;
    const prev = pointersRef.current.get(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const [p1, p2] = [...pointersRef.current.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (pinchStartRef.current.dist > 0) {
        const nextZoom = pinchStartRef.current.zoom * (dist / pinchStartRef.current.dist);
        applyClampedState(nextZoom, offset);
      }
      return;
    }

    if (pointersRef.current.size === 1) {
      const factor = stageScaleFactor();
      const dx = (e.clientX - prev.x) * factor;
      const dy = (e.clientY - prev.y) * factor;
      applyClampedState(zoom, { x: offset.x + dx, y: offset.y + dy });
    }
  };

  const handlePointerUpOrCancel = e => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
    if (pointersRef.current.size === 0) setDragging(false);
  };

  const handleStageKeyDown = e => {
    if (!decoded) return;
    const step = e.shiftKey ? 20 : 8;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      applyClampedState(zoom, { x: offset.x - step, y: offset.y });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      applyClampedState(zoom, { x: offset.x + step, y: offset.y });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      applyClampedState(zoom, { x: offset.x, y: offset.y - step });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      applyClampedState(zoom, { x: offset.x, y: offset.y + step });
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      applyClampedState(zoom + 0.15, offset);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      applyClampedState(zoom - 0.15, offset);
    }
  };

  const handleRotate = () => {
    if (!decoded || applying) return;
    sound.playClick();
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    applyClampedState(zoom, { x: -offset.y, y: offset.x }, nextRot);
  };

  const handleReset = () => {
    sound.playClick();
    setRotation(0);
    applyClampedState(1, { x: 0, y: 0 }, 0);
  };

  const handleApply = async () => {
    if (!decoded || applying) return;
    sound.playClick();
    setApplying(true);
    try {
      const croppedFile = await exportCroppedAvatar(decoded, {
        rotation,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
        stageSize: STAGE_SIZE
      });
      await onConfirm(croppedFile);
    } catch (err) {
      setDecodeError(err?.message || 'Gagal memotong gambar.');
      setApplying(false);
    }
  };

  if (!file) return null;

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      className="modal-backdrop modal-backdrop--dialog crop-backdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !applying) onCancel?.();
      }}
    >
      <div
        ref={panelRef}
        className="modal modal--dialog modal--sm crop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal__header">
          <span className="modal__icon" aria-hidden="true">
            <Icon name="crop" size={24} />
          </span>
          <div className="modal__titles">
            <h2 id={titleId} className="modal__title">{title}</h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="icon-btn modal__close"
            disabled={applying}
            onClick={() => onCancel?.()}
            aria-label="Tutup"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="modal__body crop-modal__body">
          {decodeError ? (
            <p className="alert alert--error" role="alert">{decodeError}</p>
          ) : !decoded ? (
            <p className="state-msg" role="status">
              <span className="spinner" aria-hidden="true" /> Memuat foto...
            </p>
          ) : (
            <>
              <div
                ref={stageRef}
                className={`crop-stage ${dragging ? 'is-dragging' : ''}`}
                tabIndex={0}
                role="application"
                aria-label="Area potong foto. Seret dengan mouse atau jari untuk menggeser, atau gunakan tombol panah keyboard."
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUpOrCancel}
                onPointerCancel={handlePointerUpOrCancel}
                onKeyDown={handleStageKeyDown}
              >
                <canvas ref={canvasRef} className="crop-stage__canvas" />
                <div className="crop-stage__mask" aria-hidden="true">
                  <div className="crop-stage__circle">
                    <span className="crop-stage__grid-h" />
                    <span className="crop-stage__grid-v" />
                  </div>
                </div>
              </div>

              <div className="crop-controls">
                <div className="crop-zoom">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Perkecil zoom"
                    disabled={zoom <= MIN_ZOOM || applying}
                    onClick={() => applyClampedState(zoom - 0.15, offset)}
                  >
                    −
                  </button>
                  <label htmlFor={zoomId} className="sr-only">Zoom foto</label>
                  <input
                    id={zoomId}
                    type="range"
                    className="crop-zoom__slider"
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step="0.02"
                    value={zoom}
                    disabled={applying}
                    onChange={e => applyClampedState(Number(e.target.value), offset)}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Perbesar zoom"
                    disabled={zoom >= MAX_ZOOM || applying}
                    onClick={() => applyClampedState(zoom + 0.15, offset)}
                  >
                    +
                  </button>
                  <span className="crop-zoom__pct">{zoomPercent}%</span>
                </div>

                <div className="crop-tools">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={applying}
                    onClick={handleRotate}
                  >
                    <Icon name="rotate" size={16} />
                    <span>Putar 90°</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={applying || (zoom === 1 && offset.x === 0 && offset.y === 0 && rotation === 0)}
                    onClick={handleReset}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="modal__footer">
          <button
            type="button"
            className="btn btn--secondary"
            disabled={applying}
            onClick={() => onCancel?.()}
          >
            Batal
          </button>
          <button
            type="button"
            data-crop-primary="true"
            className="btn btn--primary"
            disabled={!decoded || !!decodeError || applying}
            onClick={handleApply}
          >
            <Icon name="check" size={17} />
            <span>{applying ? 'Menerapkan...' : 'Terapkan foto'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

