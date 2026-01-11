import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files
import path from 'path';

// Serve static files (in production, this contains the built React app)
app.use(express.static('dist'));

// Handle SPA routing: serve index.html for all other routes
app.get('*', (req, res) => {
    // Only serve index.html if we are not handling an API/socket request
    // and if the file actually exists (prod mode)
    // For now, minimal check:
    if (req.url.startsWith('/socket.io/')) return;

    const indexFile = path.resolve(__dirname, 'dist', 'index.html');
    res.sendFile(indexFile, (err) => {
        if (err) {
            // In dev mode (public/index.html doesn't exist), just 404
            res.status(404).send("Not found (if in dev, use Vite server)");
        }
    });
});
let activeHostId = null;
let lastHeartbeat = 0;

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Client wants to view stream
    socket.on('join_stream', () => {
        socket.join('viewers');

        const now = Date.now();
        const isHostActive = activeHostId && (now - lastHeartbeat < 3000);

        if (isHostActive) {
            socket.emit('stream_status', { active: true, msg: 'Joined stream' });
        } else {
            socket.emit('stream_status', { active: false, msg: 'Waiting for host...' });
        }
    });

    socket.on('leave_stream', () => {
        socket.leave('viewers');
        socket.emit('stream_status', { active: false, msg: 'Left stream' });
    });

    // Check status check
    socket.on('check_status', () => {
        const now = Date.now();
        const isActive = activeHostId && (now - lastHeartbeat < 3000);
        socket.emit('stream_status', { active: isActive });
    });

    // Host sending data
    socket.on('host_data', (data) => {
        // Simple logic: The first one to send data becomes the host, or we trust all 'host_data'
        // For robustness, let's just relay.

        activeHostId = socket.id;
        lastHeartbeat = Date.now();

        // Broadcast to all viewers, excluding the sender (host)
        socket.to('viewers').emit('telemetry', data);
    });

    socket.on('disconnect', () => {
        if (socket.id === activeHostId) {
            console.log('[Socket] Host disconnected');
            activeHostId = null;
            // Notify viewers?
            io.to('viewers').emit('stream_status', { active: false, msg: 'Host disconnected' });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Fluctus Web Interface running at http://localhost:${PORT}`);
});
