import { initRealtime, getIo } from "../modules/realtime/realtime.service.js";

export const initSocket = (server) => {
  return initRealtime(server);
};

export { getIo };

export const emitToUser = (userId, event, data) => {
  try {
    const io = getIo();
    const userIdStr = userId.toString();
    io.to(userIdStr).emit(event, data);
    
    // Check if room has active connected sockets
    const room = io.sockets.adapter.rooms.get(userIdStr);
    return !!(room && room.size > 0);
  } catch (err) {
    console.error("Backwards compatible emitToUser failed:", err);
    return false;
  }
};

