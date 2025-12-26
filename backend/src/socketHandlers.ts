import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { streamManager } from './roomManager';
import { User, VideoEvent } from './types';
import { z } from 'zod';

const STREAM_ROOM = 'stream';

const setVideoSchema = z.object({
  videoUrl: z.string().url(),
});

const joinSchema = z.object({});

const videoEventSchema = z.object({
  action: z.enum(['play', 'pause', 'seek']),
  time: z.number().min(0),
  duration: z.number().min(0).optional(),
});

export function setupSocketHandlers(io: Server): void {
  // Broadcast state to ALL connected clients (including those not in stream room)
  const broadcastState = () => {
    io.emit('stream-update', streamManager.toDTO());
  };

  io.on('connection', (socket: Socket) => {
    console.log(`Connected: ${socket.id}`);
    
    // Send current state immediately on connect
    socket.emit('stream-update', streamManager.toDTO());

    // Get current stream state
    socket.on('get-state', (callback) => {
      callback({ state: streamManager.toDTO() });
    });

    // Start stream with video
    socket.on('set-video', (data, callback) => {
      try {
        const { videoUrl } = setVideoSchema.parse(data);
        const userId = uuidv4();
        const user: User = { id: userId, socketId: socket.id };

        streamManager.setVideo(videoUrl, user);
        socket.join(STREAM_ROOM);
        broadcastState();

        callback({ success: true, userId, state: streamManager.toDTO() });
        console.log(`Stream started: ${videoUrl.substring(0, 50)}...`);
      } catch (error) {
        callback({ error: 'Invalid URL' });
      }
    });

    // Join stream
    socket.on('join', (data, callback) => {
      try {
        joinSchema.parse(data);
        
        if (!streamManager.hasActiveStream()) {
          callback({ error: 'No active stream' });
          return;
        }

        const userId = uuidv4();
        const user: User = { id: userId, socketId: socket.id };

        streamManager.join(user);
        socket.join(STREAM_ROOM);
        broadcastState();

        callback({ success: true, userId, state: streamManager.toDTO() });
        console.log(`User joined (${streamManager.toDTO().viewerCount} total)`);
      } catch (error) {
        callback({ error: 'Invalid data' });
      }
    });

    // Video events - anyone can control
    socket.on('video-event', (data) => {
      try {
        const { action, time, duration } = videoEventSchema.parse(data);
        const user = streamManager.getUserBySocketId(socket.id);
        if (!user) return;

        const isPlaying = action === 'play' ? true : action === 'pause' ? false : streamManager.getState().isPlaying;
        streamManager.updatePlayback(isPlaying, time, duration);

        const event: VideoEvent = {
          action,
          time,
          duration: streamManager.getState().duration,
          serverTime: Date.now(),
        };

        // Send to others in stream
        socket.to(STREAM_ROOM).emit('video-event', event);
        console.log(`Video: ${action} at ${Math.round(time)}s`);
      } catch (error) {
        console.error('Video event error:', error);
      }
    });

    // Sync request - returns current server state
    socket.on('sync', (callback) => {
      callback({ state: streamManager.toDTO(), serverTime: Date.now() });
    });

    // Leave
    socket.on('leave', () => {
      handleLeave(socket, broadcastState);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.id}`);
      handleLeave(socket, broadcastState);
    });
  });
}

function handleLeave(socket: Socket, broadcastState: () => void): void {
  const user = streamManager.getUserBySocketId(socket.id);
  if (!user) return;

  streamManager.leave(user.id);
  socket.leave(STREAM_ROOM);
  broadcastState();
  console.log(`User left (${streamManager.toDTO().viewerCount} remaining)`);
}
