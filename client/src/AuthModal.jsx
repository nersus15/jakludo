import React, { useState, useEffect, useMemo, useRef } from 'react';
import { sound } from './sound';

async function safeFetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`Respon server tidak valid (${res.status} ${res.statusText}).`);
  }
  return { ok: res.ok, data };
}

// Generate 5 karakter captcha acak (mudah dibaca, hindari karakter ambigu O/0/I/1)
function generateCaptchaCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let str = '';
  for (let i = 0; i < 5; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}

// Render captcha ke canvas dengan efek visual anti-bot & rotasi acak
function renderCaptchaToCanvas(canvas, code) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Background gradient modern
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#f8fafc');
  grad.addColorStop(0.5, '#f1f5f9');
  grad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Garis-garis noise pelindung (anti-bot distortion lines)
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = `rgba(15, 23, 42, ${0.12 + Math.random() * 0.15})`;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.bezierCurveTo(
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height
    );
    ctx.stroke();
  }

  // Gambar setiap huruf dengan warna kontras & rotasi dinamis
  const colors = ['#ea580c', '#0284c7', '#16a34a', '#8b5cf6', '#dc2626', '#d97706'];
  const charSpacing = width / (code.length + 1);

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    ctx.save();
    ctx.font = `800 ${22 + Math.floor(Math.random() * 4)}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = colors[i % colors.length];

    const x = (i + 0.8) * charSpacing;
    const y = height / 2 + 7;
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.4);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }

  // Titik-titik noise acak
  for (let i = 0; i < 35; i++) {
    ctx.fillStyle = `rgba(100, 116, 139, ${0.2 + Math.random() * 0.35})`;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 0.8 + Math.random() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Custom reCaptcha State
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const canvasRef = useRef(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Refresh / Buat kode captcha baru
  const refreshCaptcha = () => {
    const newCode = generateCaptchaCode();
    setCaptchaCode(newCode);
    setCaptchaInput('');
    if (canvasRef.current) {
      renderCaptchaToCanvas(canvasRef.current, newCode);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError('');
      setConfirmPassword('');
      refreshCaptcha();
    }
  }, [isOpen, tab]);

  // Gambar ulang jika captchaCode berubah
  useEffect(() => {
    if (isOpen && canvasRef.current && captchaCode) {
      renderCaptchaToCanvas(canvasRef.current, captchaCode);
    }
  }, [isOpen, captchaCode]);

  // Evaluasi kekuatan password mengikuti standar keamanan NIST / OWASP
  const passwordStats = useMemo(() => {
    const minLen = password.length >= 8;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);

    const score = [minLen, hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
    let label = 'Sangat Lemah';
    let color = '#ef4444';

    if (score >= 5) {
      label = 'Sangat Kuat (Aman)';
      color = '#10b981';
    } else if (score >= 4) {
      label = 'Kuat';
      color = '#38bdf8';
    } else if (score >= 3) {
      label = 'Sedang';
      color = '#f59e0b';
    }

    return { minLen, hasLower, hasUpper, hasDigit, hasSpecial, score, label, color };
  }, [password]);

  // Kecocokan konfirmasi password
  const isPasswordMatch = useMemo(() => {
    if (!confirmPassword) return null;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  // Submit Login
  const handleLogin = async e => {
    e?.preventDefault();
    if (!username.trim() || !password) {
      return setError('Username dan password wajib diisi.');
    }

    // Validasi Custom reCaptcha
    if (!captchaInput.trim()) {
      return setError('Silakan masukkan kode reCaptcha keamanan.');
    }
    if (captchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      refreshCaptcha();
      return setError('Kode reCaptcha tidak cocok. Silakan masukkan kode baru.');
    }

    setLoading(true);
    setError('');
    sound.playClick();

    try {
      const { ok, data } = await safeFetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      if (!ok || !data.success) {
        throw new Error(data.error || 'Gagal login.');
      }

      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      refreshCaptcha();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit Register
  const handleRegister = async e => {
    e?.preventDefault();
    if (!username.trim()) return setError('Username wajib diisi.');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      return setError('Username harus 3-20 karakter, hanya huruf, angka, dan underscore (_).');
    }

    if (passwordStats.score < 5) {
      return setError('Password belum memenuhi seluruh standar keamanan (minimal 8 karakter, huruf besar, huruf kecil, angka, dan simbol).');
    }

    // Validasi konfirmasi password
    if (!confirmPassword) {
      return setError('Silakan ketik ulang password untuk konfirmasi.');
    }
    if (password !== confirmPassword) {
      return setError('Password dan ketik ulang password tidak cocok.');
    }

    // Validasi Custom reCaptcha
    if (!captchaInput.trim()) {
      return setError('Silakan masukkan kode reCaptcha keamanan.');
    }
    if (captchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      refreshCaptcha();
      return setError('Kode reCaptcha tidak cocok. Silakan masukkan kode baru.');
    }

    setLoading(true);
    setError('');
    sound.playClick();

    try {
      const { ok, data } = await safeFetchJson('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          name: username.trim()
        })
      });
      if (!ok || !data.success) {
        throw new Error(data.error || 'Gagal mendaftar akun.');
      }

      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      refreshCaptcha();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-card" onClick={e => e.stopPropagation()}>
        <button type="button" className="auth-close-btn" onClick={onClose} title="Tutup">
          ✕
        </button>

        <div className="auth-header">
          <div className="auth-crown">👑</div>
          <h2>Selamat Datang di JakLudo</h2>
          <p className="auth-sub">
            {tab === 'login'
              ? 'Masuk ke akunmu untuk merebut takhta 👑 Ludo King dan menyimpan skor.'
              : 'Daftar akun baru dengan username unik dan proteksi keamanan reCaptcha.'}
          </p>
        </div>

        {/* Tab Navigasi: Masuk & Daftar Akun */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setTab('login');
              setError('');
            }}
          >
            🔑 Masuk
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setTab('register');
              setError('');
            }}
          >
            ✨ Daftar Akun Baru
          </button>
        </div>

        {/* FORM LOGIN */}
        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label>USERNAME</label>
              <div className="input-with-prefix">
                <span className="input-prefix">@</span>
                <input
                  type="text"
                  placeholder="Username kamu"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>PASSWORD</label>
              <div className="input-with-prefix password-input-box">
                <span className="input-prefix">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  title={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* CUSTOM RECAPTCHA BOX */}
            <div className="form-group captcha-group">
              <div className="captcha-label-row">
                <label>KODE RECAPTCHA KEAMANAN</label>
                <span className="captcha-badge">🛡️ Anti-Bot Protection</span>
              </div>
              <div className="captcha-box-container">
                <canvas
                  ref={canvasRef}
                  width="180"
                  height="46"
                  className="captcha-canvas"
                  title="Kode Captcha Keamanan"
                />
                <button
                  type="button"
                  className="captcha-refresh-btn"
                  onClick={refreshCaptcha}
                  title="Ganti Kode Baru"
                >
                  🔄 Ganti
                </button>
              </div>
              <input
                type="text"
                placeholder="Ketik 5 kode di atas"
                value={captchaInput}
                onChange={e => setCaptchaInput(e.target.value.toUpperCase())}
                maxLength="6"
                disabled={loading}
                className="captcha-input-field"
                required
              />
            </div>

            {error && <div className="auth-error-box">{error}</div>}

            <button
              type="submit"
              className="primary auth-submit-btn"
              disabled={loading || !username.trim() || !password || !captchaInput.trim()}
            >
              {loading ? 'Memverifikasi...' : 'Masuk Sekarang →'}
            </button>
          </form>
        ) : (
          /* FORM REGISTER */
          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
              <label>USERNAME UNIK</label>
              <div className="input-with-prefix">
                <span className="input-prefix">@</span>
                <input
                  type="text"
                  placeholder="contoh: raja_dadu"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  maxLength="20"
                  disabled={loading}
                  required
                />
              </div>
              <small className="field-hint">Hanya huruf kecil, angka, dan underscore (_). Minimal 3 karakter.</small>
            </div>

            <div className="form-group">
              <label>PASSWORD</label>
              <div className="input-with-prefix password-input-box">
                <span className="input-prefix">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimal 8 karakter unik & kuat"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  title={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Password Checklist & Indicator */}
              {password.length > 0 && (
                <div className="password-checklist-card">
                  <div className="strength-header">
                    <span>Kekuatan Password:</span>
                    <strong style={{ color: passwordStats.color }}>{passwordStats.label}</strong>
                  </div>
                  <div className="strength-bar-bg">
                    <div
                      className="strength-bar-fill"
                      style={{
                        width: `${(passwordStats.score / 5) * 100}%`,
                        background: passwordStats.color
                      }}
                    />
                  </div>
                  <ul className="checklist-items">
                    <li className={passwordStats.minLen ? 'valid' : 'invalid'}>
                      {passwordStats.minLen ? '✓' : '○'} Minimal 8 karakter
                    </li>
                    <li className={passwordStats.hasLower ? 'valid' : 'invalid'}>
                      {passwordStats.hasLower ? '✓' : '○'} Huruf kecil (a-z)
                    </li>
                    <li className={passwordStats.hasUpper ? 'valid' : 'invalid'}>
                      {passwordStats.hasUpper ? '✓' : '○'} Huruf besar (A-Z)
                    </li>
                    <li className={passwordStats.hasDigit ? 'valid' : 'invalid'}>
                      {passwordStats.hasDigit ? '✓' : '○'} Mengandung angka (0-9)
                    </li>
                    <li className={passwordStats.hasSpecial ? 'valid' : 'invalid'}>
                      {passwordStats.hasSpecial ? '✓' : '○'} Karakter spesial (@, #, $, dll)
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* FIELD KETIK ULANG PASSWORD */}
            <div className="form-group">
              <div className="password-match-label-row">
                <label>KETIK ULANG PASSWORD</label>
                {isPasswordMatch !== null && (
                  <span className={`match-badge ${isPasswordMatch ? 'match-ok' : 'match-fail'}`}>
                    {isPasswordMatch ? '✓ Password Cocok' : '✕ Belum Cocok'}
                  </span>
                )}
              </div>
              <div className="input-with-prefix password-input-box">
                <span className="input-prefix">🔒</span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Ketik ulang password di atas"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex="-1"
                  title={showConfirmPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* CUSTOM RECAPTCHA BOX PADA REGISTRASI */}
            <div className="form-group captcha-group">
              <div className="captcha-label-row">
                <label>KODE RECAPTCHA KEAMANAN</label>
                <span className="captcha-badge">🛡️ Anti-Bot Protection</span>
              </div>
              <div className="captcha-box-container">
                <canvas
                  ref={canvasRef}
                  width="180"
                  height="46"
                  className="captcha-canvas"
                  title="Kode Captcha Keamanan"
                />
                <button
                  type="button"
                  className="captcha-refresh-btn"
                  onClick={refreshCaptcha}
                  title="Ganti Kode Baru"
                >
                  🔄 Ganti
                </button>
              </div>
              <input
                type="text"
                placeholder="Ketik 5 kode di atas"
                value={captchaInput}
                onChange={e => setCaptchaInput(e.target.value.toUpperCase())}
                maxLength="6"
                disabled={loading}
                className="captcha-input-field"
                required
              />
            </div>

            {error && <div className="auth-error-box">{error}</div>}

            <button
              type="submit"
              className="primary auth-submit-btn"
              disabled={loading || passwordStats.score < 5 || !isPasswordMatch || !captchaInput.trim()}
            >
              {loading ? 'Mendaftarkan Akun...' : 'Daftar Akun Baru →'}
            </button>

            {/* Hint Status Pendaftaran */}
            {(passwordStats.score < 5 || !isPasswordMatch || !captchaInput.trim() || !username.trim()) && (
              <div className="auth-helper-note">
                {!username.trim()
                  ? '💡 Masukkan username unik pilihanmu.'
                  : passwordStats.score < 5
                  ? '🔒 Lengkapi kriteria password hingga Sangat Kuat (Aman).'
                  : !isPasswordMatch
                  ? '⚠️ Ketik ulang password harus sama persis dengan password di atas.'
                  : '🛡️ Ketik 5 kode reCaptcha di atas untuk mendaftar.'}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
