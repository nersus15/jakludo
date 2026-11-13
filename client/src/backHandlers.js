import { useEffect, useRef } from 'react';

// Tumpukan aksi "kembali" untuk layar bertingkat di dalam halaman/dialog (mis. chat di halaman Teman).
// Saat tombol Back browser/HP ditekan, App menjalankan handler teratas dulu sebelum menutup halaman.
const stack = [];

export function runBackHandler() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.run();
  return true;
}

// Selama `active` bernilai true, Back memanggil onBack alih-alih menutup halaman/dialog
export function useBackHandler(active, onBack) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return undefined;
    const entry = { run: () => ref.current() };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}
