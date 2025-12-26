import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Users, Link, Loader2, Tv } from 'lucide-react';
import { socketService } from '../services/socket';

export function HomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [videoUrl, setVideoUrl] = useState('');
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      socketService.connect();

      if (mode === 'create') {
        const response = await socketService.createRoom(videoUrl, userName);
        if (response.error) {
          setError(response.error);
          return;
        }
        if (response.roomId && response.userId) {
          sessionStorage.setItem('userId', response.userId);
          sessionStorage.setItem('userName', userName);
          navigate(`/room/${response.roomId}`);
        }
      } else {
        const response = await socketService.joinRoom(roomId, userName);
        if (response.error) {
          setError(response.error);
          return;
        }
        if (response.userId) {
          sessionStorage.setItem('userId', response.userId);
          sessionStorage.setItem('userName', userName);
          navigate(`/room/${roomId}`);
        }
      }
    } catch (err) {
      setError('Failed to connect to server');
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

        {/* Mode tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
              mode === 'create'
                ? 'bg-blue-600 text-white'
                : 'bg-dark-800 text-dark-400 hover:text-white'
            }`}
          >
            <Play className="w-4 h-4 inline-block mr-2" />
            Create Room
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
              mode === 'join'
                ? 'bg-blue-600 text-white'
                : 'bg-dark-800 text-dark-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-2" />
            Join Room
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User name */}
          <div>
            <label className="block text-dark-400 text-sm mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              required
              maxLength={50}
              className="w-full bg-dark-800 border border-dark-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {mode === 'create' ? (
            /* Video URL */
            <div>
              <label className="block text-dark-400 text-sm mb-2">
                <Link className="w-4 h-4 inline-block mr-1" />
                M3U8 Video URL
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.m3u8"
                required
                className="w-full bg-dark-800 border border-dark-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-dark-500 text-xs mt-2">
                Paste an HLS (.m3u8) video stream URL
              </p>
            </div>
          ) : (
            /* Room ID */
            <div>
              <label className="block text-dark-400 text-sm mb-2">
                Room ID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID"
                required
                className="w-full bg-dark-800 border border-dark-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {mode === 'create' ? 'Creating...' : 'Joining...'}
              </>
            ) : mode === 'create' ? (
              <>
                <Play className="w-5 h-5" />
                Create Room
              </>
            ) : (
              <>
                <Users className="w-5 h-5" />
                Join Room
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-dark-500 text-sm mt-8">
          Watch synchronized video streams with friends
        </p>
      </div>
    </div>
  );
}
