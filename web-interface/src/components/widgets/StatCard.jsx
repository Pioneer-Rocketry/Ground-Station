import React from 'react';
import { cn } from '../../lib/utils';
import { X, Wifi } from 'lucide-react';

export function StatCard({
    label,
    value,
    values = {},
    unit,
    subLabel,
    className,
    valueColor, // 'text-white', 'text-accent-warn' etc
    onClose,
}) {
    // If we have specific sources, we want to show them
    const sources = Object.entries(values);

    return (
        <div className={cn('bg-bg-panel border border-border-color rounded-lg p-4 relative flex flex-col items-center justify-center min-w-[140px]', className)}>
            {onClose && (
                <button onClick={onClose} className="absolute top-2 right-2 text-text-muted hover:text-white transition-colors">
                    <X size={16} />
                </button>
            )}

            <span className="text-text-muted text-sm font-semibold uppercase tracking-wider mb-1">{label}</span>

            <div className="flex flex-row gap-4 items-baseline">
                {sources.length > 0 ? (
                    sources.map(([source, val]) => (
                        <div key={source} className="flex items-baseline gap-2">
                            <span className="text-text-muted text-[10px] font-bold uppercase">{source}</span>
                            <div className="flex items-baseline gap-1">
                                <span className={cn('text-sm font-bold font-mono', valueColor || 'text-white')}>{typeof val === 'number' ? val.toFixed(2) : val}</span>
                                {unit && <span className="text-text-muted text-[10px] font-mono">{unit}</span>}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex items-baseline gap-1">
                        <span className={cn('text-xs font-bold font-mono', valueColor || 'text-white')}>{value}</span>
                        {unit && <span className="text-text-muted text-xs font-mono">{unit}</span>}
                    </div>
                )}
            </div>

            {subLabel && <span className="text-text-muted text-xs mt-1">{subLabel}</span>}
        </div>
    );
}
