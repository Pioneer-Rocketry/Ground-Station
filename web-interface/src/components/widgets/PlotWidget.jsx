import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ResponsiveContainer, LineChart, Line, YAxis, XAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { cn } from '../../lib/utils';
import { Wifi, Maximize2, X } from 'lucide-react';

export function PlotWidget({ label, value, values = {}, unit, subLabel, className, color = '#8884d8', min, max }) {
    const [history, setHistory] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);

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

    const maxValues = React.useMemo(() => {
        const maxs = {};
        sources.forEach((source) => {
            const sourceMax = Math.max(...history.map((pt) => pt[source] || -Infinity));
            if (isFinite(sourceMax)) maxs[source] = sourceMax;
        });
        return maxs;
    }, [history, sources]);

    const minValues = React.useMemo(() => {
        const mins = {};
        sources.forEach((source) => {
            const sourceMin = Math.min(
                ...history.map((pt) => {
                    const v = pt[source];
                    return v !== undefined && v !== null ? v : Infinity;
                })
            );
            if (isFinite(sourceMin)) mins[source] = sourceMin;
        });
        return mins;
    }, [history, sources]);

    // Keep track of value updates to append to history
    useEffect(() => {
        setHistory((prev) => {
            const now = Date.now();
            const point = { time: now, ...values };

            // Handle legacy/primary value fallback
            if (Object.keys(values).length === 0 && value !== undefined) {
                point.default = value;
            }

            // Determine window size based on number of active sources in the specific update
            // Note: This relies on 'values' containing all concurrent sources.
            // If sources report at different rates, we might flicker if we only check 'values'.
            // However, the Dashboard passes the complete 'valuesBySource' state, so it should be stable.
            const activeKeys = Object.keys(values).filter((k) => k !== 'time' && k !== 'default' && k !== 'Unknown');
            const isMultiDevice = activeKeys.length > 1;

            // "Running" mode for multi-device (50 points), "Cumulative" for single (2000 points)
            const windowSize = isMultiDevice ? 50 : 2000;

            return [...prev, point].slice(-windowSize);
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
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsExpanded(true)} className="text-text-muted hover:text-white transition-colors">
                        <Maximize2 size={14} />
                    </button>
                    <span className="text-text-muted text-xs font-semibold uppercase tracking-wider block">{label}</span>
                </div>

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
            {/* Fullscreen Portal */}
            {isExpanded &&
                createPortal(
                    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-10">
                        <div className="bg-bg-panel border border-border-color rounded-xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                            {/* Modal Header */}
                            <div className="p-4 border-b border-border-color flex justify-between items-center bg-black/20">
                                <div>
                                    <h2 className="text-xl font-bold text-white tracking-wide">{label}</h2>
                                    <p className="text-xs text-text-muted uppercase tracking-wider">Detailed Analysis View</p>
                                </div>
                                <button onClick={() => setIsExpanded(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Detailed Chart */}
                            <div className="flex-1 w-full min-h-0 p-6 bg-bg-dark/50">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={history}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis dataKey="time" domain={['auto', 'auto']} tickFormatter={(t) => new Date(t).toLocaleTimeString()} stroke="#666" fontSize={12} tick={{ fill: '#888' }} height={50} />
                                        <YAxis domain={[min !== undefined ? min : 'auto', max !== undefined ? max : 'auto']} stroke="#666" fontSize={12} tick={{ fill: '#888' }} unit={unit} width={50} />
                                        <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '4px' }} labelFormatter={(t) => new Date(t).toLocaleTimeString()} />
                                        {sources.map((source, idx) => (
                                            <ReferenceLine
                                                key={`ref-max-${source}`}
                                                y={maxValues[source]}
                                                stroke={getSourceColor(source, idx)}
                                                strokeDasharray="3 3"
                                                label={{
                                                    value: label.toLowerCase().includes('altitude') ? `Apogee: ${maxValues[source]}` : `Max: ${maxValues[source]}`,
                                                    fill: getSourceColor(source, idx),
                                                    fontSize: 12,
                                                    position: 'insideTopRight',
                                                }}
                                            />
                                        ))}
                                        {sources.map((source, idx) => (
                                            <ReferenceLine
                                                key={`ref-min-${source}`}
                                                y={minValues[source]}
                                                stroke={getSourceColor(source, idx)}
                                                strokeDasharray="3 3"
                                                label={{
                                                    value: `Min: ${minValues[source]}`,
                                                    fill: getSourceColor(source, idx),
                                                    fontSize: 12,
                                                    position: 'insideBottomRight',
                                                }}
                                            />
                                        ))}
                                        {sources.map((source, idx) => (
                                            <Line key={source} type="monotone" dataKey={source} stroke={getSourceColor(source, idx)} strokeWidth={2} dot={false} isAnimationActive={false} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
