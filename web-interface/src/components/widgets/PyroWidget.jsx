import React from 'react';
import { useTelemetry } from '../../contexts/TelemetryContext';
import { cn } from '../../lib/utils';

export function PyroWidget({ className }) {
    const { data } = useTelemetry();
    const { pyro } = data;

    const getStatusColor = (status) => {
        if (status === 'CONTINUITY') return 'text-accent-success';
        if (status === 'FIRED') return 'text-accent-warn';
        return 'text-text-muted';
    };

    return (
        <div className={cn("bg-bg-panel border border-border-color rounded-lg p-4", className)}>
             <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider mb-2">Pyrotechnics</h3>
             <div className="grid grid-cols-3 gap-2">
                {['A', 'B', 'C'].map(id => (
                    <div key={id} className="flex flex-col items-center bg-bg-dark rounded p-2 border border-white/5">
                        <span className="text-xs font-bold text-white mb-1">{id}</span>
                        <span className={cn("text-[10px] font-mono font-bold", getStatusColor(pyro[id]))}>
                            {pyro[id]}
                        </span>
                    </div>
                ))}
             </div>
        </div>
    );
}
