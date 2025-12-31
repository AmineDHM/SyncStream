import { StreamState, User, StreamStateDTO } from './types';

class StreamManager {
  private stream: StreamState = {
    videoUrl: '',
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    lastTimeUpdate: Date.now(),
    users: new Map(),
    movieTitle: undefined,
  };

  getState(): StreamState {
    return this.stream;
  }

  hasActiveStream(): boolean {
    return this.stream.videoUrl !== '';
  }

  setVideo(videoUrl: string, user: User, movieTitle?: string): StreamState {
    this.stream.videoUrl = videoUrl;
    this.stream.currentTime = 0;
    this.stream.duration = 0;
    this.stream.isPlaying = false;
    this.stream.lastTimeUpdate = Date.now();
    this.stream.users.set(user.id, user);
    this.stream.movieTitle = movieTitle;
    return this.stream;
  }

  join(user: User): StreamState {
    this.stream.users.set(user.id, user);
    return this.stream;
  }

  leave(userId: string): void {
    this.stream.users.delete(userId);
    // If no users left, reset stream
    if (this.stream.users.size === 0) {
      this.stream.videoUrl = '';
      this.stream.currentTime = 0;
      this.stream.duration = 0;
      this.stream.isPlaying = false;
      this.stream.movieTitle = undefined;
    }
  }

  // Anyone can update playback
  updatePlayback(isPlaying: boolean, time: number, duration?: number): void {
    this.stream.isPlaying = isPlaying;
    this.stream.currentTime = time;
    this.stream.lastTimeUpdate = Date.now();
    if (duration !== undefined && duration > 0) {
      this.stream.duration = duration;
    }
  }

  getUserBySocketId(socketId: string): User | undefined {
    for (const user of this.stream.users.values()) {
      if (user.socketId === socketId) return user;
    }
    return undefined;
  }

  // Calculate actual current time accounting for elapsed time if playing
  getCurrentTime(): number {
    if (!this.stream.isPlaying) {
      return this.stream.currentTime;
    }
    const elapsed = (Date.now() - this.stream.lastTimeUpdate) / 1000;
    return this.stream.currentTime + elapsed;
  }

  toDTO(): StreamStateDTO {
    return {
      videoUrl: this.stream.videoUrl,
      currentTime: this.getCurrentTime(), // Use calculated time
      duration: this.stream.duration,
      isPlaying: this.stream.isPlaying,
      lastTimeUpdate: this.stream.lastTimeUpdate,
      users: Array.from(this.stream.users.values()),
      viewerCount: this.stream.users.size,
      movieTitle: this.stream.movieTitle,
    };
  }
}

export const streamManager = new StreamManager();
