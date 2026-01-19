import React, { useState, useEffect } from 'react';
import { useTelemetry } from '../../contexts/TelemetryContext';
import { cn } from '../../lib/utils'; // Assuming this exists as seen in StatCard

export function TTLWidget({ className }) {
    const { lastPacketTimes } = useTelemetry();
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (ms) => {
        if (!ms) return '-';
        const diff = now - ms;
        // Clamp to 0 if time/clock skew
        const d = Math.max(0, diff);
        if (d < 1000) return `${d}ms`;
        if (d < 60000) return `${(d / 1000).toFixed(1)}s`;
        return `${(d / 60000).toFixed(1)}m`;
    };

    const sources = Object.entries(lastPacketTimes).sort();

    return (
        <div className={cn('bg-bg-panel border border-border-color rounded-lg p-4 relative flex flex-col justify-start', className)}>
            <span className="text-text-muted text-sm font-semibold uppercase tracking-wider mb-2">Time Since Last Packet</span>
            
            <div className="flex flex-col gap-2 overflow-y-auto w-full">
                {sources.length > 0 ? (
                    sources.map(([source, time]) => (
                        <div key={source} className="flex justify-between items-center w-full border-b border-white/5 last:border-0 pb-1 last:pb-0">
                            <span className="text-text-muted text-xs font-bold uppercase">{source}</span>
                            <span className={cn(
                                "font-mono text-sm font-bold", 
                                now - time > 5000 ? 'text-accent-warn' : 'text-accent-primary'
                            )}>
                                {formatTime(time)}
                            </span>
                        </div>
                    ))
                ) : (
                    <span className="text-text-muted text-xs italic">No data received</span>
                )}
            </div>
        </div>
    );
}
