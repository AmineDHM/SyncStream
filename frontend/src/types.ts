export interface User {
  id: string;
  name: string;
  socketId: string;
}

export interface RoomState {
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

export interface CreateRoomResponse {
  success?: boolean;
  error?: string;
  roomId?: string;
  userId?: string;
  roomState?: RoomState;
}

export interface JoinRoomResponse {
  success?: boolean;
  error?: string;
  userId?: string;
  roomState?: RoomState;
}

export interface SyncResponse {
  success?: boolean;
  error?: string;
  roomState?: RoomState;
  serverTime?: number;
}
