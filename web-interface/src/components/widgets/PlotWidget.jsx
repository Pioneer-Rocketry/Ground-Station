import React, { useState, useEffect, useRef } from 'react';
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import { cn } from '../../lib/utils';
import { Wifi } from 'lucide-react';

export function PlotWidget({ label, value, unit, subLabel, className, color = '#8884d8', min, max, isMQTT }) {
    const [history, setHistory] = useState([]);

    // Keep track of value updates to append to history
    useEffect(() => {
        setHistory((prev) => {
            return [...prev, { value: value || 0, time: Date.now() }];
        });
    }, [value]);

    return (
        <div className={cn('bg-bg-panel border border-border-color rounded-lg relative overflow-hidden flex flex-col', className)}>
            {/* Header Area */}
            <div className="px-4 pt-3 shrink-0 flex items-start justify-between z-10">
                <span className="text-text-muted text-xs font-semibold uppercase tracking-wider block">{label}</span>

                <div className="flex flex-col items-end">
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold font-mono text-white">{typeof value === 'number' ? value.toFixed(1) : value}</span>
                        {unit && <span className="text-text-muted text-xs font-mono">{unit}</span>}
                        {subLabel && <span className="text-text-muted text-[10px] opacity-70 ml-0.5">{subLabel}</span>}
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 w-full min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                        <YAxis domain={[min !== undefined ? min : 'auto', max !== undefined ? max : 'auto']} hide />
                        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>

                {/* MQTT Indicator - Bottom Right of chart area */}
                {isMQTT && (
                    <div className="absolute bottom-2 right-2 text-purple-400 z-10 pointer-events-none" title="Source: MQTT">
                        <Wifi size={12} />
                    </div>
                )}
            </div>
        </div>
    );
}
