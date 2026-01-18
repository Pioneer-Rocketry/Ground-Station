import React from 'react';
import { useTelemetry } from '../../contexts/TelemetryContext';
import { cn } from '../../lib/utils';

export function MessageWidget({ className }) {
    const { data } = useTelemetry();
    const { message } = data;

    let label = message.id;
    if (label === 'A') label = 'MAX ALT';
    if (label === 'S') label = 'MAX SPD';
    if (label === 'G') label = 'MAX ACC';

    const cleanValue = message.decodedValue !== undefined ? message.decodedValue : message.value;

    return (
        <div className={cn('bg-bg-panel border border-border-color rounded-lg p-4 flex flex-col', className)}>
            <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-1">Rolling Message</h3>
            <div className="flex-1 flex items-center justify-between px-4 bg-bg-dark rounded border border-white/5">
                <span className="text-lg font-bold text-accent-primary font-mono">{label}</span>
                <span className="text-lg font-bold text-white font-mono">{cleanValue}</span>
            </div>
        </div>
    );
}
