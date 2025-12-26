# SyncStream

A real-time synchronized video watching platform. Create rooms, share HLS (m3u8) video streams, and watch together with friends.

![SyncStream](https://img.shields.io/badge/SyncStream-Watch%20Together-blue)

## Features

- 🎬 **Create & Join Rooms** - Share unique room URLs with friends
- 🔗 **HLS/M3U8 Support** - Stream any HLS video source
- 🔄 **Real-time Sync** - Synchronized play, pause, and seek
- 👑 **Host Controls** - Only the host can control playback
- 🔁 **Auto-sync** - Late joiners automatically sync to current playback
- 📊 **Drift Correction** - Automatic correction when viewers get out of sync
- 👥 **Participant List** - See who's watching with you
- 🌙 **Dark Mode** - Modern dark UI design

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- hls.js (HLS video playback)
- Socket.IO Client (real-time communication)
- TailwindCSS (styling)
- Lucide Icons

### Backend
- Node.js 20+
- Express
- Socket.IO
- TypeScript
- Zod (validation)

## Project Structure

```
SyncStream/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   ├── services/         # Socket service
│   │   └── types.ts          # TypeScript types
│   └── ...
├── backend/                  # Node.js backend
│   ├── src/
│   │   ├── index.ts          # Server entry point
│   │   ├── socketHandlers.ts # Socket.IO event handlers
│   │   ├── roomManager.ts    # Room management logic
│   │   ├── validation.ts     # Zod schemas
│   │   └── types.ts          # TypeScript types
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

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   The server will start on `http://https://9z0r9x5b-5173.euw.devtunnels.ms`

2. **Start the frontend (in a new terminal)**
   ```bash
   cd frontend
   npm run dev
   ```
   The app will open at `http://https://9z0r9x5b-3001.euw.devtunnels.ms`

### Environment Variables

#### Backend (`backend/.env`)
```env
PORT=3001
CLIENT_URL=http://https://9z0r9x5b-3001.euw.devtunnels.ms
REDIS_URL=  # Optional, for scaling
```

#### Frontend (`frontend/.env`)
```env
VITE_SOCKET_URL=http://https://9z0r9x5b-5173.euw.devtunnels.ms
```

## Usage

1. **Create a Room**
   - Enter your name
   - Paste an M3U8/HLS video URL
   - Click "Create Room"

2. **Share the Room**
   - Copy the room link using the copy button
   - Share with friends

3. **Watch Together**
   - The host controls playback
   - All participants see synchronized video
   - Automatic sync keeps everyone in sync

## Test Video URLs

Here are some public HLS test streams you can use:

```
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8
https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8
```

## API Events

### Client → Server

| Event | Description |
|-------|-------------|
| `create-room` | Create a new watch room |
| `join-room` | Join an existing room |
| `leave-room` | Leave the current room |
| `video-event` | Send play/pause/seek action |
| `request-sync` | Request current room state |

### Server → Client

| Event | Description |
|-------|-------------|
| `room-state` | Full room state update |
| `video-event` | Playback action from host |
| `user-joined` | New user joined |
| `user-left` | User left the room |
| `host-changed` | Host has been reassigned |

## Synchronization Protocol

1. **Server Authority** - The server maintains the authoritative playback state
2. **Host Control** - Only the host can emit playback events
3. **Drift Detection** - Clients check drift every 5 seconds
4. **Auto-correction** - If drift exceeds 500ms, client seeks to correct position

## Security Features

- M3U8 URL validation
- Rate limiting on room creation (5 rooms/minute)
- Maximum 20 users per room
- Auto-cleanup of inactive rooms (10 minutes)

## Deployment

### Frontend (Vercel/Netlify)

```bash
cd frontend
npm run build
# Deploy the 'dist' folder
```

### Backend (Railway/Fly.io)

Ensure WebSocket support is enabled.

```bash
cd backend
npm run build
npm start
```

## Future Enhancements

- [ ] Chat functionality
- [ ] Room passwords
- [ ] WebRTC voice chat
- [ ] Chromecast support
- [ ] Multiple video quality selection
- [ ] Admin dashboard

## License

MIT License - feel free to use this project for your own purposes.

---

Built with ❤️ for synchronized watching experiences
