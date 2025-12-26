import { io, Socket } from 'socket.io-client';
import { StreamState, VideoEvent, VideoAction } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    // If already connected, return existing socket
    if (this.socket?.connected) return this.socket;

    // If socket exists but disconnected, try to reconnect
    if (this.socket) {
      this.socket.connect();
      return this.socket;
    }

    this.socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => console.log('Socket connected'));
    this.socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
    this.socket.on('connect_error', (err) => console.error('Socket connect error:', err.message));

    return this.socket;
  }

  // Wait for connection to be ready
  async waitForConnection(): Promise<Socket> {
    if (this.socket?.connected) return this.socket;
    
    const socket = this.connect();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
      
      if (socket.connected) {
        clearTimeout(timeout);
        resolve(socket);
        return;
      }
      
      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve(socket);
      });
      
      socket.once('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  // Start stream with video
  setVideo(videoUrl: string): Promise<{ success?: boolean; error?: string; userId?: string; state?: StreamState }> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected'));
        return;
      }
      const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
      this.socket.emit('set-video', { videoUrl }, (response: { success?: boolean; error?: string; userId?: string; state?: StreamState }) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  // Join stream
  join(): Promise<{ success?: boolean; error?: string; userId?: string; state?: StreamState }> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected'));
        return;
      }
      const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
      this.socket.emit('join', {}, (response: { success?: boolean; error?: string; userId?: string; state?: StreamState }) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  // Send video event (anyone can control)
  sendVideoEvent(action: VideoAction, time: number, duration?: number): void {
    this.socket?.emit('video-event', { action, time, duration });
  }

  // Request sync - get current server state
  sync(): Promise<{ state: StreamState; serverTime: number }> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected'));
        return;
      }
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
      this.socket.emit('sync', (response: { state: StreamState; serverTime: number }) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  // Leave stream
  leave(): void {
    this.socket?.emit('leave');
  }

  // Event listeners
  onVideoEvent(callback: (event: VideoEvent) => void): () => void {
    this.socket?.on('video-event', callback);
    return () => this.socket?.off('video-event', callback);
  }

  onStreamUpdate(callback: (state: StreamState) => void): () => void {
    this.socket?.on('stream-update', callback);
    return () => this.socket?.off('stream-update', callback);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
