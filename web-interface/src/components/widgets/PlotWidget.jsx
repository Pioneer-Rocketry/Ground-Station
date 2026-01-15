import React, { useState, useEffect, useRef } from 'react';
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import { cn } from '../../lib/utils';
import { Wifi } from 'lucide-react';

export function PlotWidget({ label, value, values = {}, unit, subLabel, className, color = '#8884d8', min, max }) {
    const [history, setHistory] = useState([]);

    // Derive active sources directly from props
    // We accumulate ALL sources seen over time if we really wanted to, but the chart usually only cares about what's current or what's in history?
    // Actually, for proper coloring of lines in history, we need to know all keys that HAVE appeared.
    // So we do need to track "all known sources" in state if we want the legend to persist, OR just show current.
    // But let's assume 'values' contains everything valid.
    // If we want to persist sources that disappear, we need state.
    // Let's stick to state for 'knownSources' but update it safely.

    // Better: Just scan history for unique keys for the lines?
    // That ensures lines are drawn for data that exists.
    // But history is an array of objects.
    // Let's do that: derive sources from history.

    const sources = React.useMemo(() => {
        const s = new Set();
        history.forEach((pt) => {
            Object.keys(pt).forEach((k) => {
                if (k !== 'time' && k !== 'default') s.add(k);
            });
            if (pt.default !== undefined) s.add('default');
        });

        const arr = Array.from(s);
        // If we have other sources, hide default/unknown to avoid clutter
        if (arr.length > 1) {
            return arr.filter((k) => k !== 'default' && k !== 'Unknown').sort();
        }
        // If empty and we have a value, maybe default?
        if (arr.length === 0 && value !== undefined) return ['default'];
        return arr.sort();
    }, [history, value]);

    // Keep track of value updates to append to history
    useEffect(() => {
        setHistory((prev) => {
            const now = Date.now();
            const point = { time: now, ...values };

            // Handle legacy/primary value fallback
            if (Object.keys(values).length === 0 && value !== undefined) {
                point.default = value;
            }

            return [...prev.slice(-49), point]; // Keep last 50
        });
    }, [values, value]); // Depend on values object

    // Global consistent palette for devices
    const GLOBAL_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    // Map sources to specific colors if we want (e.g. PTR always Blue, FLCTS always Red)
    // Or just rely on sorted order + generic palette.
    // Sorted order: FLCTS (idx 0), PTR (idx 1).
    // FLCTS -> Blue (#3b82f6)
    // PTR -> Red (#ef4444)
    // This is consistent.

    const getSourceColor = (source, index) => {
        if (source === 'default') return color; // Keep theme color for generic/default
        // Hash the source name to pick a color? Or just index?
        // Index of sorted sources is safest for "first color, second color" request.
        return GLOBAL_COLORS[index % GLOBAL_COLORS.length];
    };

    return (
        <div className={cn('bg-bg-panel border border-border-color rounded-lg relative overflow-hidden flex flex-col', className)}>
            {/* Header Area */}
            <div className="px-4 pt-3 shrink-0 flex items-start justify-between z-10">
                <span className="text-text-muted text-xs font-semibold uppercase tracking-wider block">{label}</span>

                <div className="flex flex-row gap-4 items-baseline">
                    {sources.length > 0 ? (
                        sources.map((source, idx) => {
                            const val = values[source];
                            const sourceColor = getSourceColor(source, idx);
                            // Only show if value exists or if it's 'default' fallback
                            if (val === undefined && source !== 'default') return null;

                            return (
                                <div key={source} className="flex items-baseline gap-2">
                                    <span className="text-[10px] font-mono uppercase font-bold" style={{ color: sourceColor }}>
                                        {source}
                                    </span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xs font-bold font-mono text-white">{typeof val === 'number' ? val.toFixed(1) : val !== undefined ? val : typeof value === 'number' ? value.toFixed(1) : value}</span>
                                        {unit && <span className="text-text-muted text-xs font-mono">{unit}</span>}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold font-mono text-white">{typeof value === 'number' ? value.toFixed(1) : value}</span>
                            {unit && <span className="text-text-muted text-xs font-mono">{unit}</span>}
                            {subLabel && <span className="text-text-muted text-xs opacity-70 ml-0.5">{subLabel}</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 w-full min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                        <YAxis domain={[min !== undefined ? min : 'auto', max !== undefined ? max : 'auto']} hide />
                        {sources.map((source, idx) => (
                            <Line key={source} type="monotone" dataKey={source} stroke={getSourceColor(source, idx)} strokeWidth={2} dot={false} isAnimationActive={false} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
