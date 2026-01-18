import { useState, useRef, useEffect } from 'react';
import { useTelemetry } from '../contexts/TelemetryContext';

export function useDataReplay() {
    const { setData, addLog, setConnectionStatus, updateTelemetry, clearSources, updatePath } = useTelemetry();
    const intervalRef = useRef(null);
    const [isReplaying, setIsReplaying] = useState(false);
    const replayDataRef = useRef([]);
    const [replayData, setReplayData] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [fileName, setFileName] = useState(null);

    // Parse a single file content
    const parseContent = (text, fileName) => {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        // Use filename (without ext) as source name
        // e.g. "Rocket_Data.csv" -> "Rocket_Data"
        const sourceName = fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ");

        // Identify key columns
        const colMap = {
            time: headers.findIndex(h => h.startsWith('time')),
            state: headers.findIndex(h => h.startsWith('status')),
            alt: headers.findIndex(h => h.includes('baro-altitude') || h.includes('altitude')),
            speed: headers.findIndex(h => h.includes('speed')),
            accel: headers.findIndex(h => h.includes('accel')),
            lat: headers.findIndex(h => h.includes('Lat')),
            lng: headers.findIndex(h => h.includes('Lng')),
            voltage: headers.findIndex(h => h.includes('voltage')),
            gpsAlt: headers.findIndex(h => h.includes('gpsAlt')),
            sats: headers.findIndex(h => h.includes('gpsSats')),
        };

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length < headers.length * 0.5) continue;

            const entry = {
                time: parseFloat(cols[colMap.time]) || 0,
                status: cols[colMap.state] || 'UNKNOWN',
                altitude: parseFloat(cols[colMap.alt]) || 0,
                speedVert: parseFloat(cols[colMap.speed]) || 0,
                accel: parseFloat(cols[colMap.accel]) || 0,
                battVoltage: (parseFloat(cols[colMap.voltage]) || 0) / 1000,
                gpsLat: parseFloat(cols[colMap.lat]) || 0,
                gpsLng: parseFloat(cols[colMap.lng]) || 0,
                gpsAlt: parseFloat(cols[colMap.gpsAlt]) || 0,
                gpsSats: parseInt(cols[colMap.sats]) || 0,
                type: 'telemetry',
                source: sourceName
            };
            data.push(entry);
        }
        return data;
    };

    const loadFiles = async (fileList, autoPlay = false) => {
        if (!fileList || fileList.length === 0) return;

        // Create stable array from FileList immediately to avoid issues if input is cleared
        const files = Array.from(fileList);

        const promises = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const parsed = parseContent(e.target.result, file.name);
                    resolve(parsed);
                };
                reader.readAsText(file);
            });
        });

        const results = await Promise.all(promises);
        const merged = results.flat();

        if (merged.length > 0) {
            // Sort by time to ensure correct replay order
            // Assuming time is monotonic for all devices relative to same start,
            // or at least comparable.
            merged.sort((a, b) => a.time - b.time);

            // Update BOTH Ref (for logic) and State (for UI)
            replayDataRef.current = merged;
            setReplayData(merged);

            // Set filenames string
            const names = files.map(f => f.name).join(', ');
            setFileName(names);

            addLog(`Loaded ${merged.length} points from ${files.length} files`, 'success');
            setCurrentIndex(0);

            if (autoPlay) {
                setTimeout(() => startReplay(), 100);
            }
        } else {
            addLog('Failed to parse any data from files', 'error');
        }
    };

    const startReplay = () => {
        // Read from Ref to ensure we have latest data even if state update is pending
        const data = replayDataRef.current;

        if (data.length === 0) {
            addLog('No data loaded to replay', 'warn');
            return;
        }

        if (intervalRef.current) {
            stopReplay();
        }

        clearSources();
        setIsReplaying(true);
        setConnectionStatus(`Replaying: ${fileName || 'Ready'}`);
        addLog('Starting Data Replay...');

        let idx = currentIndex;
        if (idx >= data.length - 1) idx = 0;

        // Interval to process data
        intervalRef.current = setInterval(() => {
            if (idx >= data.length) {
                stopReplay();
                return;
            }

            // We might have multiple points with same (or very close) timestamp
            // Process all points within small window? Or just one by one fast?
            // Replaying 1-by-1 at 20ms might be slow if we have 5 devices.
            // Let's try to process a "batch" if timestamps are close?
            // For now, simple 1-by-1 frame is fine but limits speed.
            // Improved: Process all events for the current 'simulated time window'?
            // Let's stick to 1 frame per tick for simplicity, but maybe faster tick?

            const frame = data[idx];

            const statusMap = { '1': 'IDLE', '2': 'ARMED', '3': 'ASCENT', '4': 'APOGEE', '5': 'DESCENT', '6': 'LANDED' };
            const statusText = statusMap[frame.status] || frame.status;

            const packet = {
                ...frame,
                status: statusText,
                statusCode: parseInt(frame.status) || 0,
                gpsState: frame.gpsSats > 3 ? 3 : 0,
            };

            // Use frame.source for specific updates
            const src = frame.source || 'Import';

            updateTelemetry('altitude', packet.altitude, src);
            updateTelemetry('speedVert', packet.speedVert, src);
            updateTelemetry('accel', packet.accel, src);
            updateTelemetry('battVoltage', packet.battVoltage, src);
            updateTelemetry('gpsLat', packet.gpsLat, src);
            updateTelemetry('gpsLng', packet.gpsLng, src);
            updateTelemetry('status', packet.status, src);
            updateTelemetry('flightTime', packet.time / 1000, src);

            // Update Map Path
            // Prioritize Barometric Altitude (AGL) for visualization because map Extrusions are relative to terrain.
            // If we use GPS MSL, it would render 'MSL meters' ABOVE the ground, which is double-counting terrain height.
            const altForMap = packet.altitude !== 0 ? packet.altitude : packet.gpsAlt;
            if (packet.gpsLat !== 0 && packet.gpsLng !== 0) {
                updatePath(src, packet.gpsLat, packet.gpsLng, altForMap);
            }

            // Sync legacy state
            // If we have multiple sources, this 'legacy' state might flicker between them.
            // But Dashboard usually prioritizes source-specific data now.
            setData(prev => ({ ...prev, ...packet }));

            setCurrentIndex(idx);
            idx++;
        }, 10); // Faster tick (10ms) to handle more volume
    };

    const stopReplay = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsReplaying(false);
        setConnectionStatus('Replay Paused');
    };

    // Cleanup
    useEffect(() => {
        return () => stopReplay();
    }, []);

    return {
        startReplay,
        stopReplay,
        isReplaying,
        loadFiles,
        hasData: replayData.length > 0,
        progress: replayData.length > 0 ? (currentIndex / replayData.length) * 100 : 0
    };
}
