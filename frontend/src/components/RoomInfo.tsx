import { Copy, Check, Link } from 'lucide-react';
import { useState, useCallback } from 'react';

interface RoomInfoProps {
  roomId: string;
  videoUrl: string;
}

export function RoomInfo({ roomId, videoUrl }: RoomInfoProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(async () => {
    const url = `${window.location.origin}/room/${roomId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  return (
    <div className="bg-dark-800 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Link className="w-5 h-5 text-dark-400" />
        <h3 className="text-white font-medium">Room Info</h3>
      </div>

      <div className="space-y-3">
        {/* Room ID */}
        <div>
          <p className="text-dark-400 text-sm mb-1">Room ID</p>
          <div className="flex items-center gap-2">
            <code className="text-white bg-dark-700 px-3 py-2 rounded-xl flex-1 text-sm font-mono">
              {roomId}
            </code>
            <button
              onClick={copyLink}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl transition-colors"
              title="Copy invite link"
            >
              {copied ? (
                <Check className="w-5 h-5" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Video URL */}
        <div>
          <p className="text-dark-400 text-sm mb-1">Video URL</p>
          <p className="text-white bg-dark-700 px-3 py-2 rounded-xl text-sm truncate">
            {videoUrl}
          </p>
        </div>
      </div>
    </div>
  );
}
