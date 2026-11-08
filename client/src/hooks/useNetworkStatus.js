import { useEffect, useState } from 'react';

// Status koneksi socket & latensi (ping setiap 3 detik)
export function useNetworkStatus(socket) {
  const [ping, setPing] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
    };
    const onDisconnect = () => {
      setIsConnected(false);
      setIsReconnecting(true);
    };
    const onReconnectAttempt = () => setIsReconnecting(true);

    const measure = () => {
      if (!socket.connected) return;
      const sentAt = Date.now();
      socket.emit('network:ping', sentAt, () => {
        const latency = Math.max(1, Date.now() - sentAt);
        setPing(latency);
        setIsSlowNetwork(latency > 250);
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect', onConnect);

    // HP sering memutus koneksi saat tab di background (mis. membagikan link undangan).
    // Saat tab aktif lagi / jaringan kembali, sambungkan segera tanpa menunggu jadwal reconnect.
    const reconnectNow = () => {
      if (document.visibilityState === 'visible' && !socket.connected) socket.connect();
      else if (socket.connected) measure();
    };
    document.addEventListener('visibilitychange', reconnectNow);
    window.addEventListener('online', reconnectNow);
    window.addEventListener('pageshow', reconnectNow);

    measure();
    const pingTimer = setInterval(measure, 3000);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect', onConnect);
      document.removeEventListener('visibilitychange', reconnectNow);
      window.removeEventListener('online', reconnectNow);
      window.removeEventListener('pageshow', reconnectNow);
      clearInterval(pingTimer);
    };
  }, [socket]);

  return { ping, isConnected, isReconnecting, isSlowNetwork };
}
