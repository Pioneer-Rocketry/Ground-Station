import { useState, useRef, useEffect } from 'react';
import { useTelemetry } from '../contexts/TelemetryContext';
import { useSocket } from '../contexts/SocketContext';

export function useSimulation() {
    const { setData, addLog, setIsHost, setConnectionStatus, isHost, updateTelemetry, clearSources, updatePath } = useTelemetry();
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
        clearSources();
        addLog('Starting Simulation Host...');
        setConnectionStatus('Simulating (Host)');

        // Helper to create a device
        const createDevice = (name, offsetLat = 0, offsetLng = 0) => ({
            name,
            time: 0,
            alt: 0,
            speed: 0,
            accel: 0,
            lat: 42.7329 + offsetLat, // Start near Platteville
            lng: -90.48 + offsetLng,
            heading: Math.random() * Math.PI * 2,
            engine_accel: 0,
            phase: 'IDLE' // IDLE, FLIGHT
        });

        // Initialize Devices
        const devices = [
            createDevice('PTR', 0.0001, 0.0001),
            createDevice('FLCTS', -0.0001, -0.0001)
        ];

        intervalRef.current = setInterval(() => {

            // Physics Update Loop
            devices.forEach(dev => {
                let { time, alt, speed, accel, lat, lng, heading, engine_accel } = dev;

                // Simulating a flight profile:
                if (time < 10) {
                // Launch
                    if (engine_accel === 0) engine_accel = 40 + (Math.random() * 5); // Init engine once
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

                // Save back to object
                dev.time = time;
                dev.alt = alt;
                dev.speed = speed;
                dev.accel = accel;
                dev.lat = lat;
                dev.lng = lng;
                dev.heading = heading;
                dev.engine_accel = engine_accel;


                // Construct Telemetry Packet
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

                // 1. Update LOCAL state via updateTelemetry (for multi-source widgets)
                // We update each relevant field with the source name
                updateTelemetry('altitude', data.altitude, dev.name);
                updateTelemetry('speedVert', data.speedVert, dev.name);
                updateTelemetry('accel', data.accel, dev.name);
                updateTelemetry('gpsLat', data.gpsLat, dev.name);
                updateTelemetry('gpsLng', data.gpsLng, dev.name);
                updatePath(dev.name, data.gpsLat, data.gpsLng, data.altitude);
                updateTelemetry('status', data.status, dev.name);
                updateTelemetry('statusCode', data.statusCode, dev.name);
                updateTelemetry('battVoltage', data.battVoltage, dev.name);
                updateTelemetry('flightTime', data.flightTime, dev.name);
                updateTelemetry('pyro', data.pyro, dev.name);
                updateTelemetry('message', data.message, dev.name);

                // 2. Broadcast separate packets for each source
                // Note: The server might expect a standard format.
                // If we send { ...data, source: dev.name }, the server/clients need to handle it.
                if (socket) {
                    socket.emit('host_data', { ...data, source: dev.name });
                }

                // 3. For 'Rocket', we ALSO drive the legacy single-source state for MapWidget/etc
                // that hasn't been upgraded to verify sources yet.
                if (dev.name === 'Rocket') {
                    setData(prev => ({ ...prev, ...data }));
                }
            });

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
