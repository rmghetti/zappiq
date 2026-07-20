import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('zappiq_token') : null;
    socket = io(WS_URL, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      // WebSocket direto, sem o long-polling padrão do socket.io. A API roda em
      // >=2 máquinas no Fly SEM sticky session: o long-polling cria a sessão do
      // Engine.IO numa máquina e as requisições seguintes caem em qualquer uma,
      // que não conhece aquele sid — a conexão nunca estabiliza e os eventos não
      // chegam (a barra do Maestro travava, new_message/notificações não vinham).
      // Uma conexão WebSocket é única e persistente: fica presa numa máquina, e o
      // Redis adapter (server.ts) reentrega os emits vindos da outra. Seguro
      // porque o WS funciona pelo api.zappiq.com.br (cert emitido) e pelo Fly.
      transports: ['websocket'],
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
  socket = null;
}
