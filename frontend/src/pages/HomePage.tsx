import { useState, FormEvent, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Play, Loader2, Tv, Link2, Users, Film } from "lucide-react";
import { socketService } from "../services/socket";

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [videoUrl, setVideoUrl] = useState("");
  const [movieName, setMovieName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasActiveStream, setHasActiveStream] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [inputMode, setInputMode] = useState<"url" | "movie">("movie");
  const [searchingWithExtension, setSearchingWithExtension] = useState(false);

  useEffect(() => {
    // Check for videoUrl in URL params (from browser extension)
    const urlParam = searchParams.get("videoUrl");
    if (urlParam) {
      setVideoUrl(urlParam);
      setInputMode("url");
    }

    // Listen for messages from browser extension (search results)
    const handleExtensionMessage = (event: MessageEvent) => {
      if (event.data.type === "SYNCSTREAM_M3U8_FOUND") {
        const { m3u8Url } = event.data;
        setVideoUrl(m3u8Url);
        setSearchingWithExtension(false);
        setInputMode("url");

        // Auto-start streaming immediately
        socketService
          .setVideo(m3u8Url)
          .then((response) => {
            if (response.error) {
              setError(response.error);
              setLoading(false);
            } else if (response.userId) {
              sessionStorage.setItem("userId", response.userId);
              navigate("/watch");
            }
          })
          .catch(() => {
            setError("Failed to connect");
            setLoading(false);
          });
      }
    };

    window.addEventListener("message", handleExtensionMessage);

    // Connect and listen for stream updates (real-time)
    socketService.connect();

    const unsub = socketService.onStreamUpdate((state) => {
      setHasActiveStream(state.videoUrl !== "");
      setViewerCount(state.viewerCount);
    });

    return () => {
      window.removeEventListener("message", handleExtensionMessage);
      unsub();
    };
  }, [searchParams]);

  const handleStartStream = async (e: FormEvent) => {
    e.preventDefault();

    const input = inputMode === "url" ? videoUrl : movieName;
    if (!input.trim()) return;

    setError("");
    setLoading(true);

    try {
      // If in movie mode, trigger extension search
      if (inputMode === "movie") {
        setSearchingWithExtension(true);

        // Send message to extension
        window.postMessage(
          {
            type: "SYNCSTREAM_SEARCH_MOVIE",
            movieName: movieName,
          },
          "*"
        );

        // Timeout after 2 minutes
        setTimeout(() => {
          if (searchingWithExtension) {
            setSearchingWithExtension(false);
            setLoading(false);
            setError("Search timed out. Extension may not be loaded.");
          }
        }, 120000);
        return;
      }

      // If in URL mode, use the provided URL directly
      let finalUrl = videoUrl;
      if (inputMode === "url" && finalUrl.trim()) {
        const response = await socketService.setVideo(finalUrl);
        if (response.error) {
          setError(response.error);
          setLoading(false);
          return;
        }
        if (response.userId) {
          sessionStorage.setItem("userId", response.userId);
          navigate("/watch");
        }
      }
    } catch (err) {
      setError("Failed to connect");
    } finally {
      if (inputMode === "url") {
        setLoading(false);
      }
    }
  };

  const handleJoinStream = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await socketService.join();
      if (response.error) {
        setError(response.error);
        setLoading(false);
        return;
      }
      if (response.userId) {
        sessionStorage.setItem("userId", response.userId);
        navigate("/watch");
      }
    } catch {
      setError("Failed to connect");
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
          {/* Toggle input mode */}
          <div className="flex gap-2 p-1 bg-dark-800 rounded-lg">
            <button
              type="button"
              onClick={() => setInputMode("movie")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                inputMode === "movie"
                  ? "bg-blue-600 text-white"
                  : "text-dark-400 hover:text-white"
              }`}
            >
              <Film className="w-4 h-4 inline-block mr-1" />
              Movie Name
            </button>
            <button
              type="button"
              onClick={() => setInputMode("url")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                inputMode === "url"
                  ? "bg-blue-600 text-white"
                  : "text-dark-400 hover:text-white"
              }`}
            >
              <Link2 className="w-4 h-4 inline-block mr-1" />
              Direct URL
            </button>
          </div>

          {/* Input field */}
          <div>
            {inputMode === "movie" ? (
              <>
                <label className="block text-dark-400 text-sm mb-2">
                  <Film className="w-4 h-4 inline-block mr-1" />
                  Movie Name
                </label>
                <input
                  type="text"
                  value={movieName}
                  onChange={(e) => setMovieName(e.target.value)}
                  placeholder="Type the movie name..."
                  disabled={searchingWithExtension}
                  className="w-full bg-dark-800 border border-dark-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                />
              </>
            ) : (
              <>
                <label className="block text-dark-400 text-sm mb-2">
                  <Link2 className="w-4 h-4 inline-block mr-1" />
                  Video URL (M3U8)
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Type or paste the .m3u8 video URL..."
                  className="w-full bg-dark-800 border border-dark-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              searchingWithExtension ||
              (inputMode === "url" ? !videoUrl.trim() : !movieName.trim())
            }
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading || searchingWithExtension ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {searchingWithExtension ? "Finding movie..." : "Starting..."}
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                {inputMode === "movie" ? "Search & Stream" : "Start Stream"}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
