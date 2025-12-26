import { io, Socket } from 'socket.io-client';
import {
  RoomState,
  VideoEvent,
  CreateRoomResponse,
  JoinRoomResponse,
  SyncResponse,
  User,
  VideoAction,
} from '../types';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Room operations
  createRoom(videoUrl: string, userName: string): Promise<CreateRoomResponse> {
    return new Promise((resolve) => {
      this.socket?.emit('create-room', { videoUrl, userName }, (response: CreateRoomResponse) => {
        resolve(response);
      });
    });
  }

  joinRoom(roomId: string, userName: string): Promise<JoinRoomResponse> {
    return new Promise((resolve) => {
      this.socket?.emit('join-room', { roomId, userName }, (response: JoinRoomResponse) => {
        resolve(response);
      });
    });
  }

  leaveRoom(roomId: string, userId: string): void {
    this.socket?.emit('leave-room', { roomId, userId });
  }

  // Video control
  sendVideoEvent(roomId: string, action: VideoAction, time: number): void {
    this.socket?.emit('video-event', { roomId, action, time });
  }

  requestSync(roomId: string): Promise<SyncResponse> {
    return new Promise((resolve) => {
      this.socket?.emit('request-sync', { roomId }, (response: SyncResponse) => {
        resolve(response);
      });
    });
  }

  // Event listeners
  onVideoEvent(callback: (event: VideoEvent) => void): () => void {
    const handler = (event: VideoEvent) => callback(event);
    this.socket?.on('video-event', handler);
    return () => this.socket?.off('video-event', handler);
  }

  onUserJoined(callback: (data: { user: User; users: User[] }) => void): () => void {
    const handler = (data: { user: User; users: User[] }) => callback(data);
    this.socket?.on('user-joined', handler);
    return () => this.socket?.off('user-joined', handler);
  }

  onUserLeft(callback: (data: { userId: string; users: User[] }) => void): () => void {
    const handler = (data: { userId: string; users: User[] }) => callback(data);
    this.socket?.on('user-left', handler);
    return () => this.socket?.off('user-left', handler);
  }

  onHostChanged(callback: (data: { newHostId: string }) => void): () => void {
    const handler = (data: { newHostId: string }) => callback(data);
    this.socket?.on('host-changed', handler);
    return () => this.socket?.off('host-changed', handler);
  }

  onRoomState(callback: (state: RoomState) => void): () => void {
    const handler = (state: RoomState) => callback(state);
    this.socket?.on('room-state', handler);
    return () => this.socket?.off('room-state', handler);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
