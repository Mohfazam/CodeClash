"use client";

import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "@/lib/config";

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(token: string): Socket {
  // If token changed or socket was disconnected, create a new one
  if (!socket || currentToken !== token || !socket.connected) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    currentToken = token;
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect_error", (err) => {
      console.error("[socket] connect_error:", err.message);
    });

    socket.on("connect", () => {
      console.log("[socket] connected:", socket?.id);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
