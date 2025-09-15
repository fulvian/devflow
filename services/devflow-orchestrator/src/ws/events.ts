import type { Server } from 'socket.io';

let ioRef: Server | null = null;

export const setIo = (io: Server): void => {
  ioRef = io;
};

export const emitEvent = (event: string, payload: unknown, room?: string): void => {
  if (!ioRef) return;
  if (room) ioRef.to(room).emit(event, payload);
  else ioRef.emit(event, payload);
};

