import React, { useState, useEffect } from 'react';

export function MQTTModal({ isOpen, onClose, onConnect }) {
    const [url, setUrl] = useState('wss://mqtt.csutter.dev');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [topic, setTopic] = useState('telemetry/fluctus/#');
    const [savePassword, setSavePassword] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('mqtt_settings');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.url) setUrl(parsed.url);
                    if (parsed.username) setUsername(parsed.username);
                    if (parsed.topic) setTopic(parsed.topic);
                    if (parsed.savePassword) {
                        setSavePassword(true);
                        if (parsed.password) setPassword(atob(parsed.password)); // Simple decode
                    }
                } catch (e) {
                    console.error('Failed to load MQTT settings', e);
                }
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();

        // Save settings
        const settings = {
            url,
            username,
            topic,
            savePassword,
            password: savePassword ? btoa(password) : undefined, // Simple encode
        };
        localStorage.setItem('mqtt_settings', JSON.stringify(settings));

        onConnect(url, username, password, topic);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-bg-panel border border-border-color rounded-xl shadow-2xl p-4 md:p-6">
                <h2 className="text-xl font-bold mb-4 text-white">Connect to MQTT</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-text-muted mb-1">Broker URL (WebSockets)</label>
                        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ws://broker:9001" required className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-accent-primary" />
                        <p className="text-[10px] text-text-muted mt-1">Must be a WebSocket URL (ws:// or wss://)</p>
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-wider text-text-muted mb-1">Topic</label>
                        <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="fluctus/telemetry" required className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-accent-primary" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-text-muted mb-1">Username (Optional)</label>
                            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-accent-primary" />
                        </div>
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-text-muted mb-1">Password (Optional)</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-accent-primary" />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="savePassword" checked={savePassword} onChange={(e) => setSavePassword(e.target.checked)} className="rounded border-white/10 bg-black/50 text-accent-primary focus:ring-accent-primary" />
                        <label htmlFor="savePassword" className="text-xs text-text-muted cursor-pointer select-none">
                            Save Password locally
                        </label>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-bold text-text-muted hover:text-white transition-colors">
                            CANCEL
                        </button>
                        <button type="submit" className="flex-1 px-4 py-2 text-sm font-bold bg-accent-primary text-white rounded hover:bg-opacity-90 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                            CONNECT
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
