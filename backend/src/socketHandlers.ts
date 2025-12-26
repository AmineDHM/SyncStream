import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { roomManager } from './roomManager';
import { config } from './config';
import {
  joinRoomSchema,
  videoEventSchema,
  requestSyncSchema,
  createRoomSchema,
} from './validation';
import { User, VideoEvent } from './types';

// Rate limiting
const rateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);

  if (!limit || now > limit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + config.rateLimitWindow });
    return true;
  }

  if (limit.count >= config.maxRoomCreations) {
    return false;
  }

  limit.count++;
  return true;
}

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);
    const clientIp = socket.handshake.address;

    // Create room
    socket.on('create-room', (data, callback) => {
      try {
        if (!checkRateLimit(clientIp)) {
          callback({ error: 'Rate limit exceeded. Please try again later.' });
          return;
        }

        const parsed = createRoomSchema.parse(data);
        const userId = uuidv4();

        const user: User = {
          id: userId,
          name: parsed.userName,
          socketId: socket.id,
        };

        const room = roomManager.createRoom(parsed.videoUrl, user);
        socket.join(room.id);

        callback({
          success: true,
          roomId: room.id,
          userId,
          roomState: roomManager.toDTO(room),
        });

        console.log(`Room created: ${room.id} by ${user.name}`);
      } catch (error) {
        console.error('Create room error:', error);
        callback({ error: 'Invalid data provided' });
      }
    });

    // Join room
    socket.on('join-room', (data, callback) => {
      try {
        const parsed = joinRoomSchema.parse(data);
        const room = roomManager.getRoom(parsed.roomId);

        if (!room) {
          callback({ error: 'Room not found' });
          return;
        }

        const userId = uuidv4();
        const user: User = {
          id: userId,
          name: parsed.userName,
          socketId: socket.id,
        };

        const updatedRoom = roomManager.joinRoom(parsed.roomId, user);
        if (!updatedRoom) {
          callback({ error: 'Failed to join room' });
          return;
        }

        socket.join(parsed.roomId);

        // Notify others
        socket.to(parsed.roomId).emit('user-joined', {
          user,
          users: Array.from(updatedRoom.users.values()),
        });

        callback({
          success: true,
          userId,
          roomState: roomManager.toDTO(updatedRoom),
        });

        console.log(`${user.name} joined room: ${parsed.roomId}`);
      } catch (error) {
        console.error('Join room error:', error);
        callback({ error: 'Invalid data or room is full' });
      }
    });

    // Leave room
    socket.on('leave-room', (data) => {
      try {
        const { roomId, userId } = data;
        handleLeaveRoom(socket, io, roomId, userId);
      } catch (error) {
        console.error('Leave room error:', error);
      }
    });

    // Video events (play, pause, seek)
    socket.on('video-event', (data) => {
      try {
        const parsed = videoEventSchema.parse(data);
        const room = roomManager.getRoom(parsed.roomId);

        if (!room) return;

        // Find user by socket id
        const user = roomManager.getUserBySocketId(parsed.roomId, socket.id);
        if (!user || room.hostId !== user.id) {
          // Only host can control playback
          return;
        }

        const isPlaying = parsed.action === 'play';
        const updatedRoom = roomManager.updatePlaybackState(
          parsed.roomId,
          user.id,
          parsed.action === 'seek' ? room.isPlaying : isPlaying,
          parsed.time
        );

        if (!updatedRoom) return;

        const videoEvent: VideoEvent = {
          action: parsed.action,
          time: parsed.time,
          serverTime: Date.now(),
        };

        // Broadcast to all in room EXCEPT sender (host already has the state)
        socket.to(parsed.roomId).emit('video-event', videoEvent);

        console.log(`Video event in ${parsed.roomId}: ${parsed.action} at ${parsed.time}s`);
      } catch (error) {
        console.error('Video event error:', error);
      }
    });

    // Request sync (for late joiners or drift correction)
    socket.on('request-sync', (data, callback) => {
      try {
        const parsed = requestSyncSchema.parse(data);
        const room = roomManager.getRoom(parsed.roomId);

        if (!room) {
          callback({ error: 'Room not found' });
          return;
        }

        callback({
          success: true,
          roomState: roomManager.toDTO(room),
          serverTime: Date.now(),
        });
      } catch (error) {
        console.error('Request sync error:', error);
        callback({ error: 'Invalid request' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      handleDisconnect(socket, io);
    });
  });
}

function handleLeaveRoom(
  socket: Socket,
  io: Server,
  roomId: string,
  userId: string
): void {
  const result = roomManager.leaveRoom(roomId, userId);
  if (!result) return;

  socket.leave(roomId);

  // Notify others
  socket.to(roomId).emit('user-left', {
    userId,
    users: Array.from(result.room.users.values()),
  });

  // Notify if host changed
  if (result.newHostId) {
    io.to(roomId).emit('host-changed', {
      newHostId: result.newHostId,
    });
    console.log(`Host changed in ${roomId} to ${result.newHostId}`);
  }

  console.log(`User ${userId} left room: ${roomId}`);
}

function handleDisconnect(socket: Socket, io: Server): void {
  // Find and remove user from any rooms they're in
  const rooms = Array.from(socket.rooms);
  
  for (const roomId of rooms) {
    if (roomId === socket.id) continue; // Skip the default room
    
    const user = roomManager.getUserBySocketId(roomId, socket.id);
    if (user) {
      handleLeaveRoom(socket, io, roomId, user.id);
    }
  }
}
