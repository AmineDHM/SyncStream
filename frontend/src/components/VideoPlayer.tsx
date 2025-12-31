import { useCallback, useState, useEffect, useRef } from 'react';
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
import { ReactionType, ReactionEvent } from '../types';

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
  onReaction?: (type: ReactionType) => void;
  reactions?: ReactionEvent[];
}

// Emoji mapping for reactions
const REACTION_EMOJIS: Record<ReactionType, string> = {
  heart_eyes: '😍',
  sparkle_heart: '💖',
  cry: '😢',
  grr: '😠',
};

// Animation classes for variety
const FLOAT_ANIMATIONS = ['animate-float-1', 'animate-float-2', 'animate-float-3'];

// Generate stable position based on reaction ID (deterministic, not random)
const getReactionStyle = (id: string): { left: string; animClass: string } => {
  // Use simple hash of ID to get consistent values
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }

  // Generate position between 15% and 85%
  const position = 15 + (Math.abs(hash) % 70);
  const animIndex = Math.abs(hash) % FLOAT_ANIMATIONS.length;

  return {
    left: `${position}%`,
    animClass: FLOAT_ANIMATIONS[animIndex],
  };
};

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
  onReaction,
  reactions = [],
}: VideoPlayerProps) {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [showControls, setShowControls] = useState(false);
  const hideControlsTimeoutRef = useRef<number | null>(null);

  // Timeline hover state
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

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

  // Handle timeline hover for timestamp preview
  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || !duration) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverTime(percent * duration);
      setHoverPosition(e.clientX - rect.left);
    },
    [duration]
  );

  const handleProgressLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const handleSkip = useCallback(
    (seconds: number) => {
      onSeek(Math.max(0, Math.min(duration, currentTime + seconds)));
    },
    [currentTime, duration, onSeek]
  );

  const toggleFullscreen = useCallback(() => {
    const container = videoElement?.parentElement;
    if (!container) return;

    // Check if already in fullscreen
    const isFullscreen = document.fullscreenElement || 
                        (document as any).webkitFullscreenElement || 
                        (document as any).mozFullScreenElement;

    if (isFullscreen) {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      }
    } else {
      // Enter fullscreen - try multiple methods for compatibility
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).mozRequestFullScreen) {
        (container as any).mozRequestFullScreen();
      } else if ((container as any).webkitEnterFullscreen) {
        // For iOS Safari
        (container as any).webkitEnterFullscreen();
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

  // Show/hide controls with timeout for touch devices
  const handleUserInteraction = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full flex flex-col max-h-full">
      {/* Video Container */}
      <div 
        className="relative bg-black rounded-lg sm:rounded-2xl overflow-hidden shadow-2xl group flex-shrink-0" 
        tabIndex={0}
        onTouchStart={handleUserInteraction}
        onMouseMove={handleUserInteraction}
        onClick={(e) => {
          // Toggle play/pause on video click (mobile-friendly)
          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO') {
            if (isPlaying) onPause();
            else onPlay();
          }
        }}
      >
        <video ref={videoRefCallback} className="w-full aspect-video" playsInline />

        {/* Floating Reactions - Inside fullscreen container */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {reactions.map((reaction) => {
            const style = getReactionStyle(reaction.id);
            return (
              <div
                key={reaction.id}
                className={`absolute bottom-20 reaction-emoji ${style.animClass}`}
                style={{ left: style.left }}
              >
                <span className="text-5xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                  {REACTION_EMOJIS[reaction.type]}
                </span>
              </div>
            );
          })}
        </div>

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
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 sm:p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {/* Progress bar with timestamp tooltip */}
          <div
            ref={progressBarRef}
            className="relative h-1.5 sm:h-1 bg-dark-600 rounded-full mb-2 sm:mb-4 cursor-pointer group/progress touch-manipulation"
            onClick={handleProgressClick}
            onMouseMove={handleProgressHover}
            onMouseLeave={handleProgressLeave}
          >
            {/* Hover preview line */}
            {hoverTime !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/50 pointer-events-none"
                style={{ left: `${(hoverTime / duration) * 100}%` }}
              />
            )}

            {/* Timestamp tooltip */}
            {hoverTime !== null && (
              <div
                className="absolute -top-10 transform -translate-x-1/2 bg-dark-800 text-white text-sm px-2 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-20"
                style={{ left: Math.max(20, Math.min(hoverPosition, (progressBarRef.current?.clientWidth || 0) - 20)) }}
              >
                {formatTime(hoverTime)}
              </div>
            )}

            {/* Progress fill */}
            <div className="h-full bg-blue-500 rounded-full relative" style={{ width: `${progress}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Skip back */}
              <button
                onClick={() => handleSkip(-10)}
                className="text-white hover:text-blue-400 p-1 sm:p-0 touch-manipulation"
              >
                <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Play/Pause */}
              <button
                onClick={isPlaying ? onPause : onPlay}
                className="text-white hover:text-blue-400 p-1 sm:p-0 touch-manipulation"
              >
                {isPlaying ? <Pause className="w-6 h-6 sm:w-8 sm:h-8" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8" />}
              </button>

              {/* Skip forward */}
              <button
                onClick={() => handleSkip(10)}
                className="text-white hover:text-blue-400 p-1 sm:p-0 touch-manipulation"
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Volume - Hidden on small screens */}
              <div
                className="relative flex items-center hidden sm:flex"
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
              <span className="text-white text-xs sm:text-sm whitespace-nowrap">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Sync button */}
              <button
                onClick={onSync}
                className="text-white hover:text-blue-400 flex items-center gap-1 p-1 sm:p-0 touch-manipulation"
                title="Sync with others"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button onClick={toggleFullscreen} className="text-white hover:text-blue-400 p-1 sm:p-0 touch-manipulation">
                <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reaction Buttons - Below the video */}
      {onReaction && (
        <div className="flex justify-center gap-2 sm:gap-4 mt-2 sm:mt-4 flex-shrink-0">
          {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map((type) => (
            <button
              key={type}
              onClick={() => onReaction(type)}
              className="reaction-btn group/reaction relative bg-dark-800 hover:bg-dark-700 border border-dark-600 hover:border-purple-500/50 rounded-full p-2 sm:p-3.5 transition-all duration-300 ease-out hover:scale-110 active:scale-95 touch-manipulation"
              title={`React with ${type.replace('_', ' ')}`}
            >
              <span className="text-xl sm:text-2xl block group-hover/reaction:animate-bounce-small">
                {REACTION_EMOJIS[type]}
              </span>
              {/* Glow effect on hover */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500/0 via-purple-500/0 to-blue-500/0 group-hover/reaction:from-pink-500/20 group-hover/reaction:via-purple-500/20 group-hover/reaction:to-blue-500/20 transition-all duration-300 pointer-events-none" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
