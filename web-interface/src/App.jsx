import React from 'react';
import { SocketProvider } from './contexts/SocketContext';
import { TelemetryProvider, useTelemetry } from './contexts/TelemetryContext';
import { useSerial } from './hooks/useSerial';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';

import { useDataReplay } from './hooks/useDataReplay';
import { useSimulation } from './hooks/useSimulation';
import { useMQTT } from './hooks/useMQTT';
import { MQTTModal } from './components/MQTTModal';
import { useRef, useState } from 'react';

function AppContent() {
    const { connectSerial, sendCommand } = useSerial();
    const { startSimulation, isSimulating } = useSimulation();
    const { setIsViewing, isViewing, setIsHost, updateTelemetry } = useTelemetry();
    const { connectMQTT, disconnectMQTT, sendMQTTCommand, mqttStatus } = useMQTT();
    const { startReplay, stopReplay, isReplaying, loadFiles, hasData } = useDataReplay();

    const [isMQTTModalOpen, setMQTTModalOpen] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const fileInputRef = useRef(null);

    // Logic for toggling stream vs serial is handled in hooks/contexts mostly,
    // but the buttons trigger these actions.

    const handleSimulate = () => {
        if (isReplaying) stopReplay();
        startSimulation();
    };

    const handleImportClick = () => {
        if (isReplaying) {
            stopReplay();
        } else if (hasData) {
            // If we have data, maybe we just want to restart or continue?
            // For now, let's assume clicking import always asks for a file unless strictly controlled.
            // Or better: If hasData is true, maybe we should have a separate Play/Pause logic?
            // User requested "Import" button. Let's make it open file dialog.
            fileInputRef.current?.click();
        } else {
            fileInputRef.current?.click();
        }
    };

    const onFileSelected = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            loadFiles(files, true);
        }
        // Reset input
        e.target.value = '';
    };

    const handleToggleStream = () => {
        if (isViewing) {
            // Leave
            setIsViewing(false);
        } else {
            if (isReplaying) stopReplay();
            setIsHost(false);
            setIsViewing(true);
        }
    };

    return (
        <div className="flex h-screen w-screen bg-bg-dark text-white overflow-hidden font-sans">
            {/* Hidden File Input */}
            <input type="file" ref={fileInputRef} onChange={onFileSelected} accept=".csv,.txt" className="hidden" multiple />

            {/* Mobile Backdrop */}
            {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onCommand={sendMQTTCommand}
                onResetLayout={() => {
                    if (confirm('Reset dashboard layout to default?')) {
                        localStorage.removeItem('dashboard_layout_v2');
                        location.reload();
                    }
                }}
            />
            <div className="flex flex-col flex-1 min-w-0">
                <Header
                    onConnectSerial={connectSerial}
                    onSimulate={handleSimulate}
                    onImport={handleImportClick}
                    isReplaying={isReplaying}
                    onToggleStream={handleToggleStream}
                    onOpenMQTT={() => setMQTTModalOpen(true)}
                    mqttStatus={mqttStatus}
                    onDisconnectMQTT={disconnectMQTT}
                    onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
                />
                <Dashboard />
            </div>
            <MQTTModal isOpen={isMQTTModalOpen} onClose={() => setMQTTModalOpen(false)} onConnect={connectMQTT} />
        </div>
    );
}

function App() {
    return (
        <SocketProvider>
            <TelemetryProvider>
                <AppContent />
            </TelemetryProvider>
        </SocketProvider>
    );
}

export default App;
