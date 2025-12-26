import { v4 as uuidv4 } from 'uuid';
import { Room, User, RoomStateDTO } from './types';
import { config } from './config';

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupInactiveRooms(), 60000);
  }

  createRoom(videoUrl: string, host: User): Room {
    const roomId = uuidv4().slice(0, 8);
    const now = Date.now();

    const room: Room = {
      id: roomId,
      videoUrl,
      hostId: host.id,
      currentTime: 0,
      isPlaying: false,
      lastTimeUpdate: now,
      users: new Map([[host.id, host]]),
      createdAt: now,
      updatedAt: now,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId: string, user: User): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    if (room.users.size >= config.maxUsersPerRoom) {
      throw new Error('Room is full');
    }

    room.users.set(user.id, user);
    room.updatedAt = Date.now();
    return room;
  }

  leaveRoom(roomId: string, userId: string): { room: Room; newHostId?: string } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.users.delete(userId);
    room.updatedAt = Date.now();

    let newHostId: string | undefined;

    // If room is empty, delete it
    if (room.users.size === 0) {
      this.rooms.delete(roomId);
      return { room };
    }

    // If host left, assign new host
    if (room.hostId === userId) {
      const firstUser = room.users.values().next().value;
      if (firstUser) {
        room.hostId = firstUser.id;
        newHostId = firstUser.id;
      }
    }

    return { room, newHostId };
  }

  updatePlaybackState(
    roomId: string,
    userId: string,
    isPlaying: boolean,
    currentTime: number
  ): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Only host can update playback state
    if (room.hostId !== userId) return null;

    const now = Date.now();
    room.isPlaying = isPlaying;
    room.currentTime = currentTime;
    room.lastTimeUpdate = now;
    room.updatedAt = now;

    return room;
  }

  updateVideoUrl(roomId: string, userId: string, videoUrl: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Only host can change video
    if (room.hostId !== userId) return null;

    const now = Date.now();
    room.videoUrl = videoUrl;
    room.currentTime = 0;
    room.isPlaying = false;
    room.lastTimeUpdate = now;
    room.updatedAt = now;

    return room;
  }

  getUserBySocketId(roomId: string, socketId: string): User | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    for (const user of room.users.values()) {
      if (user.socketId === socketId) {
        return user;
      }
    }
    return undefined;
  }

  toDTO(room: Room): RoomStateDTO {
    return {
      roomId: room.id,
      videoUrl: room.videoUrl,
      hostId: room.hostId,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying,
      lastTimeUpdate: room.lastTimeUpdate,
      users: Array.from(room.users.values()),
    };
  }

  private cleanupInactiveRooms(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms) {
      if (now - room.updatedAt > config.roomTimeoutMs) {
        this.rooms.delete(roomId);
        if (config.isDev) {
          console.log(`Cleaned up inactive room: ${roomId}`);
        }
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const roomManager = new RoomManager();
