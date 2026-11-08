import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { storage } from './storage';
import './styles/index.css';

// Jaring pengaman terakhir: tampilkan pesan dan jalan kembali ke beranda jika UI gagal dirender
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="crash" id="main">
        <h1>Tampilan bermasalah</h1>
        <p className="muted">{this.state.error.message || 'Aplikasi mengalami kesalahan sementara.'}</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            storage.remove('active_room');
            location.href = location.pathname;
          }}
        >
          Kembali ke beranda
        </button>
      </main>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
