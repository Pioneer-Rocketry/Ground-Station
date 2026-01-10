import { parseTelemetry } from './parser.js';
import { initMap, updateMapPosition } from './map.js';
import { initDraggableDashboard, resetLayout } from './dashboard.js';

// DOM Elements
const els = {
    statusText: document.querySelector('#connection-status .status-text'),
    statusInd: document.querySelector('#connection-status'),
    logContainer: document.getElementById('log-container'),

    // Header Buttons
    btnConnect: document.getElementById('btn-connect'),
    btnSimulate: document.getElementById('btn-simulate'),
    btnStream: document.getElementById('btn-stream'),
    btnResetLayout: document.getElementById('btn-reset-layout'),

    // Controls
    btnStart: document.getElementById('btn-start'),
    btnPing: document.getElementById('btn-ping'),
    btnArm: document.getElementById('btn-arm'),
    bandSelect: document.getElementById('band-select'),
    channelInput: document.getElementById('channel-input'),

    // Values
    valAltitude: document.getElementById('val-altitude'),
    valSpeed: document.getElementById('val-speed'),
    valStatus: document.getElementById('val-status'),
    valAccel: document.getElementById('val-accel'),
    valBatt: document.getElementById('val-batt'),
    valTime: document.getElementById('val-time'),
    valLat: document.getElementById('val-lat'),
    valLng: document.getElementById('val-lng'),
    valGpsState: document.getElementById('val-gps-state'),

    // Msg
    valMsgType: document.getElementById('val-msg-type'),
    valMsgVal: document.getElementById('val-msg-val'),

    // Pyro
    pyroA: document.querySelector('#pyro-a .pyro-val'),
    pyroB: document.querySelector('#pyro-b .pyro-val'),
    pyroC: document.querySelector('#pyro-c .pyro-val'),

    // Gmaps
    btnGmaps: document.getElementById('btn-gmaps'),
};

const socket = io();

// State
let port;
let reader;
let writer;
let keepReading = false;
let simulationInterval = null;
let isHost = false;
let lastBroadcast = 0;
let lastLat = 0;
let lastLng = 0;

// Utils
function log(msg, type = 'info') {
    const div = document.createElement('div');
    div.classList.add('log-entry');
    const time = new Date().toLocaleTimeString().split(' ')[0];
    div.textContent = `[${time}] ${msg}`;
    els.logContainer.append(div);
}

function updateStatus(connected, msg) {
    if (connected) {
        els.statusInd.classList.add('connected');
        els.statusText.textContent = msg || 'Connected';
    } else {
        els.statusInd.classList.remove('connected');
        els.statusText.textContent = msg || 'Disconnected';
    }
}

// -------------------------------------------------------------
// Socket / Remote Stream Logic
// -------------------------------------------------------------

socket.on('connect', () => {
    // Check if there is an active stream to show indication?
    // Optionally we could show "Stream Available" in UI
});

let isViewing = false;

socket.on('stream_status', (status) => {
    if (!status.active) {
        if (!isHost) {
            isViewing = false;
            updateStatus(false, status.msg || 'Stream Offline');
            log(status.msg || 'Stream Offline', 'warn');
            document.body.classList.remove('viewer-mode');
            els.btnStream.textContent = 'VIEW STREAM';
            els.btnStream.classList.remove('primary');
            els.btnStream.classList.add('accent-outline');
            resetDashboard(); // Reset on stream exit
        }
    } else {
        if (!isHost) {
            isViewing = true;
            updateStatus(true, 'Watching Stream');
            log('Connected to Remote Stream');
            document.body.classList.add('viewer-mode');
            els.btnStream.textContent = 'EXIT STREAM';
            els.btnStream.classList.remove('accent-outline');
            els.btnStream.classList.add('primary');
        }
    }
});

socket.on('telemetry', (data) => {
    // Only update if we are NOT the host
    if (!isHost) {
        updateDashboard(data);
    }
});

