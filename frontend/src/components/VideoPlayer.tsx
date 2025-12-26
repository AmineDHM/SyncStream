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
} from 'lucide-react';

interface VideoPlayerProps {
  setVideoRef: (ref: HTMLVideoElement | null) => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  error: string | null;
  needsInteraction: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSync: () => void;
  onEnablePlayback: () => void;
}

export function VideoPlayer({
  setVideoRef,
  isPlaying,
  currentTime,
  duration,
  isBuffering,
  error,
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
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
    setVideoElement(node);
    setVideoRef(node);
  }, [setVideoRef]);

  useEffect(() => {
    if (videoElement) {
      setVolume(videoElement.volume);
      setIsMuted(videoElement.muted);
    }
  }, [videoElement]);

  // Format time with hours when > 60 min
  const formatTime = useCallback((time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      onSeek(percent * duration);
    },
    [duration, onSeek]
  );

  const handleSkip = useCallback(
    (seconds: number) => {
      onSeek(Math.max(0, Math.min(duration, currentTime + seconds)));
    },
    [currentTime, duration, onSeek]
  );

  const toggleFullscreen = useCallback(() => {
    const container = videoElement?.parentElement;
    if (container) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        container.requestFullscreen();
      }
    }
  }, [videoElement]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (videoElement) {
      videoElement.volume = newVolume;
      videoElement.muted = newVolume === 0;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, [videoElement]);

  const toggleMute = useCallback(() => {
    if (videoElement) {
      const newMuted = !videoElement.muted;
      videoElement.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        videoElement.volume = 0.5;
        setVolume(0.5);
      }
    }
  }, [videoElement, volume]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ': // Space - play/pause
          e.preventDefault();
          if (isPlaying) onPause();
          else onPlay();
          break;
        case 'ArrowLeft': // Left - backward 10s
          e.preventDefault();
          handleSkip(-10);
          break;
        case 'ArrowRight': // Right - forward 10s
          e.preventDefault();
          handleSkip(10);
          break;
        case 'ArrowUp': // Up - volume up
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown': // Down - volume down
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'f': // F - fullscreen toggle
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm': // M - mute toggle
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 's': // S - sync
        case 'S':
          e.preventDefault();
          onSync();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume, onPlay, onPause, handleSkip, handleVolumeChange, toggleFullscreen, toggleMute, onSync]);

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl group" tabIndex={0}>
      <video ref={videoRefCallback} className="w-full aspect-video" playsInline />

      {/* Buffering */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <p className="text-red-400 text-lg">{error}</p>
        </div>
      )}

      {/* Click to play */}
      {needsInteraction && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
          <button onClick={onEnablePlayback} className="flex flex-col items-center gap-3 text-white hover:scale-105 transition-transform">
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center">
              <Play className="w-10 h-10 ml-1" />
            </div>
            <span className="text-lg font-medium">Click to Play</span>
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress bar */}
        <div
          className="h-1 bg-dark-600 rounded-full mb-4 cursor-pointer"
          onClick={handleProgressClick}
        >
          <div className="h-full bg-blue-500 rounded-full relative" style={{ width: `${progress}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Skip back */}
            <button
              onClick={() => handleSkip(-10)}
              className="text-white hover:text-blue-400"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={isPlaying ? onPause : onPlay}
              className="text-white hover:text-blue-400"
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
            </button>

            {/* Skip forward */}
            <button
              onClick={() => handleSkip(10)}
              className="text-white hover:text-blue-400"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Volume */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button onClick={toggleMute} className="text-white hover:text-blue-400">
                <VolumeIcon className="w-5 h-5" />
              </button>
              <div className={`ml-2 transition-all duration-200 overflow-hidden ${showVolumeSlider ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
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

            {/* Time */}
            <span className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync button */}
            <button
              onClick={onSync}
              className="text-white hover:text-blue-400 flex items-center gap-1"
              title="Sync with others"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={toggleFullscreen} className="text-white hover:text-blue-400">
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
