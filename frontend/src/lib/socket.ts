"use client";

import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "@/lib/config";

let socket: Socket | null = null;

export function getSocket(token: string) {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