function toggleStream() {
    if (isViewing) {
        log('Leaving remote stream...');
        socket.emit('leave_stream');
        // socket.on('stream_status') will handle the UI update
    } else {
        isHost = false;
        // Stop any local simulation or serial
        if (simulationInterval) clearInterval(simulationInterval);
        // TODO: Close serial if open

        log('Connecting to remote stream...');
        socket.emit('join_stream');
    }
}

function broadcastData(data) {
    if (!isHost) return;

    const now = Date.now();
    // Throttle to ~100ms
    if (now - lastBroadcast > 100) {
        socket.emit('host_data', data);
        lastBroadcast = now;
    }
}


// -------------------------------------------------------------
// Web Serial Logic (HOST)
// -------------------------------------------------------------

async function connectSerial() {
    if (!navigator.serial) {
        alert('Web Serial API not supported in this browser. Use Chrome or Edge.');
        return;
    }

    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });

        isHost = true;
        log('Port opened. Broadcasting as HOST.');
        updateStatus(true, 'USB Host');

        // Setup Writer
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();

        // Setup Reader
        keepReading = true;
        readLoop();

    } catch (err) {
        console.error(err);
        log(`Connection failed: ${err.message}`, 'error');
        updateStatus(false, 'Connection Failed');
    }
}

async function readLoop() {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                reader.releaseLock();
                break;
            }
            if (value) {
                bufferData(value);
            }
        }
    } catch (error) {
        log(`Read error: ${error}`, 'error');
    } finally {
        reader.releaseLock();
    }
}

let incomingBuffer = '';
function bufferData(chunk) {
    incomingBuffer += chunk;
    const lines = incomingBuffer.split('\n');
    while (lines.length > 1) {
        const line = lines.shift();
        handleLine(line);
    }
    incomingBuffer = lines[0];
}

function handleLine(line) {
    const data = parseTelemetry(line);
    if (data.type === 'telemetry') {
        updateDashboard(data);
        // Broadcast
        broadcastData(data);
    } else if (data.type === 'other' && data.raw.trim().length > 0) {
        log(`RX: ${data.raw.trim()}`);
    }
}

async function sendCommand(cmd) {
    if (!isHost) {
        log('Error: Only HOST can send commands.', 'error');
        return;
    }
    if (writer) {
        log(`TX: ${cmd}`);
        await writer.write(cmd + '\n');
    } else {
        log('Error: Serial not connected', 'error');
    }
}

// -------------------------------------------------------------
// Simulation Logic (HOST)
// -------------------------------------------------------------

function startSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        updateStatus(false, 'Sim Stopped');
        return;
    }

    isHost = true;
    log('Starting Simulation Host...');
    updateStatus(true, 'Simulating (Host)');

    let time = 0;
    let alt = 0;
    let speed = 0;

    simulationInterval = setInterval(() => {
        if (time < 100) { alt += 5; speed = 5; }
        else if (time < 200) { alt += 50; speed = 50; }
        else { alt -= 10; speed = -10; if (alt < 0) alt = 0; }
        time += 0.5;

        const data = {
            type: 'telemetry',
            altitude: Math.floor(alt),
            speedVert: Math.floor(speed),
            accel: 9.8,
            status: time > 10 ? 'ASCENT' : 'ARMED',
            statusCode: time > 10 ? 4 : 1,
            battVoltage: 8200,
            flightTime: time,
            gpsLat: 42.0 + (time * 0.00001),
            gpsLng: -90.0,
            gpsState: 3,
            pyro: { A: 'CONTINUITY', B: 'DISABLED', C: 'UNKNOWN' },
            message: { id: 'A', value: 1234, decodedValue: 1234 }
        };

        updateDashboard(data);
        broadcastData(data);

    }, 200); // 5Hz Sim
}


// -------------------------------------------------------------
// Dashboard UI Updates
// -------------------------------------------------------------

