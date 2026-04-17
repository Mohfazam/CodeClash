"use client";

import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "@/lib/config";

let socket: Socket | null = null;
let currentToken: string | null = null;

// Track rooms we've joined so we can rejoin on reconnect
const joinedRooms = new Set<string>();

export function getSocket(token: string): Socket {
  // Only recreate if token changed or socket doesn't exist at all
  if (socket && currentToken === token) {
    // Socket exists with same token — return it even if temporarily disconnected
    // Socket.IO will auto-reconnect
    return socket;
  }

  // Token changed or first connection — create new socket
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on("connect_error", (err) => {
    console.error("[socket] connect_error:", err.message);
  });

  socket.on("connect", () => {
    console.log("[socket] connected:", socket?.id);
    // Rejoin all tracked rooms on reconnect
    for (const room of joinedRooms) {
      socket?.emit("room:join", { room_code: room });
      console.log("[socket] rejoined room:", room);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected:", reason);
  });

  socket.on("reconnect", () => {
    console.log("[socket] reconnected");
  });

  return socket;
}

/** Join a socket room and track it for auto-rejoin on reconnect */
export function joinRoom(token: string, roomCode: string) {
  joinedRooms.add(roomCode);
  const s = getSocket(token);
  if (s.connected) {
    s.emit("room:join", { room_code: roomCode });
  }
  // If not connected yet, the "connect" handler will join automatically
}

/** Leave a socket room and stop tracking it */
export function leaveRoom(token: string, roomCode: string) {
  joinedRooms.delete(roomCode);
  const s = getSocket(token);
  s.emit("room:leave", { room_code: roomCode });
}

/** Get current connection status */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
    joinedRooms.clear();
  }
}
