import { useState, useRef, useEffect } from 'react';
import { useTelemetry } from '../contexts/TelemetryContext';
import { useSocket } from '../contexts/SocketContext';

export function useSimulation() {
    const { setData, addLog, setIsHost, setConnectionStatus, isHost } = useTelemetry();
    const { socket } = useSocket();
    const intervalRef = useRef(null);
    const [isSimulating, setIsSimulating] = useState(false);

    const startSimulation = () => {
        if (isSimulating) {
            stopSimulation();
            return;
        }

        setIsHost(true);
        setIsSimulating(true);
        addLog('Starting Simulation Host...');
        setConnectionStatus('Simulating (Host)');

        let time = 0;
        let alt = 0;
        let speed = 0;

        intervalRef.current = setInterval(() => {
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
                gpsLat: 36.6658 + (time * 0.00001), 
                gpsLng: -95.5371, // Tulsa-ish
                gpsState: 3,
                pyro: { A: 'CONTINUITY', B: 'DISABLED', C: 'UNKNOWN' },
                message: { id: 'A', value: 1234, decodedValue: 1234 }
            };

            // Update local
            setData(prev => ({ ...prev, ...data }));
            
            // Broadcast
            if (socket) socket.emit('host_data', data);

        }, 200);
    };

    const stopSimulation = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsSimulating(false);
        setConnectionStatus('Sim Stopped');
        addLog('Simulation Stopped');
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => stopSimulation();
    }, []);

    return { startSimulation, stopSimulation, isSimulating };
}
