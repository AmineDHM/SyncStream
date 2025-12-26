export interface User {
  id: string;
  socketId: string;
}

export interface StreamState {
  videoUrl: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  lastTimeUpdate: number;
  users: Map<string, User>;
}

export interface StreamStateDTO {
  videoUrl: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  lastTimeUpdate: number;
  users: User[];
  viewerCount: number;
}

export type VideoAction = 'play' | 'pause' | 'seek';

export interface VideoEvent {
  action: VideoAction;
  time: number;
  duration: number;
  serverTime: number;
}
