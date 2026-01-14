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
        let lat = 42.7329;
        let lng = -90.48;
        let heading = 0; // Radians
        let engine_accel = 0;
        let accel = 0;

        let step = 0;

        intervalRef.current = setInterval(() => {
            step++;

            // Simulating a flight profile:
            // 0-100: Launch & Ascent (High accel, increasing alt)
            // 100-200: Coast (Negative accel/gravity, slower ascent)
            // 200+: Descent (Negative accel, decreasing alt)

            if (time < 10) {
                // Launch
                engine_accel = 40 + (Math.random() * 5);
                accel = engine_accel;
            } else if (time < 30) {
                // Coast
                accel = -9.8;
            } else {
                // Landed / Descent
                if (alt > 0) {
                    accel = -9.8;
                } else {
                    accel = 0;
                    alt = 0;
                    speed = 0;
                }
            }

            // Physics integration (very basic)
            speed += accel * 0.2; // 0.2s timestep
            alt += speed * 0.2;

            if (alt < 0) { alt = 0; speed = 0; accel = 0; }

            time += 0.2;

            // Update GPS with random turns or drift
            heading += (Math.random() - 0.5) * 0.1;
            const moveSpeed = speed > 0 ? 0.0001 : 0.00002; 
            lat += Math.cos(heading) * moveSpeed;
            lng += Math.sin(heading) * moveSpeed;

            const data = {
                type: 'telemetry',
                altitude: Math.floor(alt),
                speedVert: Math.floor(speed),
                accel: parseFloat(accel.toFixed(1)),
                status: time < 5 ? 'ARMED' : (time < 30 ? 'ASCENT' : 'DESCENT'),
                statusCode: time < 5 ? 1 : (time < 30 ? 4 : 5),
                battVoltage: 8 - (Math.random() * 0.01), // Battery drains slightly
                flightTime: time,
                gpsLat: lat,
                gpsLng: lng,
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
