# Ludo Party — React + Socket.IO

Private-room Ludo starter built with React/Vite and Node/Express/Socket.IO. Rooms are created by the server; the invite URL uses `?room=ROOMCODE`. Maximum 4 players per room.

## Run locally

Requirements: Node.js 18+

```bash
npm install
npm run dev
```

Open http://localhost:5173. For two or more players, open the same URL in multiple browser profiles/devices on the same reachable server.

## Production

```bash
npm run build
npm start
```

The server serves `dist` and Socket.IO on `PORT` (default 3001). Deploy the Node process behind HTTPS reverse proxy and point your domain to it. Keep Socket.IO websocket and polling traffic enabled. For multi-instance scaling, add a shared Socket.IO adapter and persistent room store; this starter uses in-memory rooms and loses rooms on restart.

## Current game rules / limitations

- Create/join private rooms, 2–4 players, host starts, live player list, shareable URL.
- Turn-based dice, six required to leave home, six grants another roll, first player with all four tokens at finish wins.
- This is an MVP rules engine: it tracks pawn progress but does not yet implement the complete traditional Ludo board path, captures, safe squares, blockades, reconnect persistence, or anti-cheat validation. Extend `server/index.js` for full official rules before public release.
