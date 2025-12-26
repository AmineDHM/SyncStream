import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LogOut, Loader2, AlertCircle } from 'lucide-react';
import { socketService } from '../services/socket';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { useSync } from '../hooks/useSync';
import { VideoPlayer } from '../components/VideoPlayer';
import { ParticipantsList } from '../components/ParticipantsList';
import { RoomInfo } from '../components/RoomInfo';
import { RoomState, VideoAction } from '../types';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Store initial state for video player
  const [initialVideoState, setInitialVideoState] = useState<{
    time: number;
    playing: boolean;
    lastUpdate: number;
  } | null>(null);

  const isHost = roomState?.hostId === userId;

  // Calculate actual initial time accounting for elapsed time since last update
  const computedInitialState = useMemo(() => {
    if (!initialVideoState) return { time: 0, playing: false };
    
    const { time, playing, lastUpdate } = initialVideoState;
    if (!playing) return { time, playing };
    
    // Add elapsed time since the server reported the position
    const elapsed = (Date.now() - lastUpdate) / 1000;
    return { time: time + elapsed, playing };
  }, [initialVideoState]);

  const handleVideoEvent = useCallback(
    (action: VideoAction, time: number) => {
      if (!roomId || !isHost) return;
      socketService.sendVideoEvent(roomId, action, time);
    },
    [roomId, isHost]
  );

  const {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    isBuffering,
    error: videoError,
    needsInteraction,
    play,
    pause,
    seek,
    handleRemoteEvent,
    enablePlayback,
  } = useVideoPlayer({
    videoUrl: roomState?.videoUrl || '',
    isHost,
    onVideoEvent: handleVideoEvent,
    initialTime: computedInitialState.time,
    initialPlaying: computedInitialState.playing,
  });

  // Sync hook
  const { isSynced, driftMs, forceSync } = useSync({
    roomId: roomId || '',
    isHost,
    getCurrentTime: () => videoRef.current?.currentTime || 0,
    isPlaying: () => !videoRef.current?.paused,
    seek,
    play,
    pause,
  });

  // Initialize connection and join room
  useEffect(() => {
    if (!roomId) {
      setError('Invalid room ID');
      setLoading(false);
      return;
    }

    const storedUserId = sessionStorage.getItem('userId');
    const storedUserName = sessionStorage.getItem('userName');

    const captureInitialState = (state: RoomState) => {
      // Only capture initial state once
      if (!initialVideoState) {
        setInitialVideoState({
          time: state.currentTime,
          playing: state.isPlaying,
          lastUpdate: state.lastTimeUpdate,
        });
      }
    };

    // If already have userId, we're already in the room (came from create)
    if (storedUserId) {
      setUserId(storedUserId);
      
      // Request current room state
      socketService.connect();
      socketService.requestSync(roomId).then((response) => {
        if (response.success && response.roomState) {
          setRoomState(response.roomState);
          captureInitialState(response.roomState);
          setLoading(false);
        } else {
          // Try to rejoin
          if (storedUserName) {
            socketService.joinRoom(roomId, storedUserName).then((joinResponse) => {
              if (joinResponse.error) {
                setError(joinResponse.error);
              } else if (joinResponse.roomState && joinResponse.userId) {
                setUserId(joinResponse.userId);
                sessionStorage.setItem('userId', joinResponse.userId);
                setRoomState(joinResponse.roomState);
                captureInitialState(joinResponse.roomState);
              }
              setLoading(false);
            });
          } else {
            // No username stored, redirect to home
            navigate('/');
          }
        }
      });
    } else if (storedUserName) {
      // Join room with stored username
      socketService.connect();
      socketService.joinRoom(roomId, storedUserName).then((response) => {
        if (response.error) {
          setError(response.error);
        } else if (response.roomState && response.userId) {
          setUserId(response.userId);
          sessionStorage.setItem('userId', response.userId);
          setRoomState(response.roomState);
          captureInitialState(response.roomState);
        }
        setLoading(false);
      });
    } else {
      // Redirect to home to enter username
      navigate(`/?join=${roomId}`);
    }
  }, [roomId, navigate, initialVideoState]);

  // Socket event listeners
  useEffect(() => {
    if (!roomId) return;

    const unsubVideoEvent = socketService.onVideoEvent((event) => {
      handleRemoteEvent(event);
      // Update roomState to keep sync calculations accurate
      setRoomState((prev) => 
        prev ? { 
          ...prev, 
          currentTime: event.time,
          isPlaying: event.action === 'play' ? true : event.action === 'pause' ? false : prev.isPlaying,
          lastTimeUpdate: event.serverTime,
        } : null
      );
    });

    const unsubUserJoined = socketService.onUserJoined(({ users }) => {
      setRoomState((prev) =>
        prev ? { ...prev, users } : null
      );
    });

    const unsubUserLeft = socketService.onUserLeft(({ users }) => {
      setRoomState((prev) =>
        prev ? { ...prev, users } : null
      );
    });

    const unsubHostChanged = socketService.onHostChanged(({ newHostId }) => {
      setRoomState((prev) =>
        prev ? { ...prev, hostId: newHostId } : null
      );
    });

    return () => {
      unsubVideoEvent();
      unsubUserJoined();
      unsubUserLeft();
      unsubHostChanged();
    };
  }, [roomId, handleRemoteEvent]);

  const handleLeaveRoom = useCallback(() => {
    if (roomId && userId) {
      socketService.leaveRoom(roomId, userId);
    }
    sessionStorage.removeItem('userId');
    navigate('/');
  }, [roomId, userId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-dark-400">Joining room...</p>
        </div>
      </div>
    );
  }

  if (error || !roomState) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            Unable to Join Room
          </h2>
          <p className="text-dark-400 mb-6">
            {error || 'Room not found or has expired'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="border-b border-dark-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">SyncStream</h1>
          <button
            onClick={handleLeaveRoom}
            className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Leave Room
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video player */}
          <div className="lg:col-span-3">
            <VideoPlayer
              videoRef={videoRef}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              isBuffering={isBuffering}
              isHost={isHost}
              error={videoError}
              isSynced={isSynced}
              driftMs={driftMs}
              needsInteraction={needsInteraction}
              onPlay={play}
              onPause={pause}
              onSeek={seek}
              onSync={forceSync}
              onEnablePlayback={enablePlayback}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <RoomInfo roomId={roomState.roomId} videoUrl={roomState.videoUrl} />
            <ParticipantsList
              users={roomState.users}
              hostId={roomState.hostId}
              currentUserId={userId || ''}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
