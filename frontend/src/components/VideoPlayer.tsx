import { useCallback, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  SkipBack,
  SkipForward,
  Loader2,
  RefreshCw,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  isHost: boolean;
  error: string | null;
  isSynced: boolean;
  driftMs: number;
  needsInteraction: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSync: () => void;
  onEnablePlayback: () => void;
}

export function VideoPlayer({
  videoRef,
  isPlaying,
  currentTime,
  duration,
  isBuffering,
  isHost,
  error,
  isSynced,
  driftMs,
  needsInteraction,
  onPlay,
  onPause,
  onSeek,
  onSync,
  onEnablePlayback,
}: VideoPlayerProps) {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize volume from video element
  useEffect(() => {
    if (videoRef.current) {
      setVolume(videoRef.current.volume);
      setIsMuted(videoRef.current.muted);
    }
  }, [videoRef]);

  const formatTime = useCallback((time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isHost) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      onSeek(percent * duration);
    },
    [isHost, duration, onSeek]
  );

  const handleSkip = useCallback(
    (seconds: number) => {
      if (!isHost) return;
      onSeek(Math.max(0, Math.min(duration, currentTime + seconds)));
    },
    [isHost, currentTime, duration, onSeek]
  );

  const toggleFullscreen = useCallback(() => {
    const videoContainer = videoRef.current?.parentElement;
    if (videoContainer) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoContainer.requestFullscreen();
      }
    }
  }, [videoRef]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, [videoRef]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !videoRef.current.muted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        videoRef.current.volume = 0.5;
        setVolume(0.5);
      }
    }
  }, [videoRef, volume]);

  const handleSyncClick = useCallback(async () => {
    setIsSyncing(true);
    await onSync();
    setTimeout(() => setIsSyncing(false), 500);
  }, [onSync]);

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return VolumeX;
    if (volume < 0.5) return Volume1;
    return Volume2;
  };

  const VolumeIcon = getVolumeIcon();
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl group">
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full aspect-video"
        playsInline
      />

      {/* Loading overlay */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <p className="text-red-400 text-lg">{error}</p>
        </div>
      )}

      {/* Click to play overlay - for browser autoplay policy */}
      {needsInteraction && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
          <button
            onClick={onEnablePlayback}
            className="flex flex-col items-center gap-3 text-white hover:scale-105 transition-transform"
          >
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center">
              <Play className="w-10 h-10 ml-1" />
            </div>
            <span className="text-lg font-medium">Click to Play</span>
            <span className="text-sm text-dark-400">Browser requires interaction to play video</span>
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress bar */}
        <div
          className={`h-1 bg-dark-600 rounded-full mb-4 ${
            isHost ? 'cursor-pointer' : 'cursor-default'
          }`}
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-blue-500 rounded-full relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Skip back */}
            <button
              onClick={() => handleSkip(-10)}
              disabled={!isHost}
              className={`text-white ${
                isHost ? 'hover:text-blue-400' : 'opacity-50 cursor-not-allowed'
              } transition-colors`}
              title={isHost ? 'Skip back 10s' : 'Only host can control'}
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={isPlaying ? onPause : onPlay}
              disabled={!isHost}
              className={`text-white ${
                isHost ? 'hover:text-blue-400' : 'opacity-50 cursor-not-allowed'
              } transition-colors`}
              title={isHost ? (isPlaying ? 'Pause' : 'Play') : 'Only host can control'}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8" />
              ) : (
                <Play className="w-8 h-8" />
              )}
            </button>

            {/* Skip forward */}
            <button
              onClick={() => handleSkip(10)}
              disabled={!isHost}
              className={`text-white ${
                isHost ? 'hover:text-blue-400' : 'opacity-50 cursor-not-allowed'
              } transition-colors`}
              title={isHost ? 'Skip forward 10s' : 'Only host can control'}
            >
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Volume control */}
            <div 
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={toggleMute}
                className="text-white hover:text-blue-400 transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon className="w-5 h-5" />
              </button>
              
              {/* Volume slider */}
              <div 
                className={`ml-2 transition-all duration-200 overflow-hidden ${
                  showVolumeSlider ? 'w-20 opacity-100' : 'w-0 opacity-0'
                }`}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-1 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>

            {/* Time display */}
            <span className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync indicator and button (for non-hosts) */}
            {!isHost && (
              <button
                onClick={handleSyncClick}
                disabled={isSyncing}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all ${
                  isSynced 
                    ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' 
                    : 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
                }`}
                title={isSynced ? 'In sync with host' : `Out of sync (${Math.abs(driftMs).toFixed(0)}ms) - Click to sync`}
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : isSynced ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                <span>{isSynced ? 'Synced' : 'Sync'}</span>
              </button>
            )}

            {/* Host indicator */}
            {isHost && (
              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                Host
              </span>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-blue-400 transition-colors"
              title="Fullscreen"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Non-host overlay message */}
      {!isHost && !isBuffering && !error && (
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className="text-xs bg-dark-700/80 text-dark-300 px-3 py-1 rounded-full">
            Only the host can control playback
          </span>
          {!isSynced && (
            <span className="text-xs bg-yellow-600/80 text-white px-3 py-1 rounded-full animate-pulse">
              Out of sync ({driftMs > 0 ? '+' : ''}{(driftMs / 1000).toFixed(1)}s)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
