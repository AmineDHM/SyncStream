// Environment configuration with defaults
export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  
  // Room settings
  maxUsersPerRoom: 20,
  roomTimeoutMs: 30 * 60 * 1000, // 30 minutes in production
  
  // Rate limiting
  rateLimitWindow: 60000, // 1 minute
  maxRoomCreations: 10,
  
  // Logging
  isDev: (process.env.NODE_ENV || 'development') === 'development',
} as const;

export type Config = typeof config;
