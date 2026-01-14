import React from 'react';
import { Menu, MoreVertical } from 'lucide-react';
import { useTelemetry } from '../contexts/TelemetryContext';
import { useSocket } from '../contexts/SocketContext';
import { useSerial } from '../hooks/useSerial';
import favicon from '../images/favicon.ico';

export function Header({ onConnectSerial, onSimulate, onToggleStream, onOpenMQTT, mqttStatus, onDisconnectMQTT, onToggleSidebar }) {
    const { connectionStatus, isHost, isViewing } = useTelemetry();
    const { connected: socketConnected } = useSocket();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const handleOpenMQTT = () => {
        setIsMobileMenuOpen(false);
        onOpenMQTT();
    };

    return (
        <header className="h-16 border-b border-border-color bg-bg-panel flex items-center justify-between px-4 md:px-6 shrink-0 gap-4">
            {/* Logo area */}
            <div className="flex items-center gap-3 shrink-0">
                <button onClick={onToggleSidebar} className="md:hidden text-text-muted hover:text-white">
                    <Menu size={24} />
                </button>
                <img src={favicon} alt="Logo" className="w-8 h-8 rounded-lg" />
                <div className="flex flex-col justify-center h-full">
                    <h1 className="text-lg font-bold tracking-[0.1em] text-white uppercase">Ground Station</h1>
                </div>
            </div>

            {/* Desktop Controls */}
            <div className="hidden md:flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <button onClick={onConnectSerial} disabled={isViewing} className="px-4 py-1.5 text-xs font-bold border border-accent-primary text-accent-primary rounded hover:bg-accent-primary/10 disabled:opacity-50 transition-colors">
                        USB HOST
                    </button>
                    <button
                        onClick={mqttStatus === 'Connected' ? onDisconnectMQTT : onOpenMQTT}
                        disabled={isViewing || connectionStatus === 'USB Host'}
                        className={`px-4 py-1.5 text-xs font-bold border rounded transition-colors ${mqttStatus === 'Connected' ? 'bg-green-600/20 border-green-500 text-green-500 hover:bg-green-600/30' : 'border-purple-500 text-purple-500 hover:bg-purple-500/10'}`}>
                        {mqttStatus === 'Connected' ? 'MQTT ACTIVE' : 'MQTT'}
                    </button>
                    <button onClick={onSimulate} disabled={isViewing || isHost} className="px-4 py-1.5 text-xs font-bold border border-text-muted text-text-muted rounded hover:bg-white/5 disabled:opacity-50 transition-colors">
                        SIMULATE
                    </button>
                    <button onClick={onToggleStream} className={`px-4 py-1.5 text-xs font-bold border rounded transition-colors ${isViewing ? 'bg-accent-primary border-accent-primary text-white hover:bg-red-600' : 'border-blue-500 text-blue-500 hover:bg-blue-500/10'}`}>
                        {isViewing ? 'EXIT STREAM' : 'VIEW STREAM'}
                    </button>
                </div>
            </div>

            {/* Mobile Controls Trigger & Status */}
            <div className="flex items-center gap-3">
                {/* Status Indicator (Always Visible) */}
                <div className="flex items-center gap-2 px-3 py-1 bg-black/30 rounded-full border border-white/10 shrink-0">
                    <div className={`w-2 h-2 rounded-full ${connectionStatus === 'Disconnected' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                    <span className="hidden md:block whitespace-nowrap text-xs font-mono font-bold text-gray-300">{connectionStatus.toUpperCase()}</span>
                    {!socketConnected && <span className="hidden sm:inline whitespace-nowrap text-[10px] text-red-500">(Socket Offline)</span>}
                </div>

                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-text-muted hover:text-white p-1 shrink-0">
                    <MoreVertical size={24} />
                </button>
            </div>

            {/* Mobile Menu Modal */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className="bg-bg-panel border border-border-color rounded-xl p-6 w-full max-w-xs space-y-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-4">Connections</h3>

                        <button
                            onClick={() => {
                                onConnectSerial();
                                setIsMobileMenuOpen(false);
                            }}
                            disabled={isViewing}
                            className="w-full py-3 text-sm font-bold border border-accent-primary text-accent-primary rounded hover:bg-accent-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            USB HOST
                        </button>

                        <button
                            onClick={
                                mqttStatus === 'Connected'
                                    ? () => {
                                          onDisconnectMQTT();
                                          setIsMobileMenuOpen(false);
                                      }
                                    : handleOpenMQTT
                            }
                            disabled={isViewing || connectionStatus === 'USB Host'}
                            className={`w-full py-3 text-sm font-bold border rounded transition-colors ${mqttStatus === 'Connected' ? 'bg-green-600/20 border-green-500 text-green-500 hover:bg-green-600/30' : 'border-purple-500 text-purple-500 hover:bg-purple-500/10'}`}>
                            {mqttStatus === 'Connected' ? 'MQTT ACTIVE' : 'CONNECT MQTT'}
                        </button>

                        <button
                            onClick={() => {
                                onSimulate();
                                setIsMobileMenuOpen(false);
                            }}
                            disabled={isViewing || isHost}
                            className="w-full py-3 text-sm font-bold border border-text-muted text-text-muted rounded hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            SIMULATE DATA
                        </button>

                        <button
                            onClick={() => {
                                onToggleStream();
                                setIsMobileMenuOpen(false);
                            }}
                            className={`w-full py-3 text-sm font-bold border rounded transition-colors ${isViewing ? 'bg-accent-primary border-accent-primary text-white hover:bg-red-600' : 'border-blue-500 text-blue-500 hover:bg-blue-500/10'}`}>
                            {isViewing ? 'EXIT STREAM' : 'VIEW STREAM'}
                        </button>

                        <button onClick={() => setIsMobileMenuOpen(false)} className="w-full py-2 text-xs font-bold text-text-muted hover:text-white mt-4">
                            CLOSE
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}
