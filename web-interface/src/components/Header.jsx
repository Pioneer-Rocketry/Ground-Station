import React from 'react';
import { useTelemetry } from '../contexts/TelemetryContext';
import { useSocket } from '../contexts/SocketContext';
import { useSerial } from '../hooks/useSerial';
import favicon from '../images/favicon.ico';

export function Header({ onConnectSerial, onSimulate, onToggleStream }) {
    const { connectionStatus, isHost, isViewing } = useTelemetry();
    const { connected: socketConnected } = useSocket();

    return (
        <header className="h-16 border-b border-border-color bg-bg-panel flex items-center justify-between px-6 shrink-0">
            {/* Logo area */}
            <div className="flex items-center gap-3">
                <img src={favicon} alt="Logo" className="w-8 h-8 rounded-lg" />
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold tracking-tight leading-none text-white">FLUCTUS</h1>
                    <span className="text-[10px] font-mono text-accent-primary tracking-[0.2em] uppercase">Ground Station</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <button onClick={onConnectSerial} disabled={isViewing} className="px-4 py-1.5 text-xs font-bold border border-accent-primary text-accent-primary rounded hover:bg-accent-primary/10 disabled:opacity-50 transition-colors">
                        USB HOST
                    </button>
                    <button onClick={onSimulate} disabled={isViewing || isHost} className="px-4 py-1.5 text-xs font-bold border border-text-muted text-text-muted rounded hover:bg-white/5 disabled:opacity-50 transition-colors">
                        SIMULATE
                    </button>
                    <button onClick={onToggleStream} className={`px-4 py-1.5 text-xs font-bold border rounded transition-colors ${isViewing ? 'bg-accent-primary border-accent-primary text-white hover:bg-red-600' : 'border-blue-500 text-blue-500 hover:bg-blue-500/10'}`}>
                        {isViewing ? 'EXIT STREAM' : 'VIEW STREAM'}
                    </button>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 px-3 py-1 bg-black/30 rounded-full border border-white/10">
                    <div className={`w-2 h-2 rounded-full ${connectionStatus === 'Disconnected' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                    <span className="text-xs font-mono font-bold text-gray-300">{connectionStatus.toUpperCase()}</span>
                    {!socketConnected && <span className="text-[10px] text-red-500">(Socket Offline)</span>}
                </div>
            </div>
        </header>
    );
}
