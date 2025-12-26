import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Loader2, Tv, Link2, Users } from 'lucide-react';
import { socketService } from '../services/socket';

export function HomePage() {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasActiveStream, setHasActiveStream] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    // Connect and listen for stream updates (real-time)
    socketService.connect();

    const unsub = socketService.onStreamUpdate((state) => {
      setHasActiveStream(state.videoUrl !== '');
      setViewerCount(state.viewerCount);
    });

    return unsub;
  }, []);

  const handleStartStream = async (e: FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;

    setError('');
    setLoading(true);

    try {
      const response = await socketService.setVideo(videoUrl);
      if (response.error) {
        setError(response.error);
        setLoading(false);
        return;
      }
      if (response.userId) {
        sessionStorage.setItem('userId', response.userId);
        navigate('/watch');
      }
    } catch {
      setError('Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinStream = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await socketService.join();
      if (response.error) {
        setError(response.error);
        setLoading(false);
        return;
      }
      if (response.userId) {
        sessionStorage.setItem('userId', response.userId);
        navigate('/watch');
      }
    } catch {
      setError('Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
            <Tv className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">SyncStream</h1>
          <p className="text-dark-400">Watch videos together in real-time</p>
        </div>

        {/* Join active stream button */}
        {hasActiveStream && (
          <button
            onClick={handleJoinStream}
            disabled={loading}
            className="w-full mb-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-4 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Users className="w-5 h-5" />
                Join Stream ({viewerCount} watching)
              </>
            )}
          </button>
        )}

        {/* Divider */}
        {hasActiveStream && (
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-dark-700" />
            <span className="text-dark-500 text-sm">or start your own</span>
            <div className="flex-1 h-px bg-dark-700" />
          </div>
        )}

        {/* Start stream form */}
        <form onSubmit={handleStartStream} className="space-y-4">
          <div>
            <label className="block text-dark-400 text-sm mb-2">
              <Link2 className="w-4 h-4 inline-block mr-1" />
              Video URL (M3U8)
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/video.m3u8"
              className="w-full bg-dark-800 border border-dark-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !videoUrl.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Play className="w-5 h-5" />
                Start Stream
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
