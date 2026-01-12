import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';

const TelemetryContext = createContext(null);

export const useTelemetry = () => useContext(TelemetryContext);

const INITIAL_DATA = {
    altitude: 0,
    speedVert: 0,
    accel: 0,
    status: 'WAITING',
    statusCode: 0,
    battVoltage: 0,
    flightTime: 0,
    gpsLat: 0,
    gpsLng: 0,
    gpsState: 0,
    pyro: { A: 'UNKNOWN', B: 'UNKNOWN', C: 'UNKNOWN' },
    message: { id: '--', value: 0 },
};

export function TelemetryProvider({ children }) {
    const { socket } = useSocket();
    const [data, setData] = useState(INITIAL_DATA);
    const [logs, setLogs] = useState([]);
    const [isHost, setIsHost] = useState(false);
    const [isViewing, setIsViewing] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');
    // Track source of each data field: 'serial', 'mqtt', or undefined/default
    const [sources, setSources] = useState({});

    const setSource = (key, source) => {
        setSources((prev) => ({ ...prev, [key]: source }));
    };

    const updateSources = (newSources) => {
        setSources((prev) => ({ ...prev, ...newSources }));
    };

    const clearSources = () => {
        setSources({});
    };

    const addLog = (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString().split(' ')[0];
        setLogs((prev) => [...prev.slice(-49), { time, msg, type }]); // Keep last 50
    };

    // Manage connection manually
    useEffect(() => {
        if (!socket) return;

        const shouldConnect = isViewing || isHost;

        if (shouldConnect && !socket.connected) {
            console.log('Connecting socket...');
            socket.connect();
        } else if (!shouldConnect && socket.connected) {
            console.log('Disconnecting socket...');
            socket.disconnect();
        }
    }, [isViewing, isHost, socket]);

    // Join the stream room
    useEffect(() => {
        if (!socket) return;

        const handleConnect = () => {
            if (isViewing && !isHost) {
                console.log('Connected, joining stream...');
                socket.emit('join_stream');
            }
        };

        socket.on('connect', handleConnect);

        // If we assume we just connected or state changed
        if (socket.connected && isViewing && !isHost) {
            socket.emit('join_stream');
        }

        return () => {
            socket.off('connect', handleConnect);
        };
    }, [socket, isViewing, isHost]);

    useEffect(() => {
        if (!socket) return;

        socket.on('telemetry', (newData) => {
            if (!isHost) {
                // Merge/Update data
                setData((prev) => ({ ...prev, ...newData }));
            }
        });

        socket.on('stream_status', (status) => {
            if (status.active) {
                setConnectionStatus('Stream Online');
                // Ensure we are viewing if we aren't already (though we should be)
                if (!isHost && !isViewing) {
                    // We could auto-join if we wanted, but sticking to manual for now.
                }
            } else {
                setConnectionStatus(status.msg || 'Waiting for Host...');
                // Do NOT set isViewing(false) here, so we stay in "Stream Mode" waiting for host.
                if (!isHost && isViewing) {
                    addLog(status.msg || 'Waiting for Host...', 'warn');
                }
            }
        });

        return () => {
            socket.off('telemetry');
            socket.off('stream_status');
        };
    }, [socket, isHost, isViewing]);

    return (
        <TelemetryContext.Provider
            value={{
                data,
                setData,
                logs,
                addLog,
                isHost,
                setIsHost,
                isViewing,
                setIsViewing,
                connectionStatus,
                setConnectionStatus,
                sources,
                setSource,
                updateSources,
                clearSources,
            }}>
            {children}
        </TelemetryContext.Provider>
    );
}
