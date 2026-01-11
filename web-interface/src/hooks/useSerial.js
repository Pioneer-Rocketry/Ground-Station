import { useState, useRef, useEffect } from 'react';
import { useTelemetry } from '../contexts/TelemetryContext';
import { useSocket } from '../contexts/SocketContext';
import { parseTelemetry } from '../lib/parser';

export function useSerial() {
    const { setData, addLog, setIsHost, setConnectionStatus } = useTelemetry();
    const { socket } = useSocket();
    
    const [port, setPort] = useState(null);
    const writerRef = useRef(null);
    const keepReadingRef = useRef(false);
    
    // Buffer for extensive data
    const incomingBufferRef = useRef('');

    const connectSerial = async () => {
        if (!navigator.serial) {
            alert('Web Serial API not supported in this browser.');
            return;
        }

        try {
            const newPort = await navigator.serial.requestPort();
            await newPort.open({ baudRate: 115200 });

            setPort(newPort);
            setIsHost(true);
            addLog('Port opened. Broadcasting as HOST.');
            setConnectionStatus('USB Host');

            // Setup Writer
            const textEncoder = new TextEncoderStream();
            const writableStreamClosed = textEncoder.readable.pipeTo(newPort.writable);
            writerRef.current = textEncoder.writable.getWriter();

            // Setup Reader
            keepReadingRef.current = true;
            readLoop(newPort);

        } catch (err) {
            console.error(err);
            addLog(`Connection failed: ${err.message}`, 'error');
            setConnectionStatus('Connection Failed');
        }
    };

    const readLoop = async (currentPort) => {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = currentPort.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable.getReader();

        try {
            while (keepReadingRef.current) {
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
            addLog(`Read error: ${error}`, 'error');
        } finally {
            reader.releaseLock();
        }
    };

    const bufferData = (chunk) => {
        incomingBufferRef.current += chunk;
        const lines = incomingBufferRef.current.split('\n');
        while (lines.length > 1) {
            const line = lines.shift();
            handleLine(line);
        }
        incomingBufferRef.current = lines[0];
    };

    const handleLine = (line) => {
        const data = parseTelemetry(line);
        if (data.type === 'telemetry') {
            // Update local state
            setData(prev => ({ ...prev, ...data }));
            
            // Broadcast via Socket
            broadcastData(data);
        } else if (data.type === 'other' && data.raw.trim().length > 0) {
            addLog(`RX: ${data.raw.trim()}`);
        }
    };

    // Throttle broadcasting
    const lastBroadcastRef = useRef(0);
    const broadcastData = (data) => {
        if (!socket) return;
        const now = Date.now();
        if (now - lastBroadcastRef.current > 100) {
            socket.emit('host_data', data);
            lastBroadcastRef.current = now;
        }
    };

    const sendCommand = async (cmd) => {
        if (!writerRef.current) {
            addLog('Error: Serial not connected', 'error');
            return;
        }
        try {
            addLog(`TX: ${cmd}`);
            await writerRef.current.write(cmd + '\n');
        } catch (e) {
            console.error(e);
            addLog(`TX Error: ${e.message}`, 'error');
        }
    };

    return { connectSerial, sendCommand, isConnected: !!port };
}
