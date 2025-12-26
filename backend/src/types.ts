export interface User {
  id: string;
  name: string;
  socketId: string;
}

export interface Room {
  id: string;
  videoUrl: string;
  hostId: string;
  currentTime: number;
  isPlaying: boolean;
  lastTimeUpdate: number;
  users: Map<string, User>;
  createdAt: number;
  updatedAt: number;
}

export interface RoomStateDTO {
  roomId: string;
  videoUrl: string;
  hostId: string;
  currentTime: number;
  isPlaying: boolean;
  lastTimeUpdate: number;
  users: User[];
}

export type VideoAction = 'play' | 'pause' | 'seek';

export interface VideoEvent {
  action: VideoAction;
  time: number;
  serverTime: number;
}

export interface JoinRoomPayload {
  roomId: string;
  userName: string;
  videoUrl?: string;
}

export interface VideoEventPayload {
  roomId: string;
  action: VideoAction;
  time: number;
}

export interface RequestSyncPayload {
  roomId: string;
}
