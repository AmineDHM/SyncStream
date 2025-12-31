# SyncStream

A real-time synchronized video streaming platform. Share HLS (m3u8) video streams and watch together with anyone - no accounts needed.

Extract m3u8 URLs directly from video websites using our Chrome extension, then stream synchronized playback across all viewers.

![SyncStream](https://img.shields.io/badge/SyncStream-Watch%20Together-blue)
![Live](https://img.shields.io/badge/Status-Live-green)

**🌐 Live Demo:** [https://syncrostream.netlify.app](https://syncrostream.netlify.app)

## Features

- 🎬 **Single Global Stream** - One shared viewing experience for everyone
- 🔗 **HLS/M3U8 Support** - Stream any HLS video source
- 🔄 **Real-time Sync** - Synchronized play, pause, and seek across all viewers
- 👥 **Everyone Controls** - Any viewer can control playback
- 🔁 **Sync Button** - Re-sync with others if you get out of sync
- ⌨️ **Keyboard Controls** - Full keyboard support for easy control
- 📊 **Live Viewer Count** - See how many are watching
- 🌙 **Dark Mode** - Modern dark UI design
- ⚡ **No Sign-up** - Just paste a link and start watching
- 🔧 **Browser Extension** - Extract m3u8 URLs directly from video websites with one click

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` Left Arrow | Backward 10 seconds |
| `→` Right Arrow | Forward 10 seconds |
| `↑` Up Arrow | Volume up |
| `↓` Down Arrow | Volume down |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `S` | Sync with others |

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- hls.js (HLS video playback)
- Socket.IO Client (real-time communication)
- TailwindCSS (styling)
- Lucide Icons

### Backend
- Node.js 18+
- Express + Socket.IO
- TypeScript
- CORS proxy for HLS stream delivery

## 🚀 Browser Extension Setup

The SyncStream Browser Extension makes it easy to extract m3u8 URLs from video websites and open them directly in SyncStream.

### Installation

1. **Navigate to the extension folder:**
   ```bash
   cd browser-extension
   ```

2. **Load in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `browser-extension` folder
   - Done! The extension is now installed

### How to Use

1. Visit any website with video content (Netflix, YouTube, etc.)
2. The SyncStream floating button will appear on pages with video streams
3. Click the button to extract the m3u8 URL
4. Choose to:
   - **Copy to clipboard** - Copy the URL and paste it into SyncStream
   - **Open in SyncStream** - Opens SyncStream directly with the video URL
5. Start syncing with friends!

### Configuration

The extension can be configured to point to a custom SyncStream instance:
- Right-click the extension icon
- Click "Options"
- Set your custom SyncStream base URL
- Save

### Deployment
- **Frontend:** Netlify
- **Backend:** Render

## Project Structure

```
SyncStream/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # UI components (VideoPlayer)
│   │   ├── pages/            # HomePage, WatchPage
│   │   ├── services/         # Socket service
│   │   ├── utils/            # Proxy utilities
│   │   └── types.ts          # TypeScript types
│   └── ...
├── backend/                  # Node.js backend
│   ├── src/
│   │   ├── index.ts          # Server entry point
│   │   ├── socketHandlers.ts # Socket.IO event handlers
│   │   ├── roomManager.ts    # Stream state management
│   │   ├── hlsProxy.ts       # CORS proxy for HLS streams
│   │   └── types.ts          # TypeScript types
│   └── ...
├── browser-extension/        # Chrome extension for URL extraction
│   ├── manifest.json         # Extension configuration
│   ├── content.js            # Script injected into video websites
│   ├── popup.html/js         # Extension popup UI
│   └── ...
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+ installed
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AmineDHM/SyncStream.git
   cd SyncStream
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Running Locally

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   Server runs on `http://localhost:3001`

2. **Start the frontend (in a new terminal)**
   ```bash
   cd frontend
   npm run dev
   ```
   App opens at `http://localhost:5173`

### Environment Variables

#### Backend (`backend/.env`)
```env
PORT=3001
CLIENT_URL=http://localhost:5173
```

#### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3001
```

#### Frontend Production (`frontend/.env.production`)
```env
VITE_API_URL=https://syncstream-jvdx.onrender.com
```

## Usage

1. **Install the Browser Extension** (Recommended)
   - Load the `browser-extension` folder as an unpacked extension in Chrome
   - Visit a video website with HLS streams
   - Click the SyncStream button to extract the m3u8 URL
   - Choose to open in SyncStream or copy to clipboard

2. **Manual Method - Paste M3U8 URL**
   - Get an m3u8 URL (from your video website, browser DevTools, or extension)
   - Go to [SyncStream](https://syncrostream.netlify.app)
   - Paste the URL in the "Video URL" field
   - Click "Start Stream"

3. **Join a Stream**
   - If someone is already streaming, you'll see a "Join Stream" button
   - Click it to join instantly

4. **Watch Together**
   - Anyone can play, pause, or seek
   - Use the sync button (or press `S`) if you get out of sync
   - Use keyboard shortcuts for quick control

## Test Video URLs

Public HLS test streams you can use:

```
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8
https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8
```

## API Events

### Client → Server

| Event | Description |
|-------|-------------|
| `set-video` | Start a new stream with video URL |
| `join` | Join the active stream |
| `leave` | Leave the stream |
| `video-event` | Send play/pause/seek action |
| `sync` | Request current stream state |

### Server → Client

| Event | Description |
|-------|-------------|
| `stream-update` | Stream state update (viewers, URL, etc.) |
| `video-event` | Playback action from another viewer |

## How Sync Works

1. **Server Authority** - The server maintains the authoritative playback state with timestamps
2. **Everyone Controls** - Any connected viewer can control playback
3. **Real-time Broadcast** - Actions are broadcast to all other viewers instantly
4. **Latency Compensation** - Sync accounts for network latency to keep everyone aligned
5. **Manual Sync** - Press `S` or click the sync button to re-align with the server state

## Deployment

### Frontend (Netlify)

```bash
cd frontend
npm run build
# Deploy the 'dist' folder to Netlify
```

Build settings:
- Build command: `npm run build`
- Publish directory: `dist`

### Backend (Render)

```bash
cd backend
npm run build
npm start
```

Build settings:
- Build command: `npm install --include=dev && npm run build`
- Start command: `npm start`

## Future Enhancements

- [ ] Chat functionality
- [ ] Multiple streams/channels
- [ ] WebRTC voice chat
- [ ] Chromecast support
- [ ] Video quality selection
- [ ] Stream history

## License

MIT License - feel free to use this project for your own purposes.

---

Built with ❤️ for synchronized watching experiences
