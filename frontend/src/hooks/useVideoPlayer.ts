import { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';
import { VideoEvent, VideoAction } from '../types';
import { getProxiedUrl, needsProxy } from '../utils/proxy';

interface UseVideoPlayerProps {
  videoUrl: string;
  isHost: boolean;
  onVideoEvent: (action: VideoAction, time: number) => void;
  initialTime?: number;
  initialPlaying?: boolean;
}

interface UseVideoPlayerReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isBuffering: boolean;
  error: string | null;
  needsInteraction: boolean;
  isReady: boolean;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  handleRemoteEvent: (event: VideoEvent) => void;
  enablePlayback: () => void;
}

export function useVideoPlayer({
  videoUrl,
  isHost,
  onVideoEvent,
  initialTime = 0,
  initialPlaying = false,
}: UseVideoPlayerProps): UseVideoPlayerReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  // Track remote events to prevent echo - use timestamp instead of boolean
  const remoteEventUntilRef = useRef(0);
  const pendingPlayRef = useRef(false);
  const pendingTimeRef = useRef(0);
  const initialSyncDoneRef = useRef(false);
  const initialTimeRef = useRef(initialTime);
  const initialPlayingRef = useRef(initialPlaying);
  const isHostRef = useRef(isHost);

  // Keep refs in sync with props
  useEffect(() => {
    initialTimeRef.current = initialTime;
    initialPlayingRef.current = initialPlaying;
  }, [initialTime, initialPlaying]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // Check if we're in a remote event window
  const isRemoteEvent = useCallback(() => {
    return Date.now() < remoteEventUntilRef.current;
  }, []);

  // Mark that we're handling a remote event (suppress local events for a duration)
  const markRemoteEvent = useCallback((durationMs = 500) => {
    remoteEventUntilRef.current = Date.now() + durationMs;
  }, []);

  // Initialize HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    setError(null);
    setIsReady(false);
    initialSyncDoneRef.current = false;

    const performInitialSync = () => {
      if (initialSyncDoneRef.current || isHost) return;
      initialSyncDoneRef.current = true;
      
      const targetTime = initialTimeRef.current;
      const shouldPlay = initialPlayingRef.current;
      
      console.log(`Initial sync: seeking to ${targetTime.toFixed(2)}s, shouldPlay: ${shouldPlay}`);
      
      // Suppress local events during initial sync
      remoteEventUntilRef.current = Date.now() + 2000;
      
      if (targetTime > 0) {
        video.currentTime = targetTime;
      }
      
      if (shouldPlay) {
        pendingTimeRef.current = targetTime;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Initial play succeeded');
              setNeedsInteraction(false);
            })
            .catch((err) => {
              console.warn('Initial play blocked:', err.message);
              setNeedsInteraction(true);
              pendingPlayRef.current = true;
            });
        }
      }
      
      setIsReady(true);
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startPosition: isHost ? -1 : initialTimeRef.current, // Start at initial position for joiners
      });

      // Use proxy for external HLS streams to bypass CORS
      const sourceUrl = needsProxy(videoUrl) ? getProxiedUrl(videoUrl) : videoUrl;
      console.log('Loading HLS source:', sourceUrl);
      
      hls.loadSource(sourceUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest loaded');
      });
      
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        // Once first fragment is buffered, perform initial sync
        if (!initialSyncDoneRef.current && !isHost) {
          performInitialSync();
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error - retrying...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error - recovering...');
              hls.recoverMediaError();
              break;
            default:
              setError('Failed to load video');
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support - also use proxy for CORS
      const sourceUrl = needsProxy(videoUrl) ? getProxiedUrl(videoUrl) : videoUrl;
      video.src = sourceUrl;
      video.addEventListener('canplay', performInitialSync, { once: true });
      
      return () => {
        video.removeEventListener('canplay', performInitialSync);
      };
    } else {
      setError('HLS is not supported in this browser');
    }
  }, [videoUrl, isHost]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      // Only emit if host and not a remote event
      if (isHost && !isRemoteEvent()) {
        onVideoEvent('play', video.currentTime);
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      // Only emit if host and not a remote event
      if (isHost && !isRemoteEvent()) {
        onVideoEvent('pause', video.currentTime);
      }
    };

    const handleSeeked = () => {
      // Only emit if host and not a remote event
      if (isHost && !isRemoteEvent()) {
        onVideoEvent('seek', video.currentTime);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setCurrentTime(video.currentTime);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handlePlaying = () => {
      setIsBuffering(false);
    };

    const handleVolumeChange = () => {
      setVolumeState(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [isHost, onVideoEvent, isRemoteEvent]);

  const play = useCallback(() => {
    videoRef.current?.play().catch(console.error);
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, newVolume));
      if (newVolume > 0 && videoRef.current.muted) {
        videoRef.current.muted = false;
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
    }
  }, []);

  const handleRemoteEvent = useCallback((event: VideoEvent) => {
    const video = videoRef.current;
    if (!video) return;

    // Host doesn't need to process remote events - they originated from host
    if (isHostRef.current) {
      console.log('Skipping remote event - we are the host');
      return;
    }

    // Mark that we're handling a remote event (suppress local events)
    markRemoteEvent(1000);

    // Calculate time adjustment for network latency
    const latency = Math.max(0, (Date.now() - event.serverTime)) / 1000;
    
    console.log(`Remote event: ${event.action} at ${event.time}s (latency: ${(latency * 1000).toFixed(0)}ms)`);

    switch (event.action) {
      case 'play': {
        const adjustedTime = event.time + latency;
        video.currentTime = adjustedTime;
        pendingTimeRef.current = adjustedTime;
        
        // Try to play
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Play succeeded');
              setIsPlaying(true);
              setNeedsInteraction(false);
              pendingPlayRef.current = false;
            })
            .catch((err) => {
              console.warn('Play blocked by browser:', err.message);
              // Show interaction prompt - but set playing to true since host is playing
              setIsPlaying(true);
              setNeedsInteraction(true);
              pendingPlayRef.current = true;
            });
        }
        break;
      }
      case 'pause':
        video.currentTime = event.time;
        video.pause();
        setIsPlaying(false);
        pendingPlayRef.current = false;
        setNeedsInteraction(false);
        break;
      case 'seek': {
        video.currentTime = event.time;
        break;
      }
    }
  }, [markRemoteEvent]);

  // Enable playback after user interaction
  const enablePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setNeedsInteraction(false);
    
    if (pendingPlayRef.current) {
      video.currentTime = pendingTimeRef.current;
      video.play()
        .then(() => {
          console.log('Playback enabled after user click');
          pendingPlayRef.current = false;
        })
        .catch((err) => {
          console.error('Play still failed:', err);
        });
    }
  }, []);

  return {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isBuffering,
    error,
    needsInteraction,
    isReady,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    handleRemoteEvent,
    enablePlayback,
  };
}
