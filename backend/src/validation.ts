import { z } from 'zod';

export const m3u8UrlSchema = z.string().url().refine(
  (url) => {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith('.m3u8') || lowerUrl.includes('.m3u8?') || lowerUrl.includes('m3u8');
  },
  { message: 'URL must be a valid m3u8/HLS stream' }
);

export const joinRoomSchema = z.object({
  roomId: z.string().min(1).max(100),
  userName: z.string().min(1).max(50),
  videoUrl: m3u8UrlSchema.optional(),
});

export const videoEventSchema = z.object({
  roomId: z.string().min(1),
  action: z.enum(['play', 'pause', 'seek']),
  time: z.number().min(0),
});

export const requestSyncSchema = z.object({
  roomId: z.string().min(1),
});

export const createRoomSchema = z.object({
  videoUrl: m3u8UrlSchema,
  userName: z.string().min(1).max(50),
});
