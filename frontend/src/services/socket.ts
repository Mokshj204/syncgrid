import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  if (!socket) {
    const socketHost = (
      import.meta.env.VITE_SOCKET_URL || 
      import.meta.env.VITE_API_URL || 
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000')
    ).trim().replace(/\/api\/?$/, ''); // Strip trailing /api if user passes full API URL

    socket = io(socketHost, {
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to Gateway ID:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected. Reason:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
    });
  }
  return socket;
};

export const getSocket = (): Socket => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