function resetDashboard() {
    els.valAltitude.textContent = '--';
    els.valSpeed.textContent = '--';
    els.valStatus.textContent = 'WAITING';
    els.valStatus.style.color = 'var(--text-muted)';
    els.valAccel.textContent = '--';
    els.valBatt.textContent = '--';
    els.valTime.textContent = '--';
    els.valLat.textContent = '--';
    els.valLng.textContent = '--';
    els.valGpsState.textContent = '--';

    // Pyro
    ['pyroA', 'pyroB', 'pyroC'].forEach(k => {
        els[k].textContent = '--';
        els[k].style.color = 'var(--text-muted)';
    });

    els.valMsgType.textContent = '--';
    els.valMsgVal.textContent = '--';
}

function updateDashboard(data) {
    els.valAltitude.textContent = data.altitude;
    els.valSpeed.textContent = data.speedVert;
    els.valStatus.textContent = data.status;
    els.valAccel.textContent = data.accel.toFixed(1);
    els.valBatt.textContent = data.battVoltage;
    els.valTime.textContent = data.flightTime.toFixed(1);
    els.valLat.textContent = data.gpsLat.toFixed(6);
    els.valLng.textContent = data.gpsLng.toFixed(6);
    els.valGpsState.textContent = data.gpsState;

    // Update Map
    if (data.gpsLat && data.gpsLng && (data.gpsLat !== 0 || data.gpsLng !== 0)) {
        lastLat = data.gpsLat;
        lastLng = data.gpsLng;
        updateMapPosition(data.gpsLat, data.gpsLng);
    }

    if (data.pyro) {
        updatePyro(els.pyroA, data.pyro.A);
        updatePyro(els.pyroB, data.pyro.B);
        updatePyro(els.pyroC, data.pyro.C);
    }

    if (data.statusCode >= 1) els.valStatus.style.color = 'var(--accent-warn)';
    if (data.statusCode >= 4) els.valStatus.style.color = 'var(--accent-primary)';

    if (data.message) {
        let label = data.message.id;
        if (label === 'A') label = 'MAX ALT';
        if (label === 'S') label = 'MAX SPD';
        if (label === 'G') label = 'MAX ACC';
        els.valMsgType.textContent = label;
        els.valMsgVal.textContent = data.message.decodedValue !== undefined ? data.message.decodedValue : data.message.value;
    }
}

function updatePyro(el, state) {
    el.textContent = state;
    el.style.color = 'var(--text-muted)';
    if (state === 'CONTINUITY') el.style.color = 'var(--accent-success)';
    if (state === 'FIRED') el.style.color = 'var(--accent-warn)';
}


// -------------------------------------------------------------
// Event Listeners
// -------------------------------------------------------------

els.btnConnect.addEventListener('click', connectSerial);
els.btnSimulate.addEventListener('click', startSimulation);
els.btnStream.addEventListener('click', toggleStream);
els.btnResetLayout.addEventListener('click', resetLayout);

els.btnPing.addEventListener('click', () => {
    sendCommand('ping');
});

els.btnArm.addEventListener('click', () => {
    if (confirm('ARE YOU SURE YOU WANT TO ARM THE ROCKET?')) {
        sendCommand('startf');
    }
});

els.btnStart.addEventListener('click', () => {
    const band = els.bandSelect.value;
    let chan = els.channelInput.value;
    if (chan.length < 2) chan = '0' + chan;
    const cmd = `start${band}${chan}Fluctus`;
    sendCommand(cmd);
});

if (els.btnGmaps) {
    els.btnGmaps.addEventListener('click', () => {
        if (lastLat !== 0 && lastLng !== 0) {
            window.open(`https://www.google.com/maps?q=${lastLat},${lastLng}`, '_blank');
        } else {
            alert('No valid GPS fix yet.');
        }
    });
}

// Initial State
resetDashboard();
initMap();
initDraggableDashboard();
