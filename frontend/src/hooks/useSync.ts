import { useEffect, useRef, useCallback, useState } from 'react';
import { socketService } from '../services/socket';

const SYNC_INTERVAL = 5000; // 5 seconds
const DRIFT_THRESHOLD = 2000; // 2 seconds - only show as out of sync, don't auto-correct

interface UseSyncProps {
  roomId: string;
  isHost: boolean;
  getCurrentTime: () => number;
  isPlaying: () => boolean;
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
}

export interface UseSyncReturn {
  isSynced: boolean;
  driftMs: number;
  lastSyncTime: number | null;
  forceSync: () => Promise<void>;
}

export function useSync({
  roomId,
  isHost,
  getCurrentTime,
  isPlaying,
  seek,
  play,
  pause,
}: UseSyncProps): UseSyncReturn {
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSynced, setIsSynced] = useState(true);
  const [driftMs, setDriftMs] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const isSyncingRef = useRef(false);

  const checkDrift = useCallback(async (forceCorrection = false): Promise<void> => {
    if (isHost) {
      setIsSynced(true);
      setDriftMs(0);
      return;
    }

    // Prevent multiple simultaneous syncs
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const response = await socketService.requestSync(roomId);
      if (!response.success || !response.roomState) {
        isSyncingRef.current = false;
        return;
      }

      const { currentTime: serverCurrentTime, isPlaying: serverIsPlaying, lastTimeUpdate } = response.roomState;
      const now = Date.now();
      
      const localTime = getCurrentTime();
      
      // Don't calculate drift if video hasn't loaded yet (localTime is 0 or NaN)
      if (!localTime || isNaN(localTime)) {
        isSyncingRef.current = false;
        return;
      }

      // Calculate actual expected time based on when the time was last set
      // If playing: add elapsed time since lastTimeUpdate
      const elapsedSinceUpdate = Math.max(0, (now - lastTimeUpdate) / 1000);
      // Cap elapsed time to prevent huge drift values from stale data
      const cappedElapsed = Math.min(elapsedSinceUpdate, 60); // Max 60 seconds
      const expectedTime = serverIsPlaying
        ? serverCurrentTime + cappedElapsed
        : serverCurrentTime;
      const drift = (localTime - expectedTime) * 1000; // in ms, positive = ahead, negative = behind
      const absDrift = Math.abs(drift);

      setDriftMs(drift);
      setLastSyncTime(Date.now());

      const needsCorrection = absDrift > DRIFT_THRESHOLD;
      setIsSynced(!needsCorrection);

      // Only correct if explicitly requested (manual sync button) OR initial sync
      if (forceCorrection) {
        console.log(`Sync correction: drift was ${drift.toFixed(0)}ms, seeking to ${expectedTime.toFixed(2)}s`);
        seek(expectedTime);
        
        // Also sync play state
        if (serverIsPlaying && !isPlaying()) {
          play();
        } else if (!serverIsPlaying && isPlaying()) {
          pause();
        }
        
        // After correction, we should be synced
        setIsSynced(true);
        setDriftMs(0);
      }
    } catch (error) {
      console.error('Sync check failed:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [roomId, isHost, getCurrentTime, isPlaying, seek, play, pause]);

  const forceSync = useCallback(async (): Promise<void> => {
    await checkDrift(true);
  }, [checkDrift]);

  useEffect(() => {
    if (!roomId) return;

    // Start periodic sync check (only checks drift, doesn't auto-correct)
    syncIntervalRef.current = setInterval(() => checkDrift(false), SYNC_INTERVAL);

    // Initial sync is now handled by the room join flow directly
    // No automatic initial sync here to avoid constant seeks during buffering

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [roomId, checkDrift]);

  return {
    isSynced,
    driftMs,
    lastSyncTime,
    forceSync,
  };
}
