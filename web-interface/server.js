const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// State to track if a host is active
let activeHostId = null;
let lastHeartbeat = 0;

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Client wants to view stream
    socket.on('join_stream', () => {
        const now = Date.now();
        // Check if host is alive (heartbeat within 3 seconds)
        if (activeHostId && (now - lastHeartbeat < 3000)) {
            socket.join('viewers');
            socket.emit('stream_status', { active: true, msg: 'Joined stream' });
        } else {
            socket.emit('stream_status', { active: false, msg: 'No active stream found' });
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
