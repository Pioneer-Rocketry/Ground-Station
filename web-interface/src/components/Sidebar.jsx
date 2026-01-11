import React, { useState } from 'react';
import { useTelemetry } from '../contexts/TelemetryContext';

export function Sidebar({ onCommand, onResetLayout }) {
    const { logs, isHost } = useTelemetry();
    const [band, setBand] = useState('0');
    const [channel, setChannel] = useState('00');

    const handleStart = () => {
        let c = channel;
        if (c.length < 2) c = '0' + c;
        onCommand(`start${band}${c}Fluctus`);
    }

    return (
        <aside className="w-80 border-r border-border-color bg-bg-panel flex flex-col shrink-0 overflow-hidden">
            
            {/* Mission Control Group */}
            <div className="p-4 border-b border-border-color">
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Mission Control</h2>
                
                <div className={`space-y-4 ${!isHost ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                        <label className="text-xs text-text-muted block mb-1">Band</label>
                        <select 
                            value={band} 
                            onChange={e => setBand(e.target.value)}
                            className="w-full bg-bg-dark border border-border-color rounded p-2 text-sm text-white focus:border-accent-primary outline-none"
                        >
                            <option value="0">902-928 MHz (US)</option>
                            <option value="1">863-870 MHz (EU)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-text-muted block mb-1">Channel (00-25)</label>
                        <input 
                            type="number" 
                            min="0" max="25"
                            value={channel}
                            onChange={e => setChannel(e.target.value)}
                            className="w-full bg-bg-dark border border-border-color rounded p-2 text-sm text-white focus:border-accent-primary outline-none"
                        />
                    </div>
                    <button 
                        onClick={handleStart}
                        className="w-full bg-accent-primary hover:bg-red-600 text-white font-bold py-2 rounded transition-colors text-sm"
                    >
                        INITIALIZE LINK
                    </button>
                </div>
            </div>

            {/* Commands Group */}
            <div className="p-4 border-b border-border-color">
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Commands</h2>
                <div className={`grid grid-cols-2 gap-2 ${!isHost ? 'opacity-50 pointer-events-none' : ''}`}>
                    <button 
                        onClick={() => onCommand('ping')}
                        className="bg-bg-dark border border-border-color hover:bg-white/5 text-white py-2 rounded text-sm font-bold transition-colors"
                    >
                        PING
                    </button>
                    <button 
                         onClick={() => {
                            if(confirm('ARM ROCKET?')) onCommand('startf');
                         }}
                        className="bg-red-900/30 border border-red-900/50 hover:bg-red-900/50 text-red-500 py-2 rounded text-sm font-bold transition-colors"
                    >
                        ARM
                    </button>
                </div>
            </div>

            {/* System Log */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 pb-2 border-b border-border-color flex justify-between items-center bg-bg-panel/50">
                    <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">System Log</h2>
                    <button onClick={onResetLayout} className="text-[10px] text-accent-primary hover:underline">RESET LAYOUT</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1 bg-black/20">
                    {logs.map((log, i) => (
                        <div key={i} className={`flex gap-2 ${
                            log.type === 'error' ? 'text-red-500' : 
                            log.type === 'warn' ? 'text-yellow-500' : 'text-text-muted'
                        }`}>
                            <span className="opacity-50">[{log.time}]</span>
                            <span>{log.msg}</span>
                        </div>
                    ))}
                    {logs.length === 0 && <span className="text-text-muted opacity-30 italic p-2">No logs yet...</span>}
                </div>
            </div>
        </aside>
    );
}
