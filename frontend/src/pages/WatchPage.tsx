import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Loader2, AlertCircle, Users } from 'lucide-react';
import { socketService } from '../services/socket';
import { VideoPlayer } from '../components/VideoPlayer';
import { StreamState, VideoEvent, ReactionType, ReactionEvent } from '../types';
import { getProxiedUrl, needsProxy } from '../utils/proxy';
import Hls from 'hls.js';

export function WatchPage() {
  const navigate = useNavigate();
  const [stream, setStream] = useState<StreamState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Video state
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  // Reactions state
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);

  // Flag to prevent feedback loops when handling remote events
  const isHandlingRemoteEvent = useRef(false);
  // HLS instance ref for cleanup
  const hlsRef = useRef<Hls | null>(null);

  // Initialize
  useEffect(() => {
    const storedUserId = sessionStorage.getItem('userId');

    if (!storedUserId) {
      navigate('/');
      return;
    }

    socketService.connect();

    socketService.sync()
      .then(({ state }) => {
        if (!state.videoUrl) {
          navigate('/');
          return;
        }
        setStream(state);
        setCurrentTime(state.currentTime);
        setDuration(state.duration);
        setIsPlaying(state.isPlaying);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Sync failed:', err);
        setError('Failed to connect to stream');
        setLoading(false);
      });
  }, [navigate]);

  // Socket listeners
  useEffect(() => {
    const unsubUpdate = socketService.onStreamUpdate((state) => {
      setStream(state);
      if (!state.videoUrl) {
        navigate('/');
      }
    });

    const unsubVideo = socketService.onVideoEvent((event: VideoEvent) => {
      if (!videoRef) return;

      // Set flag to prevent feedback loop
      isHandlingRemoteEvent.current = true;

      // Update time display immediately
      setCurrentTime(event.time);
      setDuration(event.duration);

      if (event.action === 'play') {
        videoRef.currentTime = event.time;
        videoRef.play().catch(() => setNeedsInteraction(true));
        setIsPlaying(true);
      } else if (event.action === 'pause') {
        videoRef.pause();
        videoRef.currentTime = event.time;
        setIsPlaying(false);
      } else if (event.action === 'seek') {
        videoRef.currentTime = event.time;
      }

      // Reset flag after a short delay to allow DOM events to fire
      setTimeout(() => {
        isHandlingRemoteEvent.current = false;
      }, 100);
    });

    // Listen for reactions from other viewers
    const unsubReaction = socketService.onReaction((reaction: ReactionEvent) => {
      setReactions((prev) => [...prev, reaction]);

      // Remove reaction after animation completes (3.5 seconds to match longest animation)
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3500);
    });

    return () => {
      unsubUpdate();
      unsubVideo();
      unsubReaction();
    };
  }, [videoRef, navigate]);

  // Initialize HLS - only depends on videoRef and videoUrl
  useEffect(() => {
    if (!videoRef || !stream?.videoUrl) return;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const sourceUrl = needsProxy(stream.videoUrl) ? getProxiedUrl(stream.videoUrl) : stream.videoUrl;
    let initialSyncDone = false;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1, // Auto quality
      });
      hlsRef.current = hls;

      hls.loadSource(sourceUrl);
      hls.attachMedia(videoRef);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (initialSyncDone) return;
        initialSyncDone = true;

        // Sync with server state on initial load
        socketService.sync()
          .then(({ state, serverTime }) => {
            if (!videoRef) return;
            isHandlingRemoteEvent.current = true;

            // Account for network latency
            const latency = (Date.now() - serverTime) / 1000;
            const syncTime = state.isPlaying ? state.currentTime + latency : state.currentTime;

            if (syncTime > 0) {
              videoRef.currentTime = syncTime;
            }
            if (state.isPlaying) {
              videoRef.play().catch(() => setNeedsInteraction(true));
            }
            setTimeout(() => {
              isHandlingRemoteEvent.current = false;
            }, 300);
          })
          .catch((err) => {
            console.error('Initial sync failed:', err);
            isHandlingRemoteEvent.current = false;
          });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data.type, data.details);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Try to recover
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setVideoError('Failed to load video');
          }
        }
      });
    } else if (videoRef.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.src = sourceUrl;
    } else {
      setVideoError('HLS not supported in this browser');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoRef, stream?.videoUrl]); // Only re-init when URL changes

  // Video event handlers - everyone can control
  useEffect(() => {
    if (!videoRef) return;

    const onPlay = () => {
      setIsPlaying(true);
      // Only send if this is a local action, not a remote sync
      if (!isHandlingRemoteEvent.current) {
        socketService.sendVideoEvent('play', videoRef.currentTime, videoRef.duration);
      }
    };

    const onPause = () => {
      setIsPlaying(false);
      // Only send if this is a local action, not a remote sync
      if (!isHandlingRemoteEvent.current) {
        socketService.sendVideoEvent('pause', videoRef.currentTime, videoRef.duration);
      }
    };

    const onSeeked = () => {
      // Only send if this is a local action, not a remote sync
      if (!isHandlingRemoteEvent.current) {
        socketService.sendVideoEvent('seek', videoRef.currentTime, videoRef.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(videoRef.currentTime);
    };

    const onDurationChange = () => {
      setDuration(videoRef.duration);
    };

    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);

    videoRef.addEventListener('play', onPlay);
    videoRef.addEventListener('pause', onPause);
    videoRef.addEventListener('seeked', onSeeked);
    videoRef.addEventListener('timeupdate', onTimeUpdate);
    videoRef.addEventListener('durationchange', onDurationChange);
    videoRef.addEventListener('waiting', onWaiting);
    videoRef.addEventListener('playing', onPlaying);

    return () => {
      videoRef.removeEventListener('play', onPlay);
      videoRef.removeEventListener('pause', onPause);
      videoRef.removeEventListener('seeked', onSeeked);
      videoRef.removeEventListener('timeupdate', onTimeUpdate);
      videoRef.removeEventListener('durationchange', onDurationChange);
      videoRef.removeEventListener('waiting', onWaiting);
      videoRef.removeEventListener('playing', onPlaying);
    };
  }, [videoRef]);

  const handleLeave = useCallback(() => {
    // Cleanup HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    socketService.leave();
    sessionStorage.removeItem('userId');
    navigate('/');
  }, [navigate]);

  const handlePlay = useCallback(() => {
    videoRef?.play();
  }, [videoRef]);

  const handlePause = useCallback(() => {
    videoRef?.pause();
  }, [videoRef]);

  const handleSeek = useCallback((time: number) => {
    if (videoRef) videoRef.currentTime = time;
  }, [videoRef]);

  const handleSync = useCallback(() => {
    // Re-sync with server state
    isHandlingRemoteEvent.current = true;
    socketService.sync().then(({ state, serverTime }) => {
      if (videoRef && state.videoUrl) {
        // Account for network latency
        const latency = (Date.now() - serverTime) / 1000;
        const syncTime = state.isPlaying ? state.currentTime + latency : state.currentTime;

        videoRef.currentTime = syncTime;
        setCurrentTime(syncTime);
        setDuration(state.duration);

        if (state.isPlaying) {
          videoRef.play().catch(() => setNeedsInteraction(true));
          setIsPlaying(true);
        } else {
          videoRef.pause();
          setIsPlaying(false);
        }

        // Reset flag after a short delay
        setTimeout(() => { isHandlingRemoteEvent.current = false; }, 500);
      } else {
        isHandlingRemoteEvent.current = false;
      }
    }).catch(() => {
      isHandlingRemoteEvent.current = false;
    });
  }, [videoRef]);

  const handleEnablePlayback = useCallback(() => {
    videoRef?.play().then(() => setNeedsInteraction(false)).catch(() => { });
  }, [videoRef]);

  // Handle reaction - send to all viewers
  const handleReaction = useCallback((type: ReactionType) => {
    socketService.sendReaction(type);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Stream Ended</h2>
          <p className="text-dark-400 mb-6">{error || 'No active stream'}</p>
          <button onClick={() => navigate('/')} className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-dark-800 px-4 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">SyncStream</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-dark-400">
              <Users className="w-4 h-4" />
              <span className="text-sm">{stream.viewerCount} watching</span>
            </div>
            <button onClick={handleLeave} className="text-dark-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Video */}
      <main className="flex-1 flex flex-col min-h-0 p-2 sm:p-4 relative">
        <div className="flex-1 flex flex-col justify-center items-center max-w-5xl mx-auto w-full">
          {/* Movie Title */}
          {stream.movieTitle && (
            <div className="mb-2 sm:mb-4 flex-shrink-0">
              <h2 className="text-lg sm:text-2xl font-bold text-white text-center">
                {stream.movieTitle}
              </h2>
            </div>
          )}
          
          <VideoPlayer
            setVideoRef={setVideoRef}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isBuffering={isBuffering}
            error={videoError}
            needsInteraction={needsInteraction}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onSync={handleSync}
            onEnablePlayback={handleEnablePlayback}
            onReaction={handleReaction}
            reactions={reactions}
          />
        </div>
      </main>
    </div>
  );
}
