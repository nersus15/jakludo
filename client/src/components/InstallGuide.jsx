import React from 'react';
import Modal from './Modal';

// Panduan pasang aplikasi saat browser tidak punya prompt instal otomatis
export default function InstallGuide({ platform, onClose }) {
  const isIos = platform === 'ios';
  return (
    <Modal
      isOpen={!!platform}
      onClose={onClose}
      size="sm"
      icon="📲"
      title={isIos ? 'Pasang di iPhone / iPad' : 'Pasang JakLudo'}
      subtitle="JakLudo bisa dibuka dari layar utama seperti aplikasi biasa."
      footer={<button type="button" className="btn btn--primary" onClick={onClose}>Mengerti</button>}
    >
      <ol className="steps">
        {isIos ? (
          <>
            <li>Buka JakLudo di <strong>Safari</strong>, lalu ketuk tombol <strong>Bagikan</strong> di bilah bawah.</li>
            <li>Pilih <strong>Tambahkan ke Layar Utama</strong>, lalu ketuk <strong>Tambah</strong>.</li>
          </>
        ) : (
          <>
            <li>Buka menu browser (ikon titik tiga atau garis tiga).</li>
            <li>Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.</li>
          </>
        )}
      </ol>
    </Modal>
  );
}
