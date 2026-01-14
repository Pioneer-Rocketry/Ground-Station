import React from 'react';
import { useTelemetry } from '../../contexts/TelemetryContext';
import { cn } from '../../lib/utils';
import { Wifi } from 'lucide-react';

export function PyroWidget({ className, isMQTT }) {
    const { data } = useTelemetry();
    const { pyro } = data;

    const getStatusColor = (status) => {
        const statusColors = {
            CONTINUITY: 'text-green-500',
            ARMED: 'text-yellow-500',
            FIRED: 'text-red-600',
            DISABLED: 'text-gray-400',
            UNKNOWN: 'text-red-500',
        };

        return statusColors[status] || 'text-gray-500';
    };

    return (
        <div className={cn('bg-bg-panel border border-border-color rounded-lg p-4 relative', className)}>
            <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider mb-2">Pyrotechnics</h3>
            <div className="grid grid-cols-3 gap-2">
                {['A', 'B', 'C'].map((id) => (
                    <div key={id} className="flex flex-col items-center bg-bg-dark rounded p-2 border border-white/5">
                        <span className="text-xs font-bold text-white mb-1">{id}</span>
                        <span className={cn('text-[10px] font-mono font-bold', getStatusColor(pyro[id]))}>{pyro[id]}</span>
                    </div>
                ))}
            </div>
            {isMQTT && (
                <div className="absolute bottom-2 right-2 text-purple-400" title="Source: MQTT">
                    <Wifi size={12} />
                </div>
            )}
        </div>
    );
}
