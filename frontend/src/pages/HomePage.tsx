import { useState, FormEvent, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Heart, Link2, Film, InfinityIcon } from "lucide-react";
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
      if (event.data.type === "SYNCWITHYOU_M3U8_FOUND" || event.data.type === "SYNCSTREAM_M3U8_FOUND") {
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
    <div className="min-h-screen bg-gradient-to-br from-romantic-950 via-dark-900 to-pink-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Vibrant Animated Romantic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated gradient orbs */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-gradient-to-r from-romantic-600/30 to-pink-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-32 w-[400px] h-[400px] bg-gradient-to-l from-pink-600/25 to-romantic-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-romantic-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="absolute bottom-1/3 right-1/3 w-[350px] h-[350px] bg-pink-400/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        {/* Floating Hearts */}
        <div className="floating-heart floating-heart-1 text-4xl" style={{ left: '10%', animationDelay: '0s' }}>💕</div>
        <div className="floating-heart floating-heart-2 text-3xl" style={{ left: '25%', animationDelay: '2s' }}>❤️</div>
        <div className="floating-heart floating-heart-3 text-2xl" style={{ left: '40%', animationDelay: '4s' }}>💖</div>
        <div className="floating-heart floating-heart-4 text-5xl" style={{ left: '55%', animationDelay: '1s' }}>💗</div>
        <div className="floating-heart floating-heart-5 text-3xl" style={{ left: '70%', animationDelay: '3s' }}>💝</div>
        <div className="floating-heart floating-heart-6 text-4xl" style={{ left: '85%', animationDelay: '5s' }}>💞</div>
        <div className="floating-heart floating-heart-2 text-2xl" style={{ left: '5%', animationDelay: '6s' }}>❤️</div>
        <div className="floating-heart floating-heart-4 text-3xl" style={{ left: '92%', animationDelay: '7s' }}>💕</div>
        <div className="floating-heart floating-heart-1 text-xl" style={{ left: '33%', animationDelay: '8s' }}>💖</div>
        <div className="floating-heart floating-heart-3 text-4xl" style={{ left: '78%', animationDelay: '9s' }}>💗</div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo with Glow Effect */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-28 h-28 mb-4 relative animate-pulse-glow">
            <img src="/logo.png" alt="SyncWithYou Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-romantic font-semibold italic bg-gradient-to-r from-romantic-300 via-pink-200 to-romantic-400 bg-clip-text text-transparent mb-4 tracking-wide animate-gradient">
            SyncWithYou
          </h1>
          <p className="text-romantic-200/90 flex items-center justify-center gap-3 font-poetic italic">
            <InfinityIcon className="w-5 h-5 text-pink-400" />
            Even eternity feels brief beside you — Farrouhti.
            <InfinityIcon className="w-5 h-5 text-pink-400" />
          </p>
        </div>

        {/* Join active stream button */}
        {hasActiveStream && (
          <button
            onClick={handleJoinStream}
            disabled={loading}
            className="w-full mb-6 bg-gradient-to-r from-romantic-500 to-pink-500 hover:from-romantic-600 hover:to-pink-600 text-white font-medium py-4 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-romantic-500/25 hover:shadow-romantic-500/40 hover:scale-[1.02] transform"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Heart className="w-5 h-5 fill-current" />
                Join Your Love ({viewerCount} watching)
              </>
            )}
          </button>
        )}

        {/* Divider */}
        {hasActiveStream && (
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-romantic-700 to-transparent" />
            <span className="text-romantic-400/60 text-sm flex items-center gap-1">
              <Heart className="w-3 h-3" /> or start your own <Heart className="w-3 h-3" />
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-romantic-700 to-transparent" />
          </div>
        )}

        {/* Start stream form */}
        <form onSubmit={handleStartStream} className="space-y-4">
          {/* Toggle input mode */}
          <div className="flex gap-2 p-1 bg-dark-800/80 backdrop-blur-sm rounded-xl border border-romantic-800/30">
            <button
              type="button"
              onClick={() => setInputMode("movie")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${inputMode === "movie"
                ? "bg-gradient-to-r from-romantic-600 to-pink-600 text-white shadow-lg shadow-romantic-500/25"
                : "text-romantic-300/60 hover:text-romantic-200"
                }`}
            >
              <Film className="w-4 h-4 inline-block mr-1" />
              Movie Night
            </button>
            <button
              type="button"
              onClick={() => setInputMode("url")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${inputMode === "url"
                ? "bg-gradient-to-r from-romantic-600 to-pink-600 text-white shadow-lg shadow-romantic-500/25"
                : "text-romantic-300/60 hover:text-romantic-200"
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
                <label className="block text-romantic-300/60 text-sm mb-2 flex items-center gap-1">
                  <Film className="w-4 h-4" />
                  What shall we watch tonight?
                </label>
                <input
                  type="text"
                  value={movieName}
                  onChange={(e) => setMovieName(e.target.value)}
                  placeholder="Enter a romantic movie name... 🎬"
                  disabled={searchingWithExtension}
                  className="w-full bg-dark-800/80 backdrop-blur-sm border border-romantic-700/30 text-white rounded-xl px-4 py-3.5 focus:outline-none focus:border-romantic-500 focus:ring-2 focus:ring-romantic-500/20 transition-all disabled:opacity-50 placeholder:text-romantic-400/40"
                />
              </>
            ) : (
              <>
                <label className="block text-romantic-300/60 text-sm mb-2 flex items-center gap-1">
                  <Link2 className="w-4 h-4" />
                  Video URL (M3U8)
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Paste the .m3u8 video URL here... 💕"
                  className="w-full bg-dark-800/80 backdrop-blur-sm border border-romantic-700/30 text-white rounded-xl px-4 py-3.5 focus:outline-none focus:border-romantic-500 focus:ring-2 focus:ring-romantic-500/20 transition-all placeholder:text-romantic-400/40"
                />
              </>
            )}
          </div>

          {error && (
            <div className="bg-romantic-900/30 border border-romantic-700/30 text-romantic-300 rounded-xl px-4 py-3 text-sm backdrop-blur-sm">
              💔 {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              searchingWithExtension ||
              (inputMode === "url" ? !videoUrl.trim() : !movieName.trim())
            }
            className="w-full bg-gradient-to-r from-romantic-600 via-pink-600 to-romantic-500 hover:from-romantic-700 hover:via-pink-700 hover:to-romantic-600 text-white font-semibold py-4 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-romantic-500/30 hover:shadow-romantic-500/50 hover:scale-[1.02] transform group"
          >
            {loading || searchingWithExtension ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {searchingWithExtension ? "Finding your movie... 💕" : "Starting your date night..."}
              </>
            ) : (
              <>
                <Heart className="w-5 h-5 group-hover:animate-pulse fill-current" />
                {inputMode === "movie" ? "Start Movie Night" : "Begin Watching Together"}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
